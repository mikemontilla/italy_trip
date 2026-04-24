import { query } from "@/lib/db";

function toCents(value) {
  return Math.round(Number(value) * 100);
}

function centsToAmount(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

async function isParticipant(eventId, userId) {
  const rows = await query(
    `SELECT id FROM event_participants
     WHERE event_id = ? AND user_id = ? LIMIT 1`,
    [eventId, userId]
  );
  return rows.length > 0;
}

async function computeTotalsInCents(eventId) {
  const participants = await query(
    `SELECT ep.id, ep.role, ep.user_id,
            u.name  AS user_name,
            fp.name AS fictitious_name
     FROM event_participants ep
     LEFT JOIN users u ON u.id = ep.user_id
     LEFT JOIN fictitious_participants fp ON fp.id = ep.fictitious_participant_id
     WHERE ep.event_id = ?
     ORDER BY ep.id ASC`,
    [eventId]
  );

  const paidRows = await query(
    `SELECT ep.event_participant_id AS pid, SUM(ep.amount) AS total
     FROM expense_payers ep
     JOIN expenses e ON e.id = ep.expense_id
     WHERE e.event_id = ?
     GROUP BY ep.event_participant_id`,
    [eventId]
  );
  const paidMap = new Map(paidRows.map((r) => [r.pid, toCents(r.total)]));

  const sentRows = await query(
    `SELECT sender_event_participant_id AS pid, SUM(amount) AS total
     FROM movements
     WHERE event_id = ?
     GROUP BY sender_event_participant_id`,
    [eventId]
  );
  const sentMap = new Map(sentRows.map((r) => [r.pid, toCents(r.total)]));

  const receivedRows = await query(
    `SELECT recipient_event_participant_id AS pid, SUM(amount) AS total
     FROM movements
     WHERE event_id = ?
     GROUP BY recipient_event_participant_id`,
    [eventId]
  );
  const receivedMap = new Map(receivedRows.map((r) => [r.pid, toCents(r.total)]));

  const expenses = await query(
    `SELECT id, amount FROM expenses WHERE event_id = ? ORDER BY id ASC`,
    [eventId]
  );
  const splitRows = await query(
    `SELECT es.expense_id, es.event_participant_id
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.event_id = ?
     ORDER BY es.id ASC`,
    [eventId]
  );
  const splitsByExpense = new Map();
  for (const r of splitRows) {
    if (!splitsByExpense.has(r.expense_id)) splitsByExpense.set(r.expense_id, []);
    splitsByExpense.get(r.expense_id).push(r.event_participant_id);
  }

  const owedMap = new Map();
  for (const exp of expenses) {
    const totalCents = toCents(exp.amount);
    const splits = splitsByExpense.get(exp.id) ?? [];
    if (splits.length === 0) continue;
    const baseShare = Math.floor(totalCents / splits.length);
    const remainder = totalCents - baseShare * splits.length;
    splits.forEach((pid, i) => {
      const share = baseShare + (i < remainder ? 1 : 0);
      owedMap.set(pid, (owedMap.get(pid) ?? 0) + share);
    });
  }

  return participants.map((p) => {
    const paid = paidMap.get(p.id) ?? 0;
    const owed = owedMap.get(p.id) ?? 0;
    const sent = sentMap.get(p.id) ?? 0;
    const received = receivedMap.get(p.id) ?? 0;
    return {
      participant_id: p.id,
      name: p.user_name ?? p.fictitious_name,
      type: p.user_id ? "registered" : "fictitious",
      role: p.role,
      paid_cents: paid,
      owed_cents: owed,
      sent_cents: sent,
      received_cents: received,
      balance_cents: paid - owed + sent - received,
    };
  });
}

export async function calculateEventBalances(eventId, requesterUserId) {
  if (!(await isParticipant(eventId, requesterUserId))) return null;
  const raw = await computeTotalsInCents(eventId);
  return raw.map((r) => ({
    participant_id: r.participant_id,
    name:           r.name,
    type:           r.type,
    role:           r.role,
    paid:           centsToAmount(r.paid_cents),
    owed:           centsToAmount(r.owed_cents),
    sent:           centsToAmount(r.sent_cents),
    received:       centsToAmount(r.received_cents),
    balance:        centsToAmount(r.balance_cents),
  }));
}

export async function calculateParticipantBalance(eventId, participantId, requesterUserId) {
  if (!(await isParticipant(eventId, requesterUserId))) return null;

  const all = await computeTotalsInCents(eventId);
  const summary = all.find((r) => r.participant_id === participantId);
  if (!summary) return null;

  const paidExpenses = await query(
    `SELECT e.id AS expense_id, e.description, e.expense_date,
            e.amount AS expense_total, ep.amount AS amount_paid
     FROM expense_payers ep
     JOIN expenses e ON e.id = ep.expense_id
     WHERE e.event_id = ? AND ep.event_participant_id = ?
     ORDER BY e.expense_date DESC, e.id DESC`,
    [eventId, participantId]
  );

  const owedRows = await query(
    `SELECT e.id AS expense_id, e.description, e.expense_date, e.amount AS expense_total
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.event_id = ? AND es.event_participant_id = ?
     ORDER BY e.expense_date DESC, e.id DESC`,
    [eventId, participantId]
  );

  const owedExpenses = [];
  for (const row of owedRows) {
    const splitParticipants = await query(
      `SELECT event_participant_id FROM expense_splits
       WHERE expense_id = ? ORDER BY id ASC`,
      [row.expense_id]
    );
    const pidList = splitParticipants.map((s) => s.event_participant_id);
    const totalCents = toCents(row.expense_total);
    const baseShare = Math.floor(totalCents / pidList.length);
    const remainder = totalCents - baseShare * pidList.length;
    const idx = pidList.indexOf(participantId);
    const shareCents = baseShare + (idx < remainder ? 1 : 0);
    owedExpenses.push({
      expense_id:    row.expense_id,
      description:   row.description,
      expense_date:  row.expense_date,
      expense_total: row.expense_total,
      share:         centsToAmount(shareCents),
    });
  }

  const sentMovements = await query(
    `SELECT m.id, m.type, m.amount, m.movement_date,
            u.name  AS other_user_name,
            fp.name AS other_fictitious_name
     FROM movements m
     JOIN event_participants other_ep ON other_ep.id = m.recipient_event_participant_id
     LEFT JOIN users u ON u.id = other_ep.user_id
     LEFT JOIN fictitious_participants fp ON fp.id = other_ep.fictitious_participant_id
     WHERE m.event_id = ? AND m.sender_event_participant_id = ?
     ORDER BY m.movement_date DESC, m.id DESC`,
    [eventId, participantId]
  );

  const receivedMovements = await query(
    `SELECT m.id, m.type, m.amount, m.movement_date,
            u.name  AS other_user_name,
            fp.name AS other_fictitious_name
     FROM movements m
     JOIN event_participants other_ep ON other_ep.id = m.sender_event_participant_id
     LEFT JOIN users u ON u.id = other_ep.user_id
     LEFT JOIN fictitious_participants fp ON fp.id = other_ep.fictitious_participant_id
     WHERE m.event_id = ? AND m.recipient_event_participant_id = ?
     ORDER BY m.movement_date DESC, m.id DESC`,
    [eventId, participantId]
  );

  return {
    participant: {
      id:   summary.participant_id,
      name: summary.name,
      type: summary.type,
      role: summary.role,
    },
    totals: {
      paid:     centsToAmount(summary.paid_cents),
      owed:     centsToAmount(summary.owed_cents),
      sent:     centsToAmount(summary.sent_cents),
      received: centsToAmount(summary.received_cents),
      balance:  centsToAmount(summary.balance_cents),
    },
    detail: {
      paid_expenses: paidExpenses,
      owed_expenses: owedExpenses,
      sent_movements: sentMovements.map((m) => ({
        id:               m.id,
        type:             m.type,
        amount:           m.amount,
        movement_date:    m.movement_date,
        other_party_name: m.other_user_name ?? m.other_fictitious_name,
      })),
      received_movements: receivedMovements.map((m) => ({
        id:               m.id,
        type:             m.type,
        amount:           m.amount,
        movement_date:    m.movement_date,
        other_party_name: m.other_user_name ?? m.other_fictitious_name,
      })),
    },
  };
}
