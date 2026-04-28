import { query } from "@/lib/db";
import { isEventFinalized } from "@/lib/events";

const VALID_TYPES = new Set(["transfer", "loan"]);

const MOVEMENT_LIST_COLUMNS = `
  m.id, m.event_id, m.type, m.amount, m.movement_date,
  m.sender_event_participant_id, m.recipient_event_participant_id,
  m.bank, m.note, m.created_by_event_participant_id, m.created_at,
  sender_u.name AS sender_user_name, sender_fp.name AS sender_fictitious_name,
  recipient_u.name AS recipient_user_name, recipient_fp.name AS recipient_fictitious_name
`;

const MOVEMENT_LIST_JOINS = `
  FROM movements m
  JOIN event_participants sender_ep    ON sender_ep.id    = m.sender_event_participant_id
  JOIN event_participants recipient_ep ON recipient_ep.id = m.recipient_event_participant_id
  LEFT JOIN users                  sender_u     ON sender_u.id    = sender_ep.user_id
  LEFT JOIN fictitious_participants sender_fp   ON sender_fp.id   = sender_ep.fictitious_participant_id
  LEFT JOIN users                  recipient_u  ON recipient_u.id = recipient_ep.user_id
  LEFT JOIN fictitious_participants recipient_fp ON recipient_fp.id = recipient_ep.fictitious_participant_id
`;

async function getRequesterParticipant(eventId, userId) {
  const rows = await query(
    `SELECT id, role FROM event_participants
     WHERE event_id = ? AND user_id = ? LIMIT 1`,
    [eventId, userId]
  );
  return rows[0] ?? null;
}

async function participantsBelongToEvent(eventId, participantIds) {
  if (participantIds.length === 0) return true;
  const placeholders = participantIds.map(() => "?").join(",");
  const rows = await query(
    `SELECT id FROM event_participants
     WHERE event_id = ? AND id IN (${placeholders})`,
    [eventId, ...participantIds]
  );
  return rows.length === participantIds.length;
}

function shapeMovement(row) {
  return {
    id:           row.id,
    event_id:     row.event_id,
    type:         row.type,
    amount:       row.amount,
    movement_date: row.movement_date,
    bank:         row.bank,
    note:         row.note,
    created_at:   row.created_at,
    created_by_event_participant_id: row.created_by_event_participant_id,
    sender: {
      participant_id: row.sender_event_participant_id,
      name: row.sender_user_name ?? row.sender_fictitious_name,
    },
    recipient: {
      participant_id: row.recipient_event_participant_id,
      name: row.recipient_user_name ?? row.recipient_fictitious_name,
    },
  };
}

export async function createMovement({
  eventId,
  actorUserId,
  type,
  senderParticipantId,
  recipientParticipantId,
  amount,
  movementDate,
  bank,
  note,
}) {
  const actor = await getRequesterParticipant(eventId, actorUserId);
  if (!actor) return { error: "forbidden" };

  if (await isEventFinalized(eventId)) return { error: "event_finalized" };

  if (!VALID_TYPES.has(type)) return { error: "invalid_type" };

  const total = Number(amount);
  if (!Number.isFinite(total) || total <= 0) return { error: "amount_invalid" };

  const dateObj = movementDate instanceof Date ? movementDate : new Date(movementDate);
  if (Number.isNaN(dateObj.getTime())) return { error: "date_invalid" };

  if (!Number.isInteger(senderParticipantId) || senderParticipantId <= 0) {
    return { error: "sender_invalid" };
  }
  if (!Number.isInteger(recipientParticipantId) || recipientParticipantId <= 0) {
    return { error: "recipient_invalid" };
  }
  if (senderParticipantId === recipientParticipantId) {
    return { error: "sender_equals_recipient" };
  }

  const bothBelong = await participantsBelongToEvent(eventId, [
    senderParticipantId,
    recipientParticipantId,
  ]);
  if (!bothBelong) return { error: "participant_not_in_event" };

  const cleanBank = typeof bank === "string" && bank.trim().length > 0 ? bank.trim() : null;
  if (cleanBank && cleanBank.length > 255) return { error: "bank_too_long" };
  const cleanNote = typeof note === "string" && note.trim().length > 0 ? note.trim() : null;

  const result = await query(
    `INSERT INTO movements
       (event_id, type, amount, sender_event_participant_id,
        recipient_event_participant_id, bank, note,
        created_by_event_participant_id, movement_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      type,
      total.toFixed(2),
      senderParticipantId,
      recipientParticipantId,
      cleanBank,
      cleanNote,
      actor.id,
      dateObj.toISOString().slice(0, 10),
    ]
  );
  return { movement: await getMovement(result.insertId, actorUserId) };
}

export async function listMovements(eventId, requesterUserId) {
  const requester = await getRequesterParticipant(eventId, requesterUserId);
  if (!requester) return null;

  const rows = await query(
    `SELECT ${MOVEMENT_LIST_COLUMNS}
     ${MOVEMENT_LIST_JOINS}
     WHERE m.event_id = ?
     ORDER BY m.movement_date DESC, m.id DESC`,
    [eventId]
  );
  return rows.map(shapeMovement);
}

export async function getMovement(movementId, requesterUserId) {
  const rows = await query(
    `SELECT ${MOVEMENT_LIST_COLUMNS},
            creator_u.name AS creator_user_name,
            creator_fp.name AS creator_fictitious_name
     ${MOVEMENT_LIST_JOINS}
     JOIN event_participants creator_ep ON creator_ep.id = m.created_by_event_participant_id
     LEFT JOIN users creator_u ON creator_u.id = creator_ep.user_id
     LEFT JOIN fictitious_participants creator_fp ON creator_fp.id = creator_ep.fictitious_participant_id
     WHERE m.id = ?`,
    [movementId]
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  const requester = await getRequesterParticipant(row.event_id, requesterUserId);
  if (!requester) return null;

  return {
    ...shapeMovement(row),
    created_by: {
      participant_id: row.created_by_event_participant_id,
      name: row.creator_user_name ?? row.creator_fictitious_name,
    },
  };
}

export async function deleteMovement(movementId, actorUserId) {
  const [movement] = await query(
    `SELECT id, event_id FROM movements WHERE id = ?`,
    [movementId]
  );
  if (!movement) return { error: "not_found" };

  const actor = await getRequesterParticipant(movement.event_id, actorUserId);
  if (!actor) return { error: "forbidden" };
  if (actor.role !== "admin") return { error: "forbidden" };

  if (await isEventFinalized(movement.event_id)) return { error: "event_finalized" };

  await query(`DELETE FROM movements WHERE id = ?`, [movementId]);
  return { deleted: true };
}
