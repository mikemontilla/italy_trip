import { getConnection, query } from "@/lib/db";
import { isEventFinalized } from "@/lib/events";

const EXPENSE_COLUMNS = `
  e.id, e.event_id, e.description, e.amount, e.expense_date,
  e.created_by_event_participant_id, e.created_at
`;

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

async function getRequesterParticipant(eventId, userId) {
  const rows = await query(
    `SELECT id, role FROM event_participants
     WHERE event_id = ? AND user_id = ? LIMIT 1`,
    [eventId, userId]
  );
  return rows[0] ?? null;
}

async function assertParticipantsBelongToEvent(eventId, participantIds, conn) {
  if (participantIds.length === 0) return true;
  const placeholders = participantIds.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT id FROM event_participants
     WHERE event_id = ? AND id IN (${placeholders})`,
    [eventId, ...participantIds]
  );
  return rows.length === participantIds.length;
}

function validateInput({ description, amount, expenseDate, payers, splitParticipantIds }) {
  if (typeof description !== "string" || description.trim().length === 0) {
    return "description_required";
  }
  if (description.length > 255) return "description_too_long";

  const total = Number(amount);
  if (!Number.isFinite(total) || total <= 0) return "amount_invalid";

  if (!(expenseDate instanceof Date) || Number.isNaN(expenseDate.getTime())) {
    return "date_invalid";
  }

  if (!Array.isArray(payers) || payers.length === 0) return "payers_required";
  const seenPayers = new Set();
  let payerSumCents = 0;
  for (const p of payers) {
    if (!Number.isInteger(p?.participantId) || p.participantId <= 0) return "payer_invalid";
    if (seenPayers.has(p.participantId)) return "payer_duplicated";
    seenPayers.add(p.participantId);
    const pAmount = Number(p?.amount);
    if (!Number.isFinite(pAmount) || pAmount <= 0) return "payer_amount_invalid";
    payerSumCents += toCents(pAmount);
  }
  if (payerSumCents !== toCents(total)) return "payers_sum_mismatch";

  if (!Array.isArray(splitParticipantIds) || splitParticipantIds.length === 0) {
    return "splits_required";
  }
  const seenSplits = new Set();
  for (const id of splitParticipantIds) {
    if (!Number.isInteger(id) || id <= 0) return "split_invalid";
    if (seenSplits.has(id)) return "split_duplicated";
    seenSplits.add(id);
  }

  return null;
}

export async function createExpense({
  eventId,
  actorUserId,
  description,
  amount,
  expenseDate,
  payers,
  splitParticipantIds,
}) {
  const actor = await getRequesterParticipant(eventId, actorUserId);
  if (!actor) return { error: "forbidden" };

  if (await isEventFinalized(eventId)) return { error: "event_finalized" };

  const dateObj = expenseDate instanceof Date ? expenseDate : new Date(expenseDate);
  const validationError = validateInput({
    description,
    amount,
    expenseDate: dateObj,
    payers,
    splitParticipantIds,
  });
  if (validationError) return { error: validationError };

  const allParticipantIds = Array.from(
    new Set([...payers.map((p) => p.participantId), ...splitParticipantIds])
  );

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const allBelong = await assertParticipantsBelongToEvent(eventId, allParticipantIds, conn);
    if (!allBelong) {
      await conn.rollback();
      return { error: "participant_not_in_event" };
    }

    const [result] = await conn.execute(
      `INSERT INTO expenses
         (event_id, description, amount, expense_date, created_by_event_participant_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        eventId,
        description.trim(),
        Number(amount).toFixed(2),
        dateObj.toISOString().slice(0, 10),
        actor.id,
      ]
    );
    const expenseId = result.insertId;

    for (const p of payers) {
      await conn.execute(
        `INSERT INTO expense_payers (expense_id, event_participant_id, amount)
         VALUES (?, ?, ?)`,
        [expenseId, p.participantId, Number(p.amount).toFixed(2)]
      );
    }

    for (const participantId of splitParticipantIds) {
      await conn.execute(
        `INSERT INTO expense_splits (expense_id, event_participant_id)
         VALUES (?, ?)`,
        [expenseId, participantId]
      );
    }

    await conn.commit();
    return { expense: await getExpense(expenseId, actorUserId) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listExpenses(eventId, requesterUserId, { participantId } = {}) {
  const requester = await getRequesterParticipant(eventId, requesterUserId);
  if (!requester) return null;

  const params = [eventId];
  let filterClause = "";
  if (participantId) {
    filterClause = `
      AND e.id IN (
        SELECT expense_id FROM expense_payers WHERE event_participant_id = ?
        UNION
        SELECT expense_id FROM expense_splits WHERE event_participant_id = ?
      )
    `;
    params.push(participantId, participantId);
  }

  return query(
    `SELECT ${EXPENSE_COLUMNS}
     FROM expenses e
     WHERE e.event_id = ? ${filterClause}
     ORDER BY e.expense_date DESC, e.id DESC`,
    params
  );
}

export async function getExpense(expenseId, requesterUserId) {
  const [expense] = await query(
    `SELECT ${EXPENSE_COLUMNS} FROM expenses e WHERE e.id = ?`,
    [expenseId]
  );
  if (!expense) return null;

  const requester = await getRequesterParticipant(expense.event_id, requesterUserId);
  if (!requester) return null;

  const payers = await query(
    `SELECT ep.id, ep.event_participant_id, ep.amount,
            u.name AS user_name, fp.name AS fictitious_name
     FROM expense_payers ep
     JOIN event_participants p ON p.id = ep.event_participant_id
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN fictitious_participants fp ON fp.id = p.fictitious_participant_id
     WHERE ep.expense_id = ?
     ORDER BY ep.id ASC`,
    [expenseId]
  );

  const splits = await query(
    `SELECT es.id, es.event_participant_id,
            u.name AS user_name, fp.name AS fictitious_name
     FROM expense_splits es
     JOIN event_participants p ON p.id = es.event_participant_id
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN fictitious_participants fp ON fp.id = p.fictitious_participant_id
     WHERE es.expense_id = ?
     ORDER BY es.id ASC`,
    [expenseId]
  );

  return {
    ...expense,
    payers: payers.map((p) => ({
      id: p.id,
      participant_id: p.event_participant_id,
      name: p.user_name ?? p.fictitious_name,
      amount: p.amount,
    })),
    splits: splits.map((s) => ({
      id: s.id,
      participant_id: s.event_participant_id,
      name: s.user_name ?? s.fictitious_name,
    })),
  };
}

export async function deleteExpense(expenseId, actorUserId) {
  const [expense] = await query(
    `SELECT id, event_id, created_by_event_participant_id FROM expenses WHERE id = ?`,
    [expenseId]
  );
  if (!expense) return { error: "not_found" };

  const actor = await getRequesterParticipant(expense.event_id, actorUserId);
  if (!actor) return { error: "forbidden" };

  const isCreator = actor.id === expense.created_by_event_participant_id;
  const isAdmin = actor.role === "admin";
  if (!isCreator && !isAdmin) return { error: "forbidden" };

  if (await isEventFinalized(expense.event_id)) return { error: "event_finalized" };

  await query(`DELETE FROM expenses WHERE id = ?`, [expenseId]);
  return { deleted: true };
}
