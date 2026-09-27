import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  let db: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    db = "down";
  }
  return NextResponse.json({ ok: db === "up", db, time: new Date().toISOString() });
}
