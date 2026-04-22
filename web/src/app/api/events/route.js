import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEvent, listEventsForUser } from "@/lib/events";

/**
 * @openapi
 * /events:
 *   get:
 *     tags: [Events]
 *     summary: List events the authenticated user participates in
 *     responses:
 *       200:
 *         description: Events the user participates in, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Event' }
 *       401:
 *         description: Not authenticated
 *   post:
 *     tags: [Events]
 *     summary: Create a new event
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, example: "Italy Trip" }
 *               description: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Event created (creator auto-registered as admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Event' }
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const events = await listEventsForUser(session.user.dbUserId);
  return NextResponse.json(events);
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const description =
    typeof body?.description === "string" ? body.description.trim() : "";

  const event = await createEvent({
    name,
    description: description || null,
    creatorUserId: session.user.dbUserId,
  });

  return NextResponse.json(event, { status: 201 });
}
