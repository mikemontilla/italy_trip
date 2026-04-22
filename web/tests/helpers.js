import { query } from "@/lib/db";

let counter = 0;

export async function createTestUser(overrides = {}) {
  counter += 1;
  const googleId = overrides.googleId ?? `test-google-${Date.now()}-${counter}`;
  const email = overrides.email ?? `user-${Date.now()}-${counter}@test.local`;
  const name = overrides.name ?? `Test User ${counter}`;
  const avatarUrl = overrides.avatarUrl ?? null;

  const result = await query(
    `INSERT INTO users (google_id, email, name, avatar_url)
     VALUES (?, ?, ?, ?)`,
    [googleId, email, name, avatarUrl]
  );
  return { id: result.insertId, googleId, email, name, avatarUrl };
}
