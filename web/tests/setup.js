import { afterAll, beforeEach } from "vitest";
import { query, end } from "@/lib/db";

const TABLES = [
  "expense_splits",
  "expense_payers",
  "expenses",
  "movements",
  "event_participants",
  "fictitious_participants",
  "events",
  "users",
];

beforeEach(async () => {
  await query("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of TABLES) {
    await query(`TRUNCATE TABLE ${table}`);
  }
  await query("SET FOREIGN_KEY_CHECKS = 1");
});

afterAll(async () => {
  await end();
});
