import { getConnection, query } from "@/lib/db";
import { isEventFinalized } from "@/lib/events";

const PARTICIPANT_COLUMNS = `
  ep.id, ep.role, ep.joined_at,
  ep.user_id, u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url,
  ep.fictitious_participant_id, fp.name AS fictitious_name
`;

async function isParticipant(eventId, userId) {
  const rows = await query(
    `SELECT 1 FROM event_participants
     WHERE event_id = ? AND user_id = ? LIMIT 1`,
    [eventId, userId]
  );
  return rows.length > 0;
}

async function isAdmin(eventId, userId) {
  const rows = await query(
    `SELECT 1 FROM event_participants
     WHERE event_id = ? AND user_id = ? AND role = 'admin' LIMIT 1`,
    [eventId, userId]
  );
  return rows.length > 0;
}

function shapeParticipant(row) {
  const base = { id: row.id, role: row.role, joined_at: row.joined_at };
  if (row.user_id) {
    return {
      ...base,
      type: "registered",
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        avatar_url: row.user_avatar_url,
      },
    };
  }
  return {
    ...base,
    type: "fictitious",
    fictitious: {
      id: row.fictitious_participant_id,
      name: row.fictitious_name,
    },
  };
}

export async function listParticipants(eventId, requesterUserId) {
  if (!(await isParticipant(eventId, requesterUserId))) return null;

  const rows = await query(
    `SELECT ${PARTICIPANT_COLUMNS}
     FROM event_participants ep
     LEFT JOIN users u ON u.id = ep.user_id
     LEFT JOIN fictitious_participants fp ON fp.id = ep.fictitious_participant_id
     WHERE ep.event_id = ?
     ORDER BY ep.joined_at ASC, ep.id ASC`,
    [eventId]
  );
  return rows.map(shapeParticipant);
}

export async function addFictitiousParticipant(eventId, adminUserId, name) {
  if (!(await isAdmin(eventId, adminUserId))) return { error: "forbidden" };
  if (await isEventFinalized(eventId)) return { error: "event_finalized" };

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [fpResult] = await conn.execute(
      `INSERT INTO fictitious_participants (event_id, name) VALUES (?, ?)`,
      [eventId, name]
    );
    const fictitiousId = fpResult.insertId;

    const [epResult] = await conn.execute(
      `INSERT INTO event_participants (event_id, fictitious_participant_id, role)
       VALUES (?, ?, 'participant')`,
      [eventId, fictitiousId]
    );
    await conn.commit();

    return {
      participant: {
        id: epResult.insertId,
        type: "fictitious",
        role: "participant",
        fictitious: { id: fictitiousId, name },
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function joinEventByCode(code, userId) {
  const [event] = await query(
    `SELECT id, code, name, status FROM events WHERE code = ?`,
    [code]
  );
  if (!event) return { error: "event_not_found" };
  if (event.status === "finalized") return { error: "event_finalized" };

  try {
    await query(
      `INSERT INTO event_participants (event_id, user_id, role)
       VALUES (?, ?, 'participant')`,
      [event.id, userId]
    );
    return { event };
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return { error: "already_joined", event };
    throw err;
  }
}
