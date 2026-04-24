import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { calculateParticipantBalance } from "@/lib/balances";

/**
 * @openapi
 * /events/{id}/balance/{participantId}:
 *   get:
 *     tags: [Balances]
 *     summary: Get an individual participant's balance with full breakdown
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: participantId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Totals + detail lists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/BalanceDetail' }
 *       401: { description: Not authenticated }
 *       404: { description: Participant not found in event or caller has no access }
 */
export async function GET(_request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id, participantId } = await ctx.params;
  const eventId = Number.parseInt(id, 10);
  const pid = Number.parseInt(participantId, 10);
  if (!Number.isInteger(eventId) || eventId <= 0 ||
      !Number.isInteger(pid) || pid <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const result = await calculateParticipantBalance(eventId, pid, session.user.dbUserId);
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
