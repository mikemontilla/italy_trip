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
import {
  POST as createExpenseRoute,
  GET as listExpensesRoute,
} from "@/app/api/events/[id]/expenses/route";
import {
  GET as getExpenseRoute,
  DELETE as deleteExpenseRoute,
} from "@/app/api/events/[id]/expenses/[expenseId]/route";

function asUser(user) {
  auth.mockResolvedValue({ user: { dbUserId: user.id } });
}

function asAnonymous() {
  auth.mockResolvedValue(null);
}

function jsonReq(url, method, body) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function newEventFor(user, name = "Trip") {
  asUser(user);
  const res = await createEventRoute(jsonReq("http://localhost/api/events", "POST", { name }));
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

function createExpensePayload({
  description = "Pizza",
  amount = 100,
  expense_date = "2026-04-20",
  payers,
  split_participant_ids,
}) {
  return { description, amount, expense_date, payers, split_participant_ids };
}

function postExpense(eventId, payload) {
  return createExpenseRoute(
    jsonReq(
      `http://localhost/api/events/${eventId}/expenses`,
      "POST",
      createExpensePayload(payload)
    ),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
}

beforeEach(() => {
  auth.mockReset();
});

describe("POST /api/events/[id]/expenses", () => {
  test("a registered participant (non-admin) can create an expense", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(member);
    const res = await postExpense(event.id, {
      amount: 120,
      payers: [{ participant_id: memberPid, amount: 120 }],
      split_participant_ids: [adminPid, memberPid],
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.description).toBe("Pizza");
    expect(Number(created.amount)).toBe(120);
    expect(created.created_by_event_participant_id).toBe(memberPid);
    expect(created.payers).toHaveLength(1);
    expect(created.splits).toHaveLength(2);
  });

  test("supports multiple payers with manual amounts summing to total", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(admin);
    const res = await postExpense(event.id, {
      amount: 100,
      payers: [
        { participant_id: adminPid, amount: 70 },
        { participant_id: memberPid, amount: 30 },
      ],
      split_participant_ids: [adminPid, memberPid],
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    const amounts = created.payers.map((p) => Number(p.amount)).sort();
    expect(amounts).toEqual([30, 70]);
  });

  test("rejects when payer amounts do not sum to total", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);

    asUser(admin);
    const res = await postExpense(event.id, {
      amount: 100,
      payers: [{ participant_id: adminPid, amount: 90 }],
      split_participant_ids: [adminPid],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("payers_sum_mismatch");
  });

  test("rejects when a payer is not a participant of the event", async () => {
    const admin = await createTestUser();
    const other = await createTestUser();
    const eventA = await newEventFor(admin);
    const eventB = await newEventFor(other, "Other");
    const otherPid = await participantIdFor(other.id, eventB.id);
    const adminPid = await participantIdFor(admin.id, eventA.id);

    asUser(admin);
    const res = await postExpense(eventA.id, {
      amount: 50,
      payers: [{ participant_id: otherPid, amount: 50 }],
      split_participant_ids: [adminPid],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("participant_not_in_event");
  });

  test("rejects when caller is not a participant", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);

    asUser(stranger);
    const res = await postExpense(event.id, {
      amount: 50,
      payers: [{ participant_id: adminPid, amount: 50 }],
      split_participant_ids: [adminPid],
    });
    expect(res.status).toBe(403);
  });

  test("rejects invalid amount", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);

    asUser(admin);
    const res = await postExpense(event.id, {
      amount: 0,
      payers: [{ participant_id: adminPid, amount: 0 }],
      split_participant_ids: [adminPid],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("amount_invalid");
  });
});

describe("GET /api/events/[id]/expenses", () => {
  test("lists all expenses ordered by date desc, then id desc", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);

    asUser(admin);
    await postExpense(event.id, {
      description: "Older",
      amount: 10,
      expense_date: "2026-01-01",
      payers: [{ participant_id: adminPid, amount: 10 }],
      split_participant_ids: [adminPid],
    });
    await postExpense(event.id, {
      description: "Newer",
      amount: 20,
      expense_date: "2026-05-01",
      payers: [{ participant_id: adminPid, amount: 20 }],
      split_participant_ids: [adminPid],
    });

    const res = await listExpensesRoute(
      new Request(`http://localhost/api/events/${event.id}/expenses`),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.map((e) => e.description)).toEqual(["Newer", "Older"]);
  });

  test("filters by participant id (matches payer or splitter)", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(admin);
    // Expense A: only admin involved
    await postExpense(event.id, {
      description: "Admin-only",
      amount: 10,
      payers: [{ participant_id: adminPid, amount: 10 }],
      split_participant_ids: [adminPid],
    });
    // Expense B: admin paid, member shared
    await postExpense(event.id, {
      description: "Shared",
      amount: 20,
      payers: [{ participant_id: adminPid, amount: 20 }],
      split_participant_ids: [adminPid, memberPid],
    });

    const res = await listExpensesRoute(
      new Request(`http://localhost/api/events/${event.id}/expenses?participant=${memberPid}`),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    const list = await res.json();
    expect(list.map((e) => e.description)).toEqual(["Shared"]);
  });

  test("non-participant gets 404", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await newEventFor(admin);

    asUser(stranger);
    const res = await listExpensesRoute(
      new Request(`http://localhost/api/events/${event.id}/expenses`),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/events/[id]/expenses/[expenseId]", () => {
  test("returns full detail including fictitious participant names", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const fake = await addFictitious(admin, event.id, "Ghost");
    const fakePid = fake.id;

    asUser(admin);
    const created = await (
      await postExpense(event.id, {
        amount: 30,
        payers: [{ participant_id: adminPid, amount: 30 }],
        split_participant_ids: [adminPid, fakePid],
      })
    ).json();

    const res = await getExpenseRoute(
      new Request(`http://localhost/api/events/${event.id}/expenses/${created.id}`),
      { params: Promise.resolve({ id: String(event.id), expenseId: String(created.id) }) }
    );
    expect(res.status).toBe(200);
    const detail = await res.json();
    const splitNames = detail.splits.map((s) => s.name).sort();
    expect(splitNames).toContain("Ghost");
  });
});

describe("DELETE /api/events/[id]/expenses/[expenseId]", () => {
  test("creator (non-admin) can delete their own expense", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(member);
    const created = await (
      await postExpense(event.id, {
        amount: 10,
        payers: [{ participant_id: memberPid, amount: 10 }],
        split_participant_ids: [adminPid, memberPid],
      })
    ).json();

    const res = await deleteExpenseRoute(
      new Request(`http://localhost/api/events/${event.id}/expenses/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(event.id), expenseId: String(created.id) }) }
    );
    expect(res.status).toBe(204);

    const rows = await query(`SELECT id FROM expenses WHERE id = ?`, [created.id]);
    expect(rows).toHaveLength(0);
  });

  test("admin can delete an expense created by another participant", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(member);
    const created = await (
      await postExpense(event.id, {
        amount: 10,
        payers: [{ participant_id: memberPid, amount: 10 }],
        split_participant_ids: [memberPid],
      })
    ).json();

    asUser(admin);
    const res = await deleteExpenseRoute(
      new Request(`http://localhost/api/events/${event.id}/expenses/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(event.id), expenseId: String(created.id) }) }
    );
    expect(res.status).toBe(204);
  });

  test("another participant (non-admin, non-creator) cannot delete", async () => {
    const admin = await createTestUser();
    const m1 = await createTestUser();
    const m2 = await createTestUser();
    const event = await newEventFor(admin);
    const m1Pid = await joinAs(m1, event.code);
    await joinAs(m2, event.code);

    asUser(m1);
    const created = await (
      await postExpense(event.id, {
        amount: 10,
        payers: [{ participant_id: m1Pid, amount: 10 }],
        split_participant_ids: [m1Pid],
      })
    ).json();

    asUser(m2);
    const res = await deleteExpenseRoute(
      new Request(`http://localhost/api/events/${event.id}/expenses/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(event.id), expenseId: String(created.id) }) }
    );
    expect(res.status).toBe(403);
  });
});
