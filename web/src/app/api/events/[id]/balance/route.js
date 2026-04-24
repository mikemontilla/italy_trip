import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { calculateEventBalances } from "@/lib/balances";

/**
 * @openapi
 * /events/{id}/balance:
 *   get:
 *     tags: [Balances]
 *     summary: Get the balance of every participant in an event
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of participant balances
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Balance' }
 *       401: { description: Not authenticated }
 *       404: { description: Caller is not a participant of the event }
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

  const balances = await calculateEventBalances(eventId, session.user.dbUserId);
  if (balances === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(balances);
}
