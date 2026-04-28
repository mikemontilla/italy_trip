import { query } from "@/lib/db";
import { computeTotalsInCents, centsToAmount } from "@/lib/balances";

async function isAdmin(eventId, userId) {
  const rows = await query(
    `SELECT 1 FROM event_participants
     WHERE event_id = ? AND user_id = ? AND role = 'admin' LIMIT 1`,
    [eventId, userId]
  );
  return rows.length > 0;
}

async function isParticipant(eventId, userId) {
  const rows = await query(
    `SELECT 1 FROM event_participants
     WHERE event_id = ? AND user_id = ? LIMIT 1`,
    [eventId, userId]
  );
  return rows.length > 0;
}

function greedyMatch(creditors, debtors) {
  // Both arrays carry { participant_id, name, amount_cents }; debtor amount is positive (the magnitude of the debt).
  // Mutates copies, not the inputs.
  const cred = creditors.map((c) => ({ ...c }));
  const debt = debtors.map((d) => ({ ...d }));
  const transfers = [];
  const degree = new Map();
  let i = 0;
  let j = 0;
  while (i < cred.length && j < debt.length) {
    const c = cred[i];
    const d = debt[j];
    const amount = Math.min(c.amount_cents, d.amount_cents);
    transfers.push({
      from_participant_id: d.participant_id,
      from_name:           d.name,
      to_participant_id:   c.participant_id,
      to_name:             c.name,
      amount:              centsToAmount(amount),
    });
    degree.set(c.participant_id, (degree.get(c.participant_id) ?? 0) + 1);
    degree.set(d.participant_id, (degree.get(d.participant_id) ?? 0) + 1);
    c.amount_cents -= amount;
    d.amount_cents -= amount;
    if (c.amount_cents === 0) i += 1;
    if (d.amount_cents === 0) j += 1;
  }
  let maxDegree = 0;
  for (const v of degree.values()) if (v > maxDegree) maxDegree = v;
  return {
    transfers,
    stats: {
      transfer_count: transfers.length,
      max_transfers_per_participant: maxDegree,
    },
  };
}

export async function calculateSettlements(eventId, requesterUserId) {
  if (!(await isParticipant(eventId, requesterUserId))) return { error: "not_found" };
  if (!(await isAdmin(eventId, requesterUserId))) return { error: "forbidden" };

  const totals = await computeTotalsInCents(eventId);

  const creditors = [];
  const debtors = [];
  for (const t of totals) {
    if (t.balance_cents > 0) {
      creditors.push({ participant_id: t.participant_id, name: t.name, amount_cents: t.balance_cents });
    } else if (t.balance_cents < 0) {
      debtors.push({ participant_id: t.participant_id, name: t.name, amount_cents: -t.balance_cents });
    }
  }

  // Option 1 — "Saldar grandes primero": creditors DESC, debtors DESC by magnitude
  const cred1 = [...creditors].sort((a, b) => b.amount_cents - a.amount_cents);
  const debt1 = [...debtors].sort((a, b) => b.amount_cents - a.amount_cents);
  const option1 = greedyMatch(cred1, debt1);

  // Option 2 — "Liberar pequeños primero": creditors ASC, debtors DESC
  const cred2 = [...creditors].sort((a, b) => a.amount_cents - b.amount_cents);
  const debt2 = [...debtors].sort((a, b) => b.amount_cents - a.amount_cents);
  const option2 = greedyMatch(cred2, debt2);

  return { option1, option2 };
}
