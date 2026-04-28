import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { calculateSettlements } from "@/lib/settlement";

/**
 * @openapi
 * /events/{id}/settlement:
 *   get:
 *     tags: [Settlements]
 *     summary: Suggest two settlement plans that bring all balances to zero
 *     description: |
 *       Admin-only. Returns two greedy plans, both minimizing the maximum number of
 *       transfers any single participant must make.
 *
 *       - **option1** ("Saldar grandes primero"): pairs the largest creditor with the largest debtor.
 *       - **option2** ("Liberar pequeños primero"): pairs the smallest creditor with the largest debtor.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Two settlement plans
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Settlement' }
 *       401: { description: Not authenticated }
 *       403: { description: Caller is a participant but not an admin }
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

  const result = await calculateSettlements(eventId, session.user.dbUserId);
  if (result.error === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json(result);
}
