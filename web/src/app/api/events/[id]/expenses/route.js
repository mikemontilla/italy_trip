import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createExpense, listExpenses } from "@/lib/expenses";

/**
 * @openapi
 * /events/{id}/expenses:
 *   get:
 *     tags: [Expenses]
 *     summary: List expenses for an event (optional filter by participant)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: participant
 *         in: query
 *         required: false
 *         description: Filter to expenses where this event_participant is a payer or splitter
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of expenses (without payer/split detail)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Expense' }
 *       401: { description: Not authenticated }
 *       404: { description: Caller is not a participant of the event }
 *   post:
 *     tags: [Expenses]
 *     summary: Create a new expense (any registered participant)
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
 *             required: [description, amount, expense_date, payers, split_participant_ids]
 *             properties:
 *               description:  { type: string }
 *               amount:       { type: number, description: "Total amount in COP" }
 *               expense_date: { type: string, format: date }
 *               payers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [participant_id, amount]
 *                   properties:
 *                     participant_id: { type: integer }
 *                     amount:         { type: number }
 *               split_participant_ids:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       201:
 *         description: Expense created; returns full detail (payers + splits)
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Caller is not a registered participant of the event }
 */
export async function GET(request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const eventId = Number.parseInt(id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const participantParam = new URL(request.url).searchParams.get("participant");
  const participantId = participantParam ? Number.parseInt(participantParam, 10) : null;
  if (participantParam && (!Number.isInteger(participantId) || participantId <= 0)) {
    return NextResponse.json({ error: "invalid_participant" }, { status: 400 });
  }

  const expenses = await listExpenses(eventId, session.user.dbUserId, {
    participantId: participantId || undefined,
  });
  if (expenses === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(expenses);
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

  const payers = Array.isArray(body?.payers)
    ? body.payers.map((p) => ({
        participantId: Number(p?.participant_id),
        amount: Number(p?.amount),
      }))
    : null;

  const splitParticipantIds = Array.isArray(body?.split_participant_ids)
    ? body.split_participant_ids.map((n) => Number(n))
    : null;

  const result = await createExpense({
    eventId,
    actorUserId: session.user.dbUserId,
    description: body?.description,
    amount: body?.amount,
    expenseDate: body?.expense_date,
    payers,
    splitParticipantIds,
  });

  if (result.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (result.error === "event_finalized") {
    return NextResponse.json({ error: "event_finalized" }, { status: 409 });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.expense, { status: 201 });
}
