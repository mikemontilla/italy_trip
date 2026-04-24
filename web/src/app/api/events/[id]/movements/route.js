import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createMovement, listMovements } from "@/lib/movements";

/**
 * @openapi
 * /events/{id}/movements:
 *   get:
 *     tags: [Movements]
 *     summary: List movements for an event (newest first)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of movements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Movement' }
 *       401: { description: Not authenticated }
 *       404: { description: Caller is not a participant of the event }
 *   post:
 *     tags: [Movements]
 *     summary: Register a new movement (any registered participant)
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
 *             required: [type, sender_participant_id, recipient_participant_id, amount, movement_date]
 *             properties:
 *               type:                   { type: string, enum: [transfer, loan] }
 *               sender_participant_id:  { type: integer }
 *               recipient_participant_id: { type: integer }
 *               amount:                 { type: number }
 *               movement_date:          { type: string, format: date }
 *               bank:                   { type: string, nullable: true }
 *               note:                   { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Movement registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Movement' }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Caller is not a registered participant of the event }
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

  const movements = await listMovements(eventId, session.user.dbUserId);
  if (movements === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(movements);
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

  const result = await createMovement({
    eventId,
    actorUserId: session.user.dbUserId,
    type: body?.type,
    senderParticipantId: Number(body?.sender_participant_id),
    recipientParticipantId: Number(body?.recipient_participant_id),
    amount: body?.amount,
    movementDate: body?.movement_date,
    bank: body?.bank,
    note: body?.note,
  });

  if (result.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.movement, { status: 201 });
}
