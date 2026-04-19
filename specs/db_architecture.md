# Database Architecture — Group Expense Splitter

---

## Overview

The database is relational (MariaDB) and organized around a central concept: an **event** is a group activity (a trip, an outing) where multiple people share expenses. The key design challenge is that the same person can participate in multiple events, and each event has its own independent set of expenses, movements, and balances.

The table `event_participants` is the axis of the whole schema: instead of referencing users directly from expenses or movements, every financial record references an `event_participant` — a person within a specific event. This guarantees that every record is always unambiguously tied to one event and one person.

---

## Entity Relationship Summary

```
users ──────────────────────────< event_participants >── fictitious_participants
                                         │
events ──────────────────────────────────┘
   │                                     │
   └──< expenses >── expense_payers ─────┘
          │
          └──< expense_splits >──────────┘
   │
   └──< movements (sender) >────────────┘
   └──< movements (recipient) >─────────┘
```

---

## Tables

---

### `migrations`

Tracks which SQL migration scripts have already been applied to the database. Used by the migration runner (`npm run migrate`) to avoid re-applying scripts on subsequent runs.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | Auto-incremented identifier |
| `name` | VARCHAR(255) UNIQUE | Filename of the applied migration script (e.g. `002_create_users.sql`) |
| `applied_at` | TIMESTAMP | Date and time when the migration was applied |

---

### `users`

Stores every person who has created an account in the application. Authentication is exclusively through Google OAuth, so the primary external identifier is `google_id`.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | Internal auto-incremented identifier |
| `google_id` | VARCHAR(255) UNIQUE | Unique identifier assigned by Google to the user's Google account. Used by NextAuth to find the user on every login |
| `email` | VARCHAR(255) UNIQUE | User's Google email address |
| `name` | VARCHAR(255) | Display name from the user's Google profile |
| `avatar_url` | VARCHAR(512) NULL | URL of the profile picture from Google. Nullable in case Google does not provide one |
| `created_at` | TIMESTAMP | Date and time when the user first logged in and their account was created |

**Indexes:**
- `uq_users_google_id` — NextAuth looks up users by Google ID on every login, so this lookup must be fast.
- `uq_users_email` — ensures no duplicate accounts and supports lookups by email.

---

### `events`

Represents a group activity (trip, dinner, outing) in which participants share expenses. Each event has a unique short alphanumeric `code` that can be shared so others can join.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | Internal auto-incremented identifier |
| `code` | VARCHAR(8) UNIQUE | Short alphanumeric code used to share the event (e.g. `ITALY26`). Generated automatically on creation |
| `name` | VARCHAR(255) | Name of the event (e.g. "Italy Trip 2026") |
| `description` | TEXT NULL | Optional longer description of the event |
| `photo_path` | VARCHAR(512) NULL | Path to the event's cover photo stored in the local filesystem. Nullable if no photo is uploaded |
| `status` | ENUM('active', 'finalized') | Current state of the event. Only `active` events accept new expenses and movements. Defaults to `active` |
| `created_by_user_id` | INT UNSIGNED FK → users | The authenticated user who created the event. This user is automatically assigned the `admin` role |
| `created_at` | TIMESTAMP | Date and time when the event was created |
| `finalized_at` | TIMESTAMP NULL | Date and time when the event was finalized. NULL while the event is still active |

**Indexes:**
- `uq_events_code` — events are looked up by code when participants join, so this must be fast.
- `idx_events_created_by` — used when listing all events created by a specific user.

---

### `fictitious_participants`

Represents a guest participant who does not have an account in the application. An administrator can add them to an event using only a name. This avoids forcing everyone in a group to register just to be included in the expense split.

Fictitious participants are always scoped to a single event — they cannot be reused across events.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | Internal auto-incremented identifier |
| `event_id` | INT UNSIGNED FK → events | The event this fictitious participant belongs to. Deleting the event cascades and removes this record |
| `name` | VARCHAR(255) | The name used to identify this person within the event (e.g. "Tío Carlos") |
| `created_at` | TIMESTAMP | Date and time when the fictitious participant was added |

**Indexes:**
- `idx_fictitious_participants_event` — fetching all fictitious participants for an event is a common operation when displaying the participant list.

---

### `event_participants`

**The central table of the schema.** Each row represents one person inside one specific event. Both registered users and fictitious participants are unified here under a single `id`, which is what all financial records (expenses, movements) reference.

This design ensures that every expense or movement is always tied to a specific person within a specific event — not just a person in general.

**Rule:** exactly one of `user_id` or `fictitious_participant_id` must be set per row. Never both, never neither. This is enforced by a `CHECK` constraint in the database.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | The unified participant-in-event identifier. This is what `expense_payers`, `expense_splits`, and `movements` reference |
| `event_id` | INT UNSIGNED FK → events | The event this participant belongs to |
| `user_id` | INT UNSIGNED FK → users NULL | Set if the participant is a registered user. NULL if they are fictitious |
| `fictitious_participant_id` | INT UNSIGNED FK → fictitious_participants NULL | Set if the participant is a guest with no account. NULL if they are a registered user |
| `role` | ENUM('admin', 'participant') | The participant's role within the event. Admins can manage the event; participants can register expenses and movements. Defaults to `participant` |
| `joined_at` | TIMESTAMP | Date and time when this person was added to the event |

