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
import { GET as getParticipantBalanceRoute } from "@/app/api/events/[id]/balance/[participantId]/route";

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

async function fetchBalances(user, eventId) {
  asUser(user);
  const res = await getBalancesRoute(
    new Request(`http://localhost/api/events/${eventId}/balance`),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  return res.json();
}

async function fetchParticipantBalance(user, eventId, participantId) {
  asUser(user);
  const res = await getParticipantBalanceRoute(
    new Request(`http://localhost/api/events/${eventId}/balance/${participantId}`),
    { params: Promise.resolve({ id: String(eventId), participantId: String(participantId) }) }
  );
  return res.json();
}

function expectSumZero(balances) {
  const totalCents = balances.reduce(
    (acc, b) => acc + Math.round(Number(b.balance) * 100),
    0
  );
  expect(totalCents).toBe(0);
}

beforeEach(() => {
  auth.mockReset();
});

describe("GET /api/events/[id]/balance", () => {
  test("single expense paid by one, split among all", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
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

    const balances = await fetchBalances(admin, event.id);
    const byPid = Object.fromEntries(balances.map((b) => [b.participant_id, b]));
    expect(Number(byPid[adminPid].balance)).toBe(50);
    expect(Number(byPid[memberPid].balance)).toBe(-50);
    expectSumZero(balances);
  });

  test("remainder is distributed to the first splitters in insertion order", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const ghostA = await addFictitious(admin, event.id, "A");
    const ghostB = await addFictitious(admin, event.id, "B");

    // 100 / 3 = 33.33 × 3 = 99.99, 1 cent remainder → goes to first splitter
    await registerExpense(admin, event.id, {
      description: "Uneven",
      amount: 100,
      expense_date: "2026-04-20",
      payers: [{ participant_id: adminPid, amount: 100 }],
      split_participant_ids: [adminPid, ghostA, ghostB],
    });

    const balances = await fetchBalances(admin, event.id);
    const byPid = Object.fromEntries(balances.map((b) => [b.participant_id, b]));
    // Admin paid 100, owes 33.34 → balance = 66.66
    // Ghost A owes 33.33 → balance = -33.33
    // Ghost B owes 33.33 → balance = -33.33
    expect(byPid[adminPid].owed).toBe("33.34");
    expect(byPid[ghostA].owed).toBe("33.33");
    expect(byPid[ghostB].owed).toBe("33.33");
    expect(Number(byPid[adminPid].balance)).toBeCloseTo(66.66, 2);
    expectSumZero(balances);
  });

  test("balance after a settling transfer is exactly zero", async () => {
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
    // Member owes 30; sends 30 to admin to settle
    await registerMovement(member, event.id, {
      type: "transfer",
      sender_participant_id: memberPid,
      recipient_participant_id: adminPid,
      amount: 30,
      movement_date: "2026-04-21",
    });

    const balances = await fetchBalances(admin, event.id);
    for (const b of balances) {
      expect(Number(b.balance)).toBe(0);
    }
    expectSumZero(balances);
  });

  test("a loan behaves identically to a transfer for balance math (sender +, receiver −)", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    await registerMovement(admin, event.id, {
      type: "loan",
      sender_participant_id: adminPid,
      recipient_participant_id: memberPid,
      amount: 100,
      movement_date: "2026-04-21",
    });

    const balances = await fetchBalances(admin, event.id);
    const byPid = Object.fromEntries(balances.map((b) => [b.participant_id, b]));
    expect(Number(byPid[adminPid].balance)).toBe(100);
    expect(Number(byPid[memberPid].balance)).toBe(-100);
    expectSumZero(balances);
  });

  test("SR-35: sum of balances is always zero regardless of mix of expenses/movements", async () => {
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
        { participant_id: m1Pid, amount: 27 },
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
    expectSumZero(balances);
  });

  test("non-participant gets 404", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await newEventFor(admin);

    asUser(stranger);
    const res = await getBalancesRoute(
      new Request(`http://localhost/api/events/${event.id}/balance`),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/events/[id]/balance/[participantId]", () => {
  test("returns totals and detail lists with the correct share", async () => {
    const admin = await createTestUser({ name: "Admin Anna" });
    const member = await createTestUser({ name: "Member Mike" });
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);
    const ghost = await addFictitious(admin, event.id, "Ghost");

    // Expense: admin paid 100, split 3 ways (100/3 = 33.34, 33.33, 33.33 — admin first gets the extra cent)
    await registerExpense(admin, event.id, {
      description: "Hotel",
      amount: 100,
      expense_date: "2026-04-20",
      payers: [{ participant_id: adminPid, amount: 100 }],
      split_participant_ids: [adminPid, memberPid, ghost],
    });
    // Member sends 33.33 to admin
    await registerMovement(member, event.id, {
      type: "transfer",
      sender_participant_id: memberPid,
      recipient_participant_id: adminPid,
      amount: 33.33,
      movement_date: "2026-04-21",
    });

    const detail = await fetchParticipantBalance(admin, event.id, memberPid);
    expect(detail.participant.name).toBe("Member Mike");
    expect(detail.totals.paid).toBe("0.00");
    expect(detail.totals.owed).toBe("33.33");
    expect(detail.totals.sent).toBe("33.33");
    expect(detail.totals.received).toBe("0.00");
    expect(detail.totals.balance).toBe("0.00");

    expect(detail.detail.paid_expenses).toHaveLength(0);
    expect(detail.detail.owed_expenses).toHaveLength(1);
    expect(detail.detail.owed_expenses[0].share).toBe("33.33");
    expect(detail.detail.sent_movements).toHaveLength(1);
    expect(detail.detail.sent_movements[0].other_party_name).toBe("Admin Anna");
    expect(detail.detail.received_movements).toHaveLength(0);
  });
});
