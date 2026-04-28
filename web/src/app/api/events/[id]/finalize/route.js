import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { finalizeEvent } from "@/lib/events";

/**
 * @openapi
 * /events/{id}/finalize:
 *   patch:
 *     tags: [Events]
 *     summary: Mark an event as finalized
 *     description: |
 *       Admin-only. Allowed only when every participant's balance is exactly zero.
 *       Once finalized, every mutation on the event is rejected — including for the admin —
 *       until the event is reopened.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Updated event
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Event' }
 *       401: { description: Not authenticated }
 *       403: { description: Caller is not an admin }
 *       404: { description: Caller is not a participant of the event }
 *       409: { description: Already finalized, or some balance is non-zero }
 */
export async function PATCH(_request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const eventId = Number.parseInt(id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const result = await finalizeEvent(eventId, session.user.dbUserId);
  if (result.error === "not_found")        return NextResponse.json({ error: "not_found" },        { status: 404 });
  if (result.error === "forbidden")        return NextResponse.json({ error: "forbidden" },        { status: 403 });
  if (result.error === "already_finalized") return NextResponse.json({ error: "already_finalized" }, { status: 409 });
  if (result.error === "balance_not_zero") return NextResponse.json({ error: "balance_not_zero" }, { status: 409 });
  return NextResponse.json(result.event);
}
