import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { reopenEvent } from "@/lib/events";

/**
 * @openapi
 * /events/{id}/reopen:
 *   patch:
 *     tags: [Events]
 *     summary: Reopen a finalized event, returning it to active status
 *     description: |
 *       Admin-only. Switches a `finalized` event back to `active` so that participants
 *       can register, modify, or delete expenses and movements again.
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
 *       409: { description: Event is not finalized }
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

  const result = await reopenEvent(eventId, session.user.dbUserId);
  if (result.error === "not_found")     return NextResponse.json({ error: "not_found" },     { status: 404 });
  if (result.error === "forbidden")     return NextResponse.json({ error: "forbidden" },     { status: 403 });
  if (result.error === "not_finalized") return NextResponse.json({ error: "not_finalized" }, { status: 409 });
  return NextResponse.json(result.event);
}
