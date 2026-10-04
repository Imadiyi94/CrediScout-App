import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// Paystack calls this on transfer.success / transfer.failed / transfer.reversed.
// No session — authenticity comes from the HMAC signature instead.
export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Paystack not configured" }, { status: 500 });

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  let valid = false;
  try {
    valid =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    valid = false;
  }
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: { event?: string; data?: { reference?: string; status?: string; transfer_code?: string; reason?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ ignored: true, reason: "no reference" });

  const row = await prisma.disbursement.findUnique({ where: { reference } });
  if (!row) return NextResponse.json({ ignored: true, reason: "unknown reference" });

  const toStatus =
    event.event === "transfer.success" ? "SUCCESS"
    : event.event === "transfer.failed" ? "FAILED"
    : event.event === "transfer.reversed" ? "REVERSED"
    : null;
  if (!toStatus) return NextResponse.json({ ignored: true, reason: `unhandled ${event.event}` });

  // Idempotent: already final and unchanged → acknowledge quietly.
  if (row.status === toStatus) return NextResponse.json({ ok: true, status: row.status, duplicate: true });

  const updated = await prisma.disbursement.update({
    where: { id: row.id },
    data: {
      status: toStatus,
      failureReason: toStatus === "FAILED" ? (event.data?.reason ?? event.data?.status ?? "failed") : null,
      transferCode: event.data?.transfer_code ?? row.transferCode,
    },
  });
  await logAudit({
    actorId: row.initiatedBy,
    assessmentId: row.assessmentId,
    action: "DISBURSE_WEBHOOK",
    entityType: "Disbursement",
    entityId: row.id,
    before: { status: row.status },
    after: { status: updated.status },
    reason: `Paystack event ${event.event}`,
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
