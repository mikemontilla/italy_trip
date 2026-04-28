import { NextResponse } from "next/server";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { auth } from "@/auth";
import { setEventPhoto } from "@/lib/events";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/**
 * @openapi
 * /events/{id}/photo:
 *   post:
 *     tags: [Events]
 *     summary: Upload (or replace) the photo of an event (admin only)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: JPEG, PNG or WebP — max 5 MB
 *     responses:
 *       200:
 *         description: Photo stored; returns the public path of the saved file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 photo_path: { type: string, example: "/uploads/events/12-1711230000000.jpg" }
 *       400:
 *         description: Missing file, wrong type, or file too large
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: User is not admin of the event
 */
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

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const ext = ALLOWED_MIME.get(file.type);
  if (!ext) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const filename = `${eventId}-${Date.now()}.${ext}`;
  const publicPath = `/uploads/events/${filename}`;
  const absDir = path.join(process.cwd(), "public", "uploads", "events");
  await mkdir(absDir, { recursive: true });
  await writeFile(
    path.join(absDir, filename),
    Buffer.from(await file.arrayBuffer())
  );

  const result = await setEventPhoto(eventId, session.user.dbUserId, publicPath);
  if (result.error === "event_finalized") {
    return NextResponse.json({ error: "event_finalized" }, { status: 409 });
  }
  if (!result.updated) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ photo_path: publicPath });
}
