import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { query } from "@/lib/db";
import { createTestUser } from "../helpers";
import { POST as createEvent } from "@/app/api/events/route";
import {
  GET as listParticipants,
  POST as addParticipant,
} from "@/app/api/events/[id]/participants/route";
import { POST as joinEvent } from "@/app/api/events/join/route";

function asUser(user) {
  auth.mockResolvedValue({ user: { dbUserId: user.id } });
}

function asAnonymous() {
  auth.mockResolvedValue(null);
}

function jsonRequest(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createOwnedEvent(user, name = "Trip") {
  asUser(user);
  const res = await createEvent(jsonRequest("http://localhost/api/events", { name }));
  return res.json();
}

function listRequest(eventId) {
  return new Request(`http://localhost/api/events/${eventId}/participants`);
}

function addRequest(eventId, body) {
  return jsonRequest(`http://localhost/api/events/${eventId}/participants`, body);
}

function joinRequest(body) {
  return jsonRequest("http://localhost/api/events/join", body);
}

beforeEach(() => {
  auth.mockReset();
});

describe("POST /api/events/[id]/participants (fictitious)", () => {
  test("admin can add a fictitious participant", async () => {
    const admin = await createTestUser();
    const event = await createOwnedEvent(admin);

    asUser(admin);
    const res = await addParticipant(
      addRequest(event.id, { type: "fictitious", name: "Uncle Bob" }),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.type).toBe("fictitious");
    expect(created.role).toBe("participant");
    expect(created.fictitious.name).toBe("Uncle Bob");

    const rows = await query(
      `SELECT name, event_id FROM fictitious_participants WHERE id = ?`,
      [created.fictitious.id]
    );
    expect(rows[0]).toMatchObject({ name: "Uncle Bob", event_id: event.id });
  });

  test("trims whitespace from the name", async () => {
    const admin = await createTestUser();
    const event = await createOwnedEvent(admin);

    asUser(admin);
    const res = await addParticipant(
      addRequest(event.id, { type: "fictitious", name: "   Alice   " }),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    const created = await res.json();
    expect(created.fictitious.name).toBe("Alice");
  });

  test("non-admin cannot add a fictitious participant", async () => {
    const admin = await createTestUser();
    const other = await createTestUser();
    const event = await createOwnedEvent(admin);

    // other joins as a plain participant
    asUser(other);
    await joinEvent(joinRequest({ code: event.code }));

    const res = await addParticipant(
      addRequest(event.id, { type: "fictitious", name: "Sneaky" }),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(403);
  });

  test("rejects missing name", async () => {
    const admin = await createTestUser();
    const event = await createOwnedEvent(admin);

    asUser(admin);
    const res = await addParticipant(
      addRequest(event.id, { type: "fictitious", name: "   " }),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("name_required");
  });

  test("rejects wrong type", async () => {
    const admin = await createTestUser();
    const event = await createOwnedEvent(admin);

    asUser(admin);
    const res = await addParticipant(
      addRequest(event.id, { type: "registered", email: "x@y.com" }),
      { params: Promise.resolve({ id: String(event.id) }) }
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_type");
  });
});

describe("GET /api/events/[id]/participants", () => {
  test("returns registered admin plus fictitious participants", async () => {
    const admin = await createTestUser({ name: "Admin Anna" });
    const event = await createOwnedEvent(admin);

    asUser(admin);
    await addParticipant(
      addRequest(event.id, { type: "fictitious", name: "Guest Greg" }),
      { params: Promise.resolve({ id: String(event.id) }) }
    );

    const res = await listParticipants(listRequest(event.id), {
      params: Promise.resolve({ id: String(event.id) }),
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toHaveLength(2);

    expect(list[0]).toMatchObject({
      type: "registered",
      role: "admin",
      user: { name: "Admin Anna" },
    });
    expect(list[1]).toMatchObject({
      type: "fictitious",
      role: "participant",
      fictitious: { name: "Guest Greg" },
    });
  });

  test("non-participant gets 404", async () => {
    const admin = await createTestUser();
    const stranger = await createTestUser();
    const event = await createOwnedEvent(admin);

    asUser(stranger);
    const res = await listParticipants(listRequest(event.id), {
      params: Promise.resolve({ id: String(event.id) }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/events/join", () => {
  test("joins a user to the event via code", async () => {
    const admin = await createTestUser();
    const joiner = await createTestUser();
    const event = await createOwnedEvent(admin);

    asUser(joiner);
    const res = await joinEvent(joinRequest({ code: event.code }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(event.id);
    expect(body.code).toBe(event.code);

    const rows = await query(
      `SELECT role FROM event_participants WHERE event_id = ? AND user_id = ?`,
      [event.id, joiner.id]
    );
    expect(rows[0].role).toBe("participant");
  });

  test("normalizes lowercase input to uppercase before lookup", async () => {
    const admin = await createTestUser();
    const joiner = await createTestUser();
    const event = await createOwnedEvent(admin);

    asUser(joiner);
    const res = await joinEvent(joinRequest({ code: event.code.toLowerCase() }));
    expect(res.status).toBe(201);
  });

  test("returns 200 when already a participant (idempotent)", async () => {
    const admin = await createTestUser();
    const joiner = await createTestUser();
    const event = await createOwnedEvent(admin);

    asUser(joiner);
    await joinEvent(joinRequest({ code: event.code }));
    const res = await joinEvent(joinRequest({ code: event.code }));
    expect(res.status).toBe(200);
  });

  test("returns 404 for unknown code", async () => {
    const user = await createTestUser();
    asUser(user);
    const res = await joinEvent(joinRequest({ code: "ZZZZZZZZ" }));
    expect(res.status).toBe(404);
  });

  test("rejects malformed codes", async () => {
    const user = await createTestUser();
    asUser(user);
    const res = await joinEvent(joinRequest({ code: "abc" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_code");
  });

  test("rejects unauthenticated requests", async () => {
    asAnonymous();
    const res = await joinEvent(joinRequest({ code: "ABCD1234" }));
    expect(res.status).toBe(401);
  });
});
