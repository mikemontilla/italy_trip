# SplitMate — Group Expense Splitter

A web app for splitting shared expenses on group trips. Log expenses as they happen, record who paid and who shares each cost, and always know who owes whom. When it's time to settle up, the app suggests the transfers that bring everyone back to zero.

It was built for a real group trip to Italy (hence the repository name), but it works for any shared outing: weekend getaways, shared flats, dinners, and so on.

## Features

- **Google sign-in.** No passwords to manage; Google is the only login method.
- **Events.** Create an event (with an optional cover photo) and share its 8-character join code with your group.
- **Participants.** Add people who have an account, or add *fictitious* participants by name only, for friends who won't sign up.
- **Expenses.** Record description, amount, date, one or more payers, and who shares the cost. With several payers, the total is split equally by default, or you can enter each payer's amount by hand.
- **Movements.** Record loans and debt-settlement transfers between participants.
- **Live balances.** See what each person paid, what they owe, and their net balance, colored green (owed money) or red (owes money).
- **Settlement suggestions.** Admins get two alternative plans for who should pay whom. Both aim to minimize the number of transfers any single person has to make.
- **Finalize and reopen.** Once everyone is settled, an admin can lock the event as read-only. Admins can reopen it later if needed.
- **Step-by-step forms.** Each creation flow asks one question at a time, which works well on a phone.
- **REST API with Swagger docs.** The interactive UI is at `/docs` and the raw OpenAPI spec is at `/api/docs`.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, JavaScript) + React 19 |
| UI | [Bootstrap 5](https://getbootstrap.com) |
| Auth | [Auth.js / NextAuth v5](https://authjs.dev) with Google OAuth |
| Database | [MariaDB](https://mariadb.org) via `mysql2`, raw SQL migrations |
| API docs | `swagger-jsdoc` + `swagger-ui-react` |
| Tests | [Vitest](https://vitest.dev) integration tests against a real database |

Amounts are stored as `DECIMAL(12, 2)` and all balance math runs in integer cents, so rounding never creates or loses money. The sum of all balances in an event is always zero, and the test suite checks this.

## Getting started

### Prerequisites

- Node.js 20.9 or later
- MariaDB 10.x or later (MySQL 8 should also work)
- A Google Cloud project with an OAuth 2.0 Client ID

### 1. Clone and install

```bash
git clone https://github.com/mikemontilla/italy_trip.git
cd italy_trip/web
npm install
```

All application code lives in the `web/` directory. Run every command below from there.

### 2. Create the database

```sql
CREATE DATABASE expense_splitter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'splitmate'@'localhost' IDENTIFIED BY 'change_me';
GRANT ALL PRIVILEGES ON expense_splitter.* TO 'splitmate'@'localhost';
```

### 3. Set up Google OAuth

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type *Web application* and add this authorized redirect URI:

```
http://localhost:3000/api/auth/callback/google
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

| Variable | Description |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MariaDB connection settings |
| `AUTH_URL` | Public URL of the app, e.g. `http://localhost:3000` |
| `AUTH_SECRET` | Random secret for signing sessions (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Credentials from step 3 |

### 5. Run migrations and start the app

```bash
npm run migrate   # applies the SQL files in src/db/migrations/
npm run dev       # starts the dev server at http://localhost:3000
```

Open <http://localhost:3000>, sign in with Google, and create your first event.

To check that the app can reach the database, call `GET /api/health`.

## Usage

1. **Create an event.** Give it a name and, optionally, a photo. You become its administrator automatically.
2. **Invite your group.** Share the event code. Friends sign in with Google and join with it. For people without an account, add a fictitious participant by name.
3. **Log expenses as you go.** Choose who paid, how much each payer put in, and who shares the cost.
4. **Record movements.** Log loans or repayments made outside of expenses.
5. **Check balances.** The status bar shows whether the event still has pending debts. Tap any participant to see their breakdown.
6. **Settle up.** As an admin, open the settlement view, pick one of the two plans, and have everyone make their transfers. Register those transfers as movements.
7. **Finalize.** When every balance is within ±1 peso, finalize the event. It stays available to everyone as read-only.

## Production build

```bash
npm run build
npm start         # runs pending migrations, then starts the server
```

Uploaded event photos are saved to `web/public/uploads/`, so use persistent storage for that directory when you deploy.

## API documentation

Every route handler under `web/src/app/api/` carries an OpenAPI annotation. With the app running, open <http://localhost:3000/docs> for the interactive Swagger UI, or fetch the raw spec from `/api/docs`.

## Running tests

The integration tests run against a separate database called `expense_splitter_test`, which is truncated between tests.

```bash
cp .env.example .env.test     # set DB_NAME=expense_splitter_test
npm run migrate:test
npm test
```

## Project structure

```
italy_trip/
├── specs/                     # Requirements, DB design, implementation plan
│   ├── system_requirements.md
│   ├── db_architecture.md
│   └── implementation_plan.md
└── web/                       # Next.js application
    ├── src/
    │   ├── app/               # Pages and API route handlers
    │   ├── components/        # React components (step-by-step flows, modals, lists)
    │   ├── db/                # Migration runner and SQL migrations
    │   └── lib/               # Business logic: balances, settlement, expenses, etc.
    └── tests/api/             # Vitest integration tests
```

## Documentation

- [System requirements](specs/system_requirements.md): use cases, functional requirements, and the testable system requirements (SR-01 to SR-38).
- [Database architecture](specs/db_architecture.md): relational schema, indexes, and the zero-sum balance invariant.
- [Implementation plan](specs/implementation_plan.md): the phase-by-phase build log.

## Roadmap

- Complete the remaining OpenAPI gaps (documenting `409 event_finalized` responses on every mutating endpoint)
- UI component tests with React Testing Library
- Support for currencies other than COP

## Author

**Miguel Ramos**, [@mikemontilla](https://github.com/mikemontilla)