**Constraints:**
- `chk_ep_one_participant` — CHECK constraint ensuring `user_id` and `fictitious_participant_id` are mutually exclusive.
- `uq_ep_event_user` — prevents adding the same registered user twice to the same event.
- `uq_ep_event_fictitious` — prevents adding the same fictitious participant twice to the same event.

**Indexes:**
- `idx_ep_user` — used when fetching all events a registered user participates in (the home screen event list).

---

### `expenses`

Records a shared expense within an event. The total `amount` is what was actually spent. Who paid and who owes is recorded in `expense_payers` and `expense_splits` respectively.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | Internal auto-incremented identifier |
| `event_id` | INT UNSIGNED FK → events | The event this expense belongs to |
| `description` | VARCHAR(255) | Short description of what was purchased (e.g. "Airport taxi") |
| `amount` | DECIMAL(12,2) | Total amount of the expense in COP. Stored as decimal to avoid floating-point rounding errors |
| `expense_date` | DATE | The date the expense actually occurred (may differ from `created_at`) |
| `created_by_event_participant_id` | INT UNSIGNED FK → event_participants | The participant who registered the expense in the app |
| `created_at` | TIMESTAMP | Date and time when the expense was entered into the system |

**Indexes:**
- `idx_expenses_event` — the most frequent query is listing all expenses for a given event.
- `idx_expenses_created_by` — used when filtering expenses registered by a specific participant.

---

### `expense_payers`

Records which participants paid for a given expense and how much each one contributed. An expense can have multiple payers (e.g. two people split the payment at the register). The sum of all `amount` values in this table for a given `expense_id` must equal `expenses.amount`.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | Internal auto-incremented identifier |
| `expense_id` | INT UNSIGNED FK → expenses | The expense being paid |
| `event_participant_id` | INT UNSIGNED FK → event_participants | The participant who put the money for this expense |
| `amount` | DECIMAL(12,2) | The amount this specific participant paid towards the expense in COP |

**Indexes:**
- `uq_payers_expense_participant` — a participant can only appear once as payer per expense.
- `idx_payers_participant` — used in balance calculation to sum all amounts paid by a participant across all expenses.

---

### `expense_splits`

Records which participants share the cost of an expense. The division is always equal: each participant listed here owes `expenses.amount / COUNT(*)` for that expense.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | Internal auto-incremented identifier |
| `expense_id` | INT UNSIGNED FK → expenses | The expense being split |
| `event_participant_id` | INT UNSIGNED FK → event_participants | A participant who owes a share of this expense |

**Indexes:**
- `uq_splits_expense_participant` — a participant can only appear once per expense split.
- `idx_splits_participant` — used in balance calculation to find all expenses a participant owes money for.

---

### `movements`

Records a direct money transfer or loan between two participants within an event. Movements affect balances directly: they represent money that has already changed hands (or is owed as a loan) outside of a shared expense.

| Field | Type | Description |
|---|---|---|
| `id` | INT UNSIGNED PK | Internal auto-incremented identifier |
| `event_id` | INT UNSIGNED FK → events | The event this movement belongs to |
| `type` | ENUM('transfer', 'loan') | `transfer`: money was sent to settle a debt. `loan`: one participant lent money to another |
| `amount` | DECIMAL(12,2) | The amount transferred or loaned in COP |
| `sender_event_participant_id` | INT UNSIGNED FK → event_participants | The participant who sent the money or gave the loan |
| `recipient_event_participant_id` | INT UNSIGNED FK → event_participants | The participant who received the money or the loan |
| `bank` | VARCHAR(255) NULL | Optional name of the bank or payment platform used (e.g. "Nequi", "Bancolombia") |
| `note` | TEXT NULL | Optional free-text note about the movement |
| `movement_date` | DATE | The date the money actually moved |
| `created_at` | TIMESTAMP | Date and time when the movement was registered in the system |

**Constraints:**
- `chk_movements_different_participants` — CHECK constraint preventing a participant from sending money to themselves.

**Indexes:**
- `idx_movements_event` — listing all movements for an event is the primary read pattern.
- `idx_movements_sender` / `idx_movements_recipient` — used in balance calculation to sum all money sent or received by a specific participant.

---

## Balance Calculation Logic

The net balance of a participant within an event is computed as:

```
balance = total_paid - total_owed + total_received - total_sent
```

Where:
- **total_paid** = SUM of `expense_payers.amount` for this participant
- **total_owed** = SUM of (`expenses.amount` / number of splits) for each expense this participant appears in `expense_splits`
- **total_received** = SUM of `movements.amount` where this participant is the recipient
- **total_sent** = SUM of `movements.amount` where this participant is the sender

A positive balance means the participant is owed money. A negative balance means they owe money.
