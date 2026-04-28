import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { joinEventByCode } from "@/lib/participants";

const CODE_PATTERN = /^[A-Z0-9]{8}$/;

/**
 * @openapi
 * /events/join:
 *   post:
 *     tags: [Participants]
 *     summary: Join an event using its 8-character code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: "A1B2C3D4" }
 *     responses:
 *       200:
 *         description: Already a participant — returns the event
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Event' }
 *       201:
 *         description: Joined successfully — returns the event
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Event' }
 *       400: { description: Invalid or missing code }
 *       401: { description: Not authenticated }
 *       404: { description: Code does not match any event }
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const result = await joinEventByCode(code, session.user.dbUserId);
  if (result.error === "event_not_found") {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }
  if (result.error === "event_finalized") {
    return NextResponse.json({ error: "event_finalized" }, { status: 409 });
  }
  if (result.error === "already_joined") {
    return NextResponse.json(result.event, { status: 200 });
  }
  return NextResponse.json(result.event, { status: 201 });
}
