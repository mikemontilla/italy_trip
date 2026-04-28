import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { query } from "@/lib/db";
import { createTestUser } from "../helpers";
import { POST as createEventRoute } from "@/app/api/events/route";
import { POST as addParticipantRoute } from "@/app/api/events/[id]/participants/route";
import { POST as joinEventRoute } from "@/app/api/events/join/route";
import { POST as createExpenseRoute } from "@/app/api/events/[id]/expenses/route";
import { POST as createMovementRoute } from "@/app/api/events/[id]/movements/route";
import { GET as getBalancesRoute } from "@/app/api/events/[id]/balance/route";
import { GET as getSettlementRoute } from "@/app/api/events/[id]/settlement/route";

function asUser(user) {
  auth.mockResolvedValue({ user: { dbUserId: user.id } });
}

function jsonReq(url, method, body) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function newEventFor(user) {
  asUser(user);
  const res = await createEventRoute(jsonReq("http://localhost/api/events", "POST", { name: "Trip" }));
  return res.json();
}

async function addFictitious(admin, eventId, name) {
  asUser(admin);
  const res = await addParticipantRoute(
    jsonReq(`http://localhost/api/events/${eventId}/participants`, "POST", {
      type: "fictitious",
      name,
    }),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  return (await res.json()).id;
}

async function joinAs(user, code) {
  asUser(user);
  await joinEventRoute(jsonReq("http://localhost/api/events/join", "POST", { code }));
  const [row] = await query(
    `SELECT id FROM event_participants
     WHERE user_id = ? AND event_id = (SELECT id FROM events WHERE code = ?)`,
    [user.id, code]
  );
  return row.id;
}

async function participantIdFor(userId, eventId) {
  const [row] = await query(
    `SELECT id FROM event_participants WHERE user_id = ? AND event_id = ?`,
    [userId, eventId]
  );
  return row.id;
}

async function registerExpense(actor, eventId, payload) {
  asUser(actor);
  const res = await createExpenseRoute(
    jsonReq(`http://localhost/api/events/${eventId}/expenses`, "POST", payload),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  return res.json();
}

async function registerMovement(actor, eventId, payload) {
  asUser(actor);
  const res = await createMovementRoute(
    jsonReq(`http://localhost/api/events/${eventId}/movements`, "POST", payload),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  return res.json();
}

async function fetchSettlement(user, eventId) {
  asUser(user);
  const res = await getSettlementRoute(
    new Request(`http://localhost/api/events/${eventId}/settlement`),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  return { status: res.status, body: await res.json() };
}

async function fetchBalances(user, eventId) {
  asUser(user);
  const res = await getBalancesRoute(
    new Request(`http://localhost/api/events/${eventId}/balance`),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  return res.json();
}

function applyTransfersToBalances(balances, transfers) {
  // balance += sent − received per the project convention.
  // Sender's balance goes UP (they gave money out), recipient's goes DOWN (they got money in).
  const map = new Map(
    balances.map((b) => [b.participant_id, Math.round(Number(b.balance) * 100)])
  );
  for (const t of transfers) {
    const amt = Math.round(Number(t.amount) * 100);
    map.set(t.from_participant_id, map.get(t.from_participant_id) + amt);
    map.set(t.to_participant_id,   map.get(t.to_participant_id)   - amt);
  }
  return [...map.values()];
}

beforeEach(() => {
  auth.mockReset();
});

describe("GET /api/events/[id]/settlement", () => {
  test("two participants, one owes the other → exactly 1 transfer in both options", async () => {
    const admin = await createTestUser({ name: "Anna" });
    const member = await createTestUser({ name: "Mike" });
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    await registerExpense(admin, event.id, {
      description: "Pizza",
      amount: 100,
      expense_date: "2026-04-20",
      payers: [{ participant_id: adminPid, amount: 100 }],
      split_participant_ids: [adminPid, memberPid],
    });

    const { status, body } = await fetchSettlement(admin, event.id);
    expect(status).toBe(200);

    for (const opt of [body.option1, body.option2]) {
      expect(opt.transfers).toHaveLength(1);
      expect(opt.transfers[0]).toMatchObject({
        from_participant_id: memberPid,
        to_participant_id:   adminPid,
        amount:              "50.00",
      });
      expect(opt.stats.transfer_count).toBe(1);
      expect(opt.stats.max_transfers_per_participant).toBe(1);
    }
  });

  test("one creditor with multiple small debtors → all debtors transfer to the creditor", async () => {
    const admin = await createTestUser({ name: "Anna" });
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const a = await addFictitious(admin, event.id, "A");
    const b = await addFictitious(admin, event.id, "B");
    const c = await addFictitious(admin, event.id, "C");

    // Admin pays 90, split 4 ways equally → each owes 22.50, admin balance +67.50
    await registerExpense(admin, event.id, {
      description: "Hotel",
      amount: 90,
      expense_date: "2026-04-20",
      payers: [{ participant_id: adminPid, amount: 90 }],
      split_participant_ids: [adminPid, a, b, c],
    });

    const { body } = await fetchSettlement(admin, event.id);

    for (const opt of [body.option1, body.option2]) {
      expect(opt.transfers).toHaveLength(3);
      for (const t of opt.transfers) {
        expect(t.to_participant_id).toBe(adminPid);
        expect(t.amount).toBe("22.50");
      }
      expect(opt.stats.transfer_count).toBe(3);
      // Admin participates in all 3, the others in 1 each
      expect(opt.stats.max_transfers_per_participant).toBe(3);
    }
  });

  test("balances [+50, +20, +10, −80] → option1 and option2 differ in ordering", async () => {
    const admin = await createTestUser({ name: "Anna" });
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const big = await addFictitious(admin, event.id, "Big");
    const small = await addFictitious(admin, event.id, "Small");
    const debtor = await addFictitious(admin, event.id, "Debtor");

    // Use loans to shape the balances directly.
    // Loan from admin to debtor 50 → admin +50, debtor −50
    await registerMovement(admin, event.id, {
      type: "loan",
      sender_participant_id: adminPid,
      recipient_participant_id: debtor,
      amount: 50,
      movement_date: "2026-04-20",
    });
    // Loan from big to debtor 20 → big +20, debtor −70
    await registerMovement(admin, event.id, {
      type: "loan",
      sender_participant_id: big,
      recipient_participant_id: debtor,
      amount: 20,
      movement_date: "2026-04-20",
    });
    // Loan from small to debtor 10 → small +10, debtor −80
    await registerMovement(admin, event.id, {
      type: "loan",
      sender_participant_id: small,
      recipient_participant_id: debtor,
      amount: 10,
      movement_date: "2026-04-20",
    });

    const { body } = await fetchSettlement(admin, event.id);

    // Option 1 (creditors DESC): debtor pays admin 50, big 20, small 10
    const o1 = body.option1.transfers;
    expect(o1).toHaveLength(3);
    expect(o1[0]).toMatchObject({ from_participant_id: debtor, to_participant_id: adminPid, amount: "50.00" });
    expect(o1[1]).toMatchObject({ from_participant_id: debtor, to_participant_id: big,      amount: "20.00" });
    expect(o1[2]).toMatchObject({ from_participant_id: debtor, to_participant_id: small,    amount: "10.00" });

    // Option 2 (creditors ASC): debtor pays small 10, big 20, admin 50
    const o2 = body.option2.transfers;
    expect(o2).toHaveLength(3);
    expect(o2[0]).toMatchObject({ from_participant_id: debtor, to_participant_id: small,    amount: "10.00" });
    expect(o2[1]).toMatchObject({ from_participant_id: debtor, to_participant_id: big,      amount: "20.00" });
    expect(o2[2]).toMatchObject({ from_participant_id: debtor, to_participant_id: adminPid, amount: "50.00" });

    // Both are valid (different orderings) — and the multiset of transfers is the same here.
  });

  test("expense with a cent remainder still settles to exactly zero", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const a = await addFictitious(admin, event.id, "A");
    const b = await addFictitious(admin, event.id, "B");

    // 100 split 3 ways: admin owes 33.34, a owes 33.33, b owes 33.33
    await registerExpense(admin, event.id, {
      description: "Uneven",
      amount: 100,
      expense_date: "2026-04-20",
      payers: [{ participant_id: adminPid, amount: 100 }],
      split_participant_ids: [adminPid, a, b],
    });

    const balances = await fetchBalances(admin, event.id);
    const { body } = await fetchSettlement(admin, event.id);

    for (const opt of [body.option1, body.option2]) {
      const after = applyTransfersToBalances(balances, opt.transfers);
      for (const cents of after) expect(cents).toBe(0);
    }
  });

  test("invariant: applying every transfer brings each balance exactly to zero", async () => {
    const admin = await createTestUser();
    const m1 = await createTestUser();
    const m2 = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const m1Pid = await joinAs(m1, event.code);
    const m2Pid = await joinAs(m2, event.code);
    const ghost = await addFictitious(admin, event.id, "Ghost");

    await registerExpense(admin, event.id, {
      description: "Dinner",
      amount: 77,
      expense_date: "2026-04-20",
      payers: [
        { participant_id: adminPid, amount: 50 },
        { participant_id: m1Pid,    amount: 27 },
      ],
      split_participant_ids: [adminPid, m1Pid, m2Pid, ghost],
    });
    await registerExpense(m1, event.id, {
      description: "Taxi",
      amount: 13,
      expense_date: "2026-04-20",
      payers: [{ participant_id: m1Pid, amount: 13 }],
      split_participant_ids: [adminPid, m1Pid, m2Pid],
    });
    await registerMovement(m2, event.id, {
      type: "transfer",
      sender_participant_id: m2Pid,
      recipient_participant_id: adminPid,
      amount: 15,
      movement_date: "2026-04-21",
    });
    await registerMovement(admin, event.id, {
      type: "loan",
      sender_participant_id: adminPid,
      recipient_participant_id: ghost,
      amount: 5,
      movement_date: "2026-04-21",
    });

    const balances = await fetchBalances(admin, event.id);
    const { body } = await fetchSettlement(admin, event.id);

    for (const opt of [body.option1, body.option2]) {
      const after = applyTransfersToBalances(balances, opt.transfers);
      for (const cents of after) expect(cents).toBe(0);
    }
  });

  test("all balances zero → both options return empty transfers", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    await registerExpense(admin, event.id, {
      description: "Lunch",
      amount: 60,
      expense_date: "2026-04-20",
      payers: [{ participant_id: adminPid, amount: 60 }],
      split_participant_ids: [adminPid, memberPid],
    });
    await registerMovement(member, event.id, {
      type: "transfer",
      sender_participant_id: memberPid,
      recipient_participant_id: adminPid,
      amount: 30,
      movement_date: "2026-04-21",
    });

    const { body } = await fetchSettlement(admin, event.id);
    expect(body.option1.transfers).toHaveLength(0);
    expect(body.option2.transfers).toHaveLength(0);
    expect(body.option1.stats.transfer_count).toBe(0);
    expect(body.option2.stats.transfer_count).toBe(0);
  });

  test("non-admin participant gets 403", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    await joinAs(member, event.code);

    const { status, body } = await fetchSettlement(member, event.id);
    expect(status).toBe(403);
    expect(body.error).toBe("forbidden");
  });

  test("non-participant gets 404", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await newEventFor(admin);

    const { status, body } = await fetchSettlement(stranger, event.id);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  test("unauthenticated request gets 401", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);

    auth.mockResolvedValue(null);
    const res = await getSettlementRoute(
      new Request(`http://localhost/api/events/${event.id}/settlement`),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(401);
  });
});
