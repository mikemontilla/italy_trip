import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     description: Verifies that the app is running and can reach the database.
 *     responses:
 *       200:
 *         description: App is healthy and DB is reachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 database: { type: string, example: connected }
 *                 environment: { type: string, example: development }
 *       503:
 *         description: Database unreachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: error }
 *                 database: { type: string, example: unreachable }
 *                 message: { type: string }
 */
export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({
      status: "ok",
      database: "connected",
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", database: "unreachable", message: error.message },
      { status: 503 }
    );
  }
}
