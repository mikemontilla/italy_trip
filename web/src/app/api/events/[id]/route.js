import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEventById } from "@/lib/events";

/**
 * @openapi
 * /events/{id}:
 *   get:
 *     tags: [Events]
 *     summary: Get a single event by id (only if the user participates in it)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Event found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Event' }
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Event not found or user has no access
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

  const event = await getEventById(eventId, session.user.dbUserId);
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(event);
}
