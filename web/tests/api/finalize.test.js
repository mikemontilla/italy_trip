import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { query } from "@/lib/db";
import { createTestUser } from "../helpers";
import { POST as createEventRoute } from "@/app/api/events/route";
import { POST as joinEventRoute } from "@/app/api/events/join/route";
import { POST as addParticipantRoute } from "@/app/api/events/[id]/participants/route";
import {
  POST as createExpenseRoute,
} from "@/app/api/events/[id]/expenses/route";
import {
  DELETE as deleteExpenseRoute,
} from "@/app/api/events/[id]/expenses/[expenseId]/route";
import {
  POST as createMovementRoute,
} from "@/app/api/events/[id]/movements/route";
import {
  DELETE as deleteMovementRoute,
} from "@/app/api/events/[id]/movements/[movementId]/route";
import { PATCH as finalizeRoute } from "@/app/api/events/[id]/finalize/route";
import { PATCH as reopenRoute } from "@/app/api/events/[id]/reopen/route";

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
  return { status: res.status, body: await res.json() };
}

async function registerMovement(actor, eventId, payload) {
  asUser(actor);
  const res = await createMovementRoute(
    jsonReq(`http://localhost/api/events/${eventId}/movements`, "POST", payload),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  return { status: res.status, body: await res.json() };
}

async function finalize(user, eventId) {
  asUser(user);
  const res = await finalizeRoute(
    new Request(`http://localhost/api/events/${eventId}/finalize`, { method: "PATCH" }),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  const body = res.status === 204 ? null : await res.json();
  return { status: res.status, body };
}

async function reopen(user, eventId) {
  asUser(user);
  const res = await reopenRoute(
    new Request(`http://localhost/api/events/${eventId}/reopen`, { method: "PATCH" }),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
  const body = res.status === 204 ? null : await res.json();
  return { status: res.status, body };
}

async function settleEvent(admin, member, event, adminPid, memberPid) {
  // Helper: creates a 60 expense paid by admin and split equally, then a 30 transfer
  // back from the member, leaving every balance at zero.
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
}

beforeEach(() => {
  auth.mockReset();
});

describe("PATCH /api/events/[id]/finalize", () => {
  test("admin can finalize when every balance is zero", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);
    await settleEvent(admin, member, event, adminPid, memberPid);

    const { status, body } = await finalize(admin, event.id);
    expect(status).toBe(200);
    expect(body.status).toBe("finalized");
    expect(body.finalized_at).toBeTruthy();
  });

  test("admin can finalize when every balance is within ±1 peso of zero", async () => {
    const admin = await createTestUser();
    const m1 = await createTestUser();
    const m2 = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const m1Pid = await joinAs(m1, event.code);
    const m2Pid = await joinAs(m2, event.code);

    // 100 split 3 ways: admin owes 33.34, m1 owes 33.33, m2 owes 33.33 (admin gets the extra cent).
    await registerExpense(admin, event.id, {
      description: "Hotel",
      amount: 100,
      expense_date: "2026-04-20",
      payers: [{ participant_id: adminPid, amount: 100 }],
      split_participant_ids: [adminPid, m1Pid, m2Pid],
    });
    // m1 over-pays by 1 cent (33.34 instead of the 33.33 they owe).
    await registerMovement(m1, event.id, {
      type: "transfer",
      sender_participant_id: m1Pid,
      recipient_participant_id: adminPid,
      amount: 33.34,
      movement_date: "2026-04-21",
    });
    await registerMovement(m2, event.id, {
      type: "transfer",
      sender_participant_id: m2Pid,
      recipient_participant_id: adminPid,
      amount: 33.33,
      movement_date: "2026-04-21",
    });
    // After this: admin = -1 cent, m1 = +1 cent, m2 = 0. All within tolerance.

    const { status, body } = await finalize(admin, event.id);
    expect(status).toBe(200);
    expect(body.status).toBe("finalized");
  });

  test("returns 409 when at least one balance is not zero", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    await registerExpense(admin, event.id, {
      description: "Hotel",
      amount: 100,
      expense_date: "2026-04-20",
      payers: [{ participant_id: adminPid, amount: 100 }],
      split_participant_ids: [adminPid, memberPid],
    });

    const { status, body } = await finalize(admin, event.id);
    expect(status).toBe(409);
    expect(body.error).toBe("balance_not_zero");
  });

  test("returns 409 when the event is already finalized", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    // Solo admin, no expenses → balance trivially zero
    await finalize(admin, event.id);

    const { status, body } = await finalize(admin, event.id);
    expect(status).toBe(409);
    expect(body.error).toBe("already_finalized");
  });

  test("non-admin participant gets 403", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    await joinAs(member, event.code);

    const { status, body } = await finalize(member, event.id);
    expect(status).toBe(403);
    expect(body.error).toBe("forbidden");
  });

  test("non-participant gets 404", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await newEventFor(admin);

    const { status } = await finalize(stranger, event.id);
    expect(status).toBe(404);
  });

  test("unauthenticated request gets 401", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);

    auth.mockResolvedValue(null);
    const res = await finalizeRoute(
      new Request(`http://localhost/api/events/${event.id}/finalize`, { method: "PATCH" }),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(401);
  });
});

