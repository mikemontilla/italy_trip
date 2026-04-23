import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listParticipants, addFictitiousParticipant } from "@/lib/participants";

/**
 * @openapi
 * /events/{id}/participants:
 *   get:
 *     tags: [Participants]
 *     summary: List participants of an event (registered and fictitious)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Participant list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Participant' }
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Event not found or caller is not a participant
 *   post:
 *     tags: [Participants]
 *     summary: Add a fictitious participant to an event (admin only)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, name]
 *             properties:
 *               type: { type: string, enum: [fictitious] }
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Participant created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Participant' }
 *       400: { description: Invalid input }
 *       401: { description: Not authenticated }
 *       403: { description: Caller is not admin of the event }
 */
export async function GET(_request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const eventId = Number.parseInt(id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const participants = await listParticipants(eventId, session.user.dbUserId);
  if (participants === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(participants);
}

export async function POST(request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const eventId = Number.parseInt(id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body?.type !== "fictitious") {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (name.length > 255) {
    return NextResponse.json({ error: "name_too_long" }, { status: 400 });
  }

  const result = await addFictitiousParticipant(
    eventId,
    session.user.dbUserId,
    name
  );
  if (result.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json(result.participant, { status: 201 });
}
