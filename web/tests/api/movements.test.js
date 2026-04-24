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
  POST as createMovementRoute,
  GET as listMovementsRoute,
} from "@/app/api/events/[id]/movements/route";
import {
  GET as getMovementRoute,
  DELETE as deleteMovementRoute,
} from "@/app/api/events/[id]/movements/[movementId]/route";

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

function createMovementPayload({
  type = "transfer",
  sender_participant_id,
  recipient_participant_id,
  amount = 50,
  movement_date = "2026-04-20",
  bank,
  note,
}) {
  return {
    type,
    sender_participant_id,
    recipient_participant_id,
    amount,
    movement_date,
    bank,
    note,
  };
}

function postMovement(eventId, payload) {
  return createMovementRoute(
    jsonReq(
      `http://localhost/api/events/${eventId}/movements`,
      "POST",
      createMovementPayload(payload)
    ),
    { params: Promise.resolve({ id: String(eventId) }) }
  );
}

beforeEach(() => {
  auth.mockReset();
});

describe("POST /api/events/[id]/movements", () => {
  test("registered participant (non-admin) can register a movement and creator is stored", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(member);
    const res = await postMovement(event.id, {
      sender_participant_id: memberPid,
      recipient_participant_id: adminPid,
      amount: 100,
      bank: "Nequi",
      note: "Split lunch",
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.type).toBe("transfer");
    expect(Number(created.amount)).toBe(100);
    expect(created.sender.participant_id).toBe(memberPid);
    expect(created.recipient.participant_id).toBe(adminPid);
    expect(created.bank).toBe("Nequi");
    expect(created.note).toBe("Split lunch");
    expect(created.created_by_event_participant_id).toBe(memberPid);
    expect(created.created_by.participant_id).toBe(memberPid);
    expect(created.created_by.name).toBe(member.name);
  });

  test("accepts movements between two fictitious participants", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const ghostA = await addFictitious(admin, event.id, "Alice");
    const ghostB = await addFictitious(admin, event.id, "Bob");

    asUser(admin);
    const res = await postMovement(event.id, {
      type: "loan",
      sender_participant_id: ghostA.id,
      recipient_participant_id: ghostB.id,
      amount: 25,
    });
    expect(res.status).toBe(201);
  });

  test("rejects sender equal to recipient", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);

    asUser(admin);
    const res = await postMovement(event.id, {
      sender_participant_id: adminPid,
      recipient_participant_id: adminPid,
      amount: 10,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("sender_equals_recipient");
  });

  test("rejects participants not belonging to the event", async () => {
    const admin = await createTestUser();
    const other = await createTestUser();
    const eventA = await newEventFor(admin);
    const eventB = await newEventFor(other, "Other");
    const adminPid = await participantIdFor(admin.id, eventA.id);
    const otherPid = await participantIdFor(other.id, eventB.id);

    asUser(admin);
    const res = await postMovement(eventA.id, {
      sender_participant_id: adminPid,
      recipient_participant_id: otherPid,
      amount: 10,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("participant_not_in_event");
  });

  test("rejects invalid type", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(admin);
    const res = await postMovement(event.id, {
      type: "gift",
      sender_participant_id: adminPid,
      recipient_participant_id: memberPid,
      amount: 10,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_type");
  });

  test("rejects non-participants of the event", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const ghost = await addFictitious(admin, event.id, "Ghost");

    asUser(stranger);
    const res = await postMovement(event.id, {
      sender_participant_id: adminPid,
      recipient_participant_id: ghost.id,
      amount: 10,
    });
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated requests", async () => {
    asAnonymous();
    const res = await postMovement(1, {
      sender_participant_id: 1,
      recipient_participant_id: 2,
      amount: 10,
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/events/[id]/movements", () => {
  test("lists movements newest first", async () => {
    const admin = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const ghost = await addFictitious(admin, event.id, "Ghost");

    asUser(admin);
    await postMovement(event.id, {
      sender_participant_id: adminPid,
      recipient_participant_id: ghost.id,
      amount: 10,
      movement_date: "2026-01-10",
    });
    await postMovement(event.id, {
      sender_participant_id: adminPid,
      recipient_participant_id: ghost.id,
      amount: 20,
      movement_date: "2026-05-01",
    });

    const res = await listMovementsRoute(
      new Request(`http://localhost/api/events/${event.id}/movements`),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.map((m) => Number(m.amount))).toEqual([20, 10]);
  });

  test("non-participant gets 404", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await newEventFor(admin);

    asUser(stranger);
    const res = await listMovementsRoute(
      new Request(`http://localhost/api/events/${event.id}/movements`),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/events/[id]/movements/[movementId]", () => {
  test("returns full detail including the creator's name", async () => {
    const admin = await createTestUser({ name: "Admin Anna" });
    const member = await createTestUser({ name: "Member Mike" });
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(member);
    const created = await (
      await postMovement(event.id, {
        sender_participant_id: memberPid,
        recipient_participant_id: adminPid,
        amount: 15,
      })
    ).json();

    asUser(admin);
    const res = await getMovementRoute(
      new Request(`http://localhost/api/events/${event.id}/movements/${created.id}`),
      { params: Promise.resolve({ id: String(event.id), movementId: String(created.id) }) }
    );
    expect(res.status).toBe(200);
    const detail = await res.json();
    expect(detail.created_by.name).toBe("Member Mike");
    expect(detail.sender.name).toBe("Member Mike");
    expect(detail.recipient.name).toBe("Admin Anna");
  });
});

describe("DELETE /api/events/[id]/movements/[movementId]", () => {
  test("admin can delete", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(member);
    const created = await (
      await postMovement(event.id, {
        sender_participant_id: memberPid,
        recipient_participant_id: adminPid,
        amount: 10,
      })
    ).json();

    asUser(admin);
    const res = await deleteMovementRoute(
      new Request(`http://localhost/api/events/${event.id}/movements/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(event.id), movementId: String(created.id) }) }
    );
    expect(res.status).toBe(204);
    const rows = await query(`SELECT id FROM movements WHERE id = ?`, [created.id]);
    expect(rows).toHaveLength(0);
  });

  test("creator (non-admin) cannot delete their own movement (SR-31)", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const event = await newEventFor(admin);
    const adminPid = await participantIdFor(admin.id, event.id);
    const memberPid = await joinAs(member, event.code);

    asUser(member);
    const created = await (
      await postMovement(event.id, {
        sender_participant_id: memberPid,
        recipient_participant_id: adminPid,
        amount: 10,
      })
    ).json();

    const res = await deleteMovementRoute(
      new Request(`http://localhost/api/events/${event.id}/movements/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(event.id), movementId: String(created.id) }) }
    );
    expect(res.status).toBe(403);
  });
});