describe("Mutations are blocked on a finalized event", () => {
  async function setupFinalized() {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);
    await settleEvent(admin, member, event, adminPid, memberPid);

    // Capture an expense and a movement id for later delete attempts
    const [expRow] = await query(`SELECT id FROM expenses WHERE event_id = ?`, [event.id]);
    const [mvRow]  = await query(`SELECT id FROM movements WHERE event_id = ?`, [event.id]);

    await finalize(admin, event.id);
    return { admin, member, event, adminPid, memberPid, expenseId: expRow.id, movementId: mvRow.id };
  }

  test("admin cannot create an expense on a finalized event", async () => {
    const { admin, event, adminPid, memberPid } = await setupFinalized();
    const { status, body } = await registerExpense(admin, event.id, {
      description: "Breakfast",
      amount: 20,
      expense_date: "2026-04-22",
      payers: [{ participant_id: adminPid, amount: 20 }],
      split_participant_ids: [adminPid, memberPid],
    });
    expect(status).toBe(409);
    expect(body.error).toBe("event_finalized");
  });

  test("admin cannot delete an expense on a finalized event", async () => {
    const { admin, event, expenseId } = await setupFinalized();
    asUser(admin);
    const res = await deleteExpenseRoute(
      new Request(`http://localhost/api/events/${event.id}/expenses/${expenseId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: String(event.id), expenseId: String(expenseId) }) }
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("event_finalized");
  });

  test("admin cannot create a movement on a finalized event", async () => {
    const { admin, event, adminPid, memberPid } = await setupFinalized();
    const { status, body } = await registerMovement(admin, event.id, {
      type: "loan",
      sender_participant_id: adminPid,
      recipient_participant_id: memberPid,
      amount: 5,
      movement_date: "2026-04-22",
    });
    expect(status).toBe(409);
    expect(body.error).toBe("event_finalized");
  });

  test("admin cannot delete a movement on a finalized event", async () => {
    const { admin, event, movementId } = await setupFinalized();
    asUser(admin);
    const res = await deleteMovementRoute(
      new Request(`http://localhost/api/events/${event.id}/movements/${movementId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: String(event.id), movementId: String(movementId) }) }
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("event_finalized");
  });

  test("admin cannot add a fictitious participant on a finalized event", async () => {
    const { admin, event } = await setupFinalized();
    asUser(admin);
    const res = await addParticipantRoute(
      jsonReq(`http://localhost/api/events/${event.id}/participants`, "POST", {
        type: "fictitious",
        name: "Latecomer",
      }),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("event_finalized");
  });

  test("a stranger cannot join via code on a finalized event", async () => {
    const { event } = await setupFinalized();
    const stranger = await createTestUser();
    asUser(stranger);
    const res = await joinEventRoute(
      jsonReq("http://localhost/api/events/join", "POST", { code: event.code })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("event_finalized");
  });
});

describe("PATCH /api/events/[id]/reopen", () => {
  test("admin can reopen a finalized event and mutations work again", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);
    await settleEvent(admin, member, event, adminPid, memberPid);
    await finalize(admin, event.id);

    const { status, body } = await reopen(admin, event.id);
    expect(status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.finalized_at).toBeNull();

    // Mutation works again
    const { status: expStatus } = await registerExpense(admin, event.id, {
      description: "Brunch",
      amount: 10,
      expense_date: "2026-04-23",
      payers: [{ participant_id: adminPid, amount: 10 }],
      split_participant_ids: [adminPid, memberPid],
    });
    expect(expStatus).toBe(201);
  });

  test("returns 409 when event is already active", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);

    const { status, body } = await reopen(admin, event.id);
    expect(status).toBe(409);
    expect(body.error).toBe("not_finalized");
  });

  test("non-admin participant gets 403", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    await joinAs(member, event.code);
    await finalize(admin, event.id);

    const { status, body } = await reopen(member, event.id);
    expect(status).toBe(403);
    expect(body.error).toBe("forbidden");
  });

  test("non-participant gets 404", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await newEventFor(admin);
    await finalize(admin, event.id);

    const { status } = await reopen(stranger, event.id);
    expect(status).toBe(404);
  });
});
