# System Requirements — Group Expense Splitter

---

## 1. Problem Statement

Groups of people who travel or go out together frequently make shared purchases where not everyone pays. At the end, each participant must remember what they spent, calculate how to divide expenses, and determine who owes whom. This process is error-prone and relies on memory.

The system must allow participants to register expenses as they happen, track who paid and who shares each cost, and at any point show the current balance of debts — so that settling up is simple and transparent.

---

## 2. General Description

A web application accessible from anywhere in the world where users can create **events** (primarily group trips) with multiple participants. Once created, any participant can log shared expenses specifying what was paid, who paid, and among whom the cost is divided. The system continuously tracks and displays each participant's current balance. When all balances reach zero, the event can be finalized.

---

## 3. Actors

| Actor | Description |
|---|---|
| **User** | Any person interacting with the system (authenticated or not yet). Umbrella term for the roles below. |
| **Administrator** | Authenticated user who created the event or was granted admin rights. Has full control over the event. |
| **Participant** | Person taking part in an event. Can register expenses and movements. May or may not have an account. |
| **Fictitious Participant** | A guest added by an admin using only a name. Has no account in the system. |

---

## 4. Use Cases

### Authentication & Account
- User registers in the system
- User authenticates in the system
- User removes their authentication from the system
- User deletes their account from the system

### Events
- Administrator creates a new event
- User accesses the list of their events (created or participated in)
- User views details of a past event
- Administrator adds a participant to an event
- Administrator creates a fictitious participant for an event
- Administrator removes a fictitious participant from an event
- Administrator sends a participation invitation to a participant
- Administrator finalizes an event
- User removes an event from their account

### Expenses
- Participant registers a new expense
- Administrator deletes an expense
- User views the list of expenses for an event
- User views expenses filtered by participant

### Movements (Transfers & Loans)
- Participant registers a movement (transfer or loan between participants)
- Administrator deletes a movement

### Balances & Settlement
- User views their personal balance (what they paid, what they owe, net balance)
- User views the balance of all participants in an event
- Administrator generates a settlement plan showing how to bring all balances to zero

---

## 5. Functional Requirements

### 5.1 Authentication & Users
- The system must provide a user registration mechanism
- The system must authenticate users
- The system must allow users to log out
- The system must allow users to delete their accounts
- The system must support fictitious users (identified by name only, no account required)
- The system must allow administrators to create and delete fictitious participants for an event

### 5.2 Events
- The system must allow authenticated users to create events
- The system must assign a unique alphanumeric code to each event
- The system must assign administrator role to the user who first creates an event
- The system must allow administrators to assign other participants as administrators
- The system must allow administrators to finalize an event
- The system must associate events with the users who created or participate in them
- The system must allow users to access their complete event history
- The system must provide a shareable event link or code for joining

### 5.3 Participants
- The system must allow administrators to add registered participants to an event
- The system must allow administrators to add fictitious participants (name only) to an event
- The system must enforce that only authenticated users can hold the administrator role

### 5.4 Expenses
- The system must allow any administrator to create a new expense in an event
- The system must allow any administrator to delete an expense
- The system must allow specifying: description, amount, date, who paid, and among whom the expense is divided
- The system must associate each expense with one or more payers and one or more participants sharing the cost
- The system must display the full list of expenses for an event
- The system must display all details of a given expense (date, description, payer, participants)

### 5.5 Movements (Transfers & Loans)
- The system must allow any administrator to register a movement in an event
- The system must allow any administrator to delete a movement
- The system must support two movement types: **loan** and **debt settlement** (transfer)
- Each movement must specify: type, sender, recipient, amount, and optionally a bank and a note

### 5.6 Balances
- The system must calculate the balance for each participant, accounting for:
  - Amounts paid by the participant for registered expenses
  - Amounts owed by the participant from registered expenses
  - Money sent or received in registered movements
- The system must display each participant's individual balance (what they paid, what they owe, net total)
- The system must display a summary of balances for all participants in an event
- Each balance must be visually differentiated: green if the participant is owed money, red if they owe money

### 5.7 Settlement
- The system must calculate at least two possible settlement plans showing which participant should transfer what amount to whom so that all balances reach zero
- The primary optimization criterion is: **minimize the maximum number of transfers any single participant must make**
- The second settlement option must be a valid alternative variation of the first

### 5.8 Event Status & Finalization
- The system must always display a status indicator showing whether the event has an outstanding balance or is fully settled
- The option to finalize an event must only appear when all balances are zero
- Once finalized, no participant (other than the administrator) can perform further actions on the event
- Finalized events must remain accessible in read-only mode for all participants

---

## 6. Logical Architecture

The system is composed of five functional blocks:

| Block | Responsibility |
|---|---|
| **Authentication System** | Authenticates users via external identity providers |
| **User Interface** | Views, buttons, and controls through which users interact with the system. Converts user actions into API requests and renders responses |
| **API** | Processes HTTP requests, delegates to the appropriate backend service, and returns formatted responses to the UI |
| **Backend Service** | Contains all business logic: processes data, applies rules, and reads/writes from the database |
| **Database** | Stores all operational data in a structured, relational format with referential integrity |

---

## 7. System Requirements

The following requirements are measurable and testable:

| ID | Requirement |
|---|---|
| SR-01 | The application must be a Single Page Application where data is fetched via API calls and used to populate the UI without full page reloads |
| SR-02 | The system must support registration and authentication exclusively through a Google account |
| SR-03 | The system must require an authenticated user to create an event |
| SR-04 | The system must automatically assign the administrator role to the user who creates an event |
| SR-05 | The system must ensure that only an event administrator can assign the administrator role to other participants |
| SR-06 | The system must ensure that only authenticated users can hold the administrator role in an event |
| SR-07 | The system must allow any event administrator to create fictitious participants for that event |
| SR-08 | The system must assign a unique alphanumeric code to every created event |
| SR-09 | The system must allow any event administrator to create a new expense |
| SR-10 | The system must allow specifying which participants share the cost of a registered expense |
| SR-11 | The system must allow specifying which participant paid for a registered expense |
| SR-12 | The system must display a list of all expenses registered for a given event |
| SR-13 | The system must allow setting a text description for each expense |
| SR-14 | The system must allow setting a monetary amount for each expense |
| SR-15 | The system must display all data for a given expense: date, description, payer, and participants sharing the cost |
| SR-16 | The system must allow any user to view their personal expense balance: total paid, total owed, and net balance |
| SR-17 | The system must allow any user to view the balance of all participants in an event |
| SR-18 | The system must allow any event administrator to generate a settlement plan showing at least 2 options for how participants can transfer money so all balances reach zero |
| SR-19 | The system must allow any event administrator to register a movement in an event |
| SR-20 | The system must allow classifying a movement as either a loan or a debt settlement |
| SR-21 | The system must allow setting the monetary amount of a movement |
| SR-22 | The system must allow setting the sender and recipient of a movement |
| SR-23 | The balance calculation must account for: amounts paid by users in registered expenses, amounts owed by users in registered expenses, and money transferred in each registered movement |
| SR-24 | The system must use fresh and fun language throughout the user interface |
