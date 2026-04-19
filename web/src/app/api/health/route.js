import { NextResponse } from "next/server";
import { query } from "@/lib/db";

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
