import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMovement, deleteMovement } from "@/lib/movements";

/**
 * @openapi
 * /events/{id}/movements/{movementId}:
 *   get:
 *     tags: [Movements]
 *     summary: Get full detail of a movement (including who registered it)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: movementId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Movement detail with creator info }
 *       401: { description: Not authenticated }
 *       404: { description: Movement not found or caller has no access }
 *   delete:
 *     tags: [Movements]
 *     summary: Delete a movement (admin only)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: movementId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Deleted }
 *       401: { description: Not authenticated }
 *       403: { description: Caller is not admin }
 *       404: { description: Movement not found }
 */
export async function GET(_request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { movementId } = await ctx.params;
  const parsed = Number.parseInt(movementId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const movement = await getMovement(parsed, session.user.dbUserId);
  if (!movement) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(movement);
}

export async function DELETE(_request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { movementId } = await ctx.params;
  const parsed = Number.parseInt(movementId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const result = await deleteMovement(parsed, session.user.dbUserId);
  if (result.error === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (result.error === "event_finalized") {
    return NextResponse.json({ error: "event_finalized" }, { status: 409 });
  }
  return new Response(null, { status: 204 });
}
