import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import path from "node:path";
import { readFile, rm } from "node:fs/promises";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { query } from "@/lib/db";
import { createTestUser } from "../helpers";
import { POST as createEvent } from "@/app/api/events/route";
import { POST as uploadPhoto } from "@/app/api/events/[id]/photo/route";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "events");

function asUser(user) {
  auth.mockResolvedValue({ user: { dbUserId: user.id } });
}

function asAnonymous() {
  auth.mockResolvedValue(null);
}

function jsonCreateRequest(body) {
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function photoRequest(file) {
  const form = new FormData();
  if (file !== undefined) form.append("file", file);
  return new Request("http://localhost/api/events/1/photo", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  auth.mockReset();
});

afterAll(async () => {
  await rm(UPLOADS_DIR, { recursive: true, force: true });
});

async function createOwnedEvent(user) {
  asUser(user);
  const res = await createEvent(jsonCreateRequest({ name: "Trip" }));
  return res.json();
}

describe("POST /api/events/[id]/photo", () => {
  test("stores a valid image and updates photo_path", async () => {
    const user = await createTestUser();
    const event = await createOwnedEvent(user);

    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const file = new File([bytes], "cover.jpg", { type: "image/jpeg" });

    const res = await uploadPhoto(photoRequest(file), {
      params: Promise.resolve({ id: String(event.id) }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.photo_path).toMatch(
      new RegExp(`^/uploads/events/${event.id}-\\d+\\.jpg$`)
    );

    const [row] = await query(
      `SELECT photo_path FROM events WHERE id = ?`,
      [event.id]
    );
    expect(row.photo_path).toBe(body.photo_path);

    const onDisk = await readFile(path.join(process.cwd(), "public", body.photo_path));
    expect(onDisk.equals(bytes)).toBe(true);
  });

  test("rejects requests without a file", async () => {
    const user = await createTestUser();
    const event = await createOwnedEvent(user);

    const res = await uploadPhoto(photoRequest(undefined), {
      params: Promise.resolve({ id: String(event.id) }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("file_required");
  });

  test("rejects unsupported mime types", async () => {
    const user = await createTestUser();
    const event = await createOwnedEvent(user);

    const file = new File([Buffer.from("hello")], "note.txt", {
      type: "text/plain",
    });
    const res = await uploadPhoto(photoRequest(file), {
      params: Promise.resolve({ id: String(event.id) }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unsupported_type");
  });

  test("returns 403 when caller is not an admin of the event", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const event = await createOwnedEvent(alice);

    asUser(bob);
    const file = new File([Buffer.from([0xff, 0xd8])], "cover.jpg", {
      type: "image/jpeg",
    });
    const res = await uploadPhoto(photoRequest(file), {
      params: Promise.resolve({ id: String(event.id) }),
    });
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated requests", async () => {
    asAnonymous();
    const file = new File([Buffer.from([0xff, 0xd8])], "cover.jpg", {
      type: "image/jpeg",
    });
    const res = await uploadPhoto(photoRequest(file), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(401);
  });
});
