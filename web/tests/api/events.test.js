import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { query } from "@/lib/db";
import { createTestUser } from "../helpers";
import { GET as listEvents, POST as createEvent } from "@/app/api/events/route";
import { GET as getEvent } from "@/app/api/events/[id]/route";

function jsonRequest(body) {
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function asUser(user) {
  auth.mockResolvedValue({ user: { dbUserId: user.id } });
}

function asAnonymous() {
  auth.mockResolvedValue(null);
}

beforeEach(() => {
  auth.mockReset();
});

describe("POST /api/events", () => {
  test("creates an event and auto-registers the creator as admin", async () => {
    const user = await createTestUser();
    asUser(user);

    const res = await createEvent(
      jsonRequest({ name: "Italy Trip", description: "Spring 2026" })
    );

    expect(res.status).toBe(201);
    const event = await res.json();
    expect(event.name).toBe("Italy Trip");
    expect(event.description).toBe("Spring 2026");
    expect(event.status).toBe("active");
    expect(event.created_by_user_id).toBe(user.id);
    expect(event.code).toMatch(/^[A-Z0-9]{8}$/);

    const participants = await query(
      `SELECT user_id, role FROM event_participants WHERE event_id = ?`,
      [event.id]
    );
    expect(participants).toHaveLength(1);
    expect(participants[0].user_id).toBe(user.id);
    expect(participants[0].role).toBe("admin");
  });

  test("treats empty description as null", async () => {
    const user = await createTestUser();
    asUser(user);

    const res = await createEvent(jsonRequest({ name: "Trip", description: "   " }));
    const event = await res.json();
    expect(event.description).toBeNull();
  });

  test("rejects request without a name", async () => {
    const user = await createTestUser();
    asUser(user);

    const res = await createEvent(jsonRequest({ description: "No name" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("name_required");
  });

  test("rejects unauthenticated requests", async () => {
    asAnonymous();
    const res = await createEvent(jsonRequest({ name: "Trip" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/events", () => {
  test("returns only events the user participates in, newest first", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();

    asUser(alice);
    await createEvent(jsonRequest({ name: "Alice Trip 1" }));
    await createEvent(jsonRequest({ name: "Alice Trip 2" }));

    asUser(bob);
    await createEvent(jsonRequest({ name: "Bob Trip" }));

    asUser(alice);
    const res = await listEvents();
    expect(res.status).toBe(200);
    const events = await res.json();
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.name)).toEqual(["Alice Trip 2", "Alice Trip 1"]);
  });

  test("rejects unauthenticated requests", async () => {
    asAnonymous();
    const res = await listEvents();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/events/[id]", () => {
  test("returns the event when user participates in it", async () => {
    const user = await createTestUser();
    asUser(user);

    const created = await (await createEvent(jsonRequest({ name: "My Trip" }))).json();

    const res = await getEvent(new Request(`http://localhost/api/events/${created.id}`), {
      params: Promise.resolve({ id: String(created.id) }),
    });

    expect(res.status).toBe(200);
    const event = await res.json();
    expect(event.id).toBe(created.id);
    expect(event.name).toBe("My Trip");
  });

  test("returns 404 when the user is not a participant", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();

    asUser(alice);
    const created = await (await createEvent(jsonRequest({ name: "Alice Trip" }))).json();

    asUser(bob);
    const res = await getEvent(new Request(`http://localhost/api/events/${created.id}`), {
      params: Promise.resolve({ id: String(created.id) }),
    });

    expect(res.status).toBe(404);
  });

  test("rejects invalid ids", async () => {
    const user = await createTestUser();
    asUser(user);

    const res = await getEvent(new Request("http://localhost/api/events/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects unauthenticated requests", async () => {
    asAnonymous();
    const res = await getEvent(new Request("http://localhost/api/events/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(401);
  });
});
