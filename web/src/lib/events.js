import { getConnection, query } from "@/lib/db";
import { generateEventCode } from "@/lib/codes";
import { computeTotalsInCents } from "@/lib/balances";

const MAX_CODE_ATTEMPTS = 10;

const EVENT_COLUMNS = `
  e.id, e.code, e.name, e.description, e.photo_path, e.status,
  e.created_by_user_id, e.created_at, e.finalized_at
`;

export async function createEvent({ name, description, creatorUserId }) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    let eventId;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateEventCode();
      try {
        const [result] = await conn.execute(
          `INSERT INTO events (code, name, description, created_by_user_id)
           VALUES (?, ?, ?, ?)`,
          [code, name, description ?? null, creatorUserId]
        );
        eventId = result.insertId;
        break;
      } catch (err) {
        if (err.code === "ER_DUP_ENTRY" && attempt < MAX_CODE_ATTEMPTS - 1) {
          continue;
        }
        throw err;
      }
    }

    await conn.execute(
      `INSERT INTO event_participants (event_id, user_id, role)
       VALUES (?, ?, 'admin')`,
      [eventId, creatorUserId]
    );

    await conn.commit();
    return getEventById(eventId, creatorUserId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listEventsForUser(userId) {
  return query(
    `SELECT ${EVENT_COLUMNS}
     FROM events e
     JOIN event_participants ep ON ep.event_id = e.id
     WHERE ep.user_id = ?
     ORDER BY e.created_at DESC, e.id DESC`,
    [userId]
  );
}

export async function getEventById(eventId, userId) {
  const rows = await query(
    `SELECT ${EVENT_COLUMNS}
     FROM events e
     JOIN event_participants ep ON ep.event_id = e.id
     WHERE e.id = ? AND ep.user_id = ?`,
    [eventId, userId]
  );
  return rows[0] ?? null;
}

export async function setEventPhoto(eventId, userId, photoPath) {
  if (await isEventFinalized(eventId)) return { error: "event_finalized" };
  const result = await query(
    `UPDATE events e
     JOIN event_participants ep
       ON ep.event_id = e.id AND ep.user_id = ? AND ep.role = 'admin'
     SET e.photo_path = ?
     WHERE e.id = ?`,
    [userId, photoPath, eventId]
  );
  return { updated: result.affectedRows > 0 };
}

export async function getEventStatus(eventId) {
  const [row] = await query(`SELECT status FROM events WHERE id = ?`, [eventId]);
  return row?.status ?? null;
}

export async function isEventFinalized(eventId) {
  return (await getEventStatus(eventId)) === "finalized";
}

async function isAdminUser(eventId, userId) {
  const rows = await query(
    `SELECT 1 FROM event_participants
     WHERE event_id = ? AND user_id = ? AND role = 'admin' LIMIT 1`,
    [eventId, userId]
  );
  return rows.length > 0;
}

async function isAnyParticipant(eventId, userId) {
  const rows = await query(
    `SELECT 1 FROM event_participants
     WHERE event_id = ? AND user_id = ? LIMIT 1`,
    [eventId, userId]
  );
  return rows.length > 0;
}

export async function finalizeEvent(eventId, requesterUserId) {
  if (!(await isAnyParticipant(eventId, requesterUserId))) return { error: "not_found" };
  if (!(await isAdminUser(eventId, requesterUserId))) return { error: "forbidden" };

  const status = await getEventStatus(eventId);
  if (status === "finalized") return { error: "already_finalized" };

  const balances = await computeTotalsInCents(eventId);
  const allZero = balances.every((b) => b.balance_cents === 0);
  if (!allZero) return { error: "balance_not_zero" };

  await query(
    `UPDATE events SET status = 'finalized', finalized_at = NOW() WHERE id = ?`,
    [eventId]
  );
  return { event: await getEventById(eventId, requesterUserId) };
}

export async function reopenEvent(eventId, requesterUserId) {
  if (!(await isAnyParticipant(eventId, requesterUserId))) return { error: "not_found" };
  if (!(await isAdminUser(eventId, requesterUserId))) return { error: "forbidden" };

  const status = await getEventStatus(eventId);
  if (status !== "finalized") return { error: "not_finalized" };

  await query(
    `UPDATE events SET status = 'active', finalized_at = NULL WHERE id = ?`,
    [eventId]
  );
  return { event: await getEventById(eventId, requesterUserId) };
}
