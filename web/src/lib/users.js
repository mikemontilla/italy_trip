import { query } from "@/lib/db";

export async function upsertUser({ googleId, email, name, avatarUrl }) {
  await query(
    `INSERT INTO users (google_id, email, name, avatar_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email      = VALUES(email),
       name       = VALUES(name),
       avatar_url = VALUES(avatar_url)`,
    [googleId, email, name, avatarUrl ?? null]
  );

  const [user] = await query("SELECT id FROM users WHERE google_id = ?", [googleId]);
  return user;
}
