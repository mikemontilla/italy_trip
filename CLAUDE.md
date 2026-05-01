# CLAUDE.md

Group expense-splitting web app for trips (codename: SplitMate / Italy Trip).

## Authoritative documentation

Read these first for substantive changes. Don't duplicate their content elsewhere.

- [specs/system_requirements.md](specs/system_requirements.md) — functional and system requirements (SR-01..SR-38).
- [specs/db_architecture.md](specs/db_architecture.md) — relational schema, indexes, and the zero-sum balance invariant.

## Repository layout

- `web/` — the Next.js application. All app code lives here.
- `web/CLAUDE.md` and `web/AGENTS.md` — extra rules for code under `web/`. Notably: this Next.js version has breaking API changes from older releases, so consult `web/node_modules/next/dist/docs/` before writing Next-specific code.
- `specs/` — see above.

## Tech stack at a glance

- Next.js 16 (App Router, JavaScript — no TypeScript)
- MariaDB via `mysql2`, with raw SQL migrations under `web/src/db/migrations/`
- NextAuth.js with Google OAuth as the only auth method
- Bootstrap 5
- Vitest for tests, run against a real `expense_splitter_test` database
- `swagger-jsdoc` + `swagger-ui-react`, served at `/api/docs`

## Common commands (run inside `web/`)

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm test` — full Vitest suite (uses `.env.test`)
- `npm run migrate:test` — apply migrations to the test database

## Code conventions

- **Colors**: import `palette` from `src/lib/theme.js`. Never redefine a local palette object. Underlying CSS variables are declared in `src/app/globals.css`.
- **Bootstrap first**: prefer utility classes for layout, spacing, borders, and typography. Reserve inline styles for CSS variables (palette colors) and properties Bootstrap can't express (e.g., chevron rotation, custom cursors).
- **Errors**: use `<ErrorBanner message={...} />` from `src/components/ErrorBanner.js`. Translate raw server error codes (`event_finalized`, `payers_sum_mismatch`, etc.) through `translateError()` in `src/lib/error-messages.js`.
- **Currency**: never render raw amounts. Always go through `formatCOP()` from `src/lib/format.js`. It shows 2 decimals only when the amount has a fractional part — consistent for COP today, ready for other currencies later.
- **Settlement tolerance**: an event counts as settled when every individual balance is within ±1 peso (`SETTLEMENT_TOLERANCE_CENTS = 100`). Use `allBalancesSettled` / `isWithinTolerance` from `src/lib/settlement-rules.js` for both client and server checks.
- **Server-only vs client-safe modules**: any module that imports `mysql2` (directly or transitively through `src/lib/db.js`) is server-only. Modules meant to be reused on the client must be pure (no DB imports). Current pure modules: `theme.js`, `format.js`, `error-messages.js`, `settlement-rules.js`.

## API + Swagger

- Each `route.js` carries an `@openapi` JSDoc block; reusable schemas live in `src/lib/swagger.js`.
- Keep response shapes and `@openapi` blocks in sync.
- Mutating endpoints return `409` with `event_finalized` when the event is in finalized state.

## Testing

- Integration tests under `web/tests/api/` mock `@/auth` and run against a real test DB.
- `web/tests/helpers.js` (test user creation) and `web/tests/setup.js` (truncate-between-tests, pool teardown) are the shared infra.
- API tests are the primary safety net; there are no UI component tests yet — manual browser verification covers the current scope.

## Money handling

- Storage: every amount column is `DECIMAL(12, 2)` — exact precision, no float rounding.
- Computation: balance math runs in integer cents inside `src/lib/balances.js`. Cent remainders distribute to splitters in insertion order.
- Display: always `formatCOP()`.
