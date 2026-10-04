import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import {
  createRecipient,
  generateReference,
  initiateTransfer,
  resolveAccountNumber,
} from "@/lib/paystack";

const disburseSchema = z.object({
  assessmentId: z.string().min(1),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
  bankCode: z.string().min(2, "Bank is required").max(10),
});

function toStatus(paystackStatus: string): string {
  const s = paystackStatus.toLowerCase();
  if (s === "success") return "SUCCESS";
  if (s === "failed" || s === "abandoned") return "FAILED";
  if (s === "reversed") return "REVERSED";
  return "PENDING";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (sessionRole(session) !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can disburse loans" }, { status: 403 });
  }

  let parsed: z.infer<typeof disburseSchema>;
  try {
    parsed = disburseSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Send assessmentId, a 10-digit accountNumber, and bankCode" },
      { status: 400 },
    );
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: parsed.assessmentId },
    include: { borrower: true, recommendation: true, disbursement: true },
  });
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Gate 1: an approval must exist (APPROVE, or REDUCED at the reduced amount).
  const rec = assessment.recommendation;
  if (!rec || (rec.decision !== "APPROVE" && rec.decision !== "REDUCED")) {
    return NextResponse.json(
      { error: "Loan is not approved — only APPROVE / APPROVE AT REDUCED AMOUNT can be disbursed" },
      { status: 422 },
    );
  }
  if (rec.recommendedAmountKobo <= 0n) {
    return NextResponse.json({ error: "Recommended amount is zero — nothing to disburse" }, { status: 422 });
  }

  // Gate 2: never pay twice.
  if (assessment.disbursement?.status === "SUCCESS") {
    return NextResponse.json({ error: "This loan was already disbursed successfully" }, { status: 409 });
  }
  if (assessment.disbursement?.status === "PENDING") {
    return NextResponse.json(
      {
        error: "A transfer is already pending for this loan — wait for the Paystack callback",
        reference: assessment.disbursement.reference,
      },
      { status: 409 },
    );
  }

  // Confirm the account belongs to the borrower, then create (or reuse) the recipient.
  let accountName: string;
  try {
    ({ accountName } = await resolveAccountNumber({
      accountNumber: parsed.accountNumber,
      bankCode: parsed.bankCode,
    }));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Account verification failed" },
      { status: 422 },
    );
  }
  let recipientCode = assessment.disbursement?.recipientCode ?? undefined;
  if (!recipientCode) {
    try {
      ({ recipientCode } = await createRecipient({
        accountNumber: parsed.accountNumber,
        bankCode: parsed.bankCode,
        name: assessment.borrower.displayName,
      }));
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Recipient creation failed" },
        { status: 502 },
      );
    }
  }

  // Send the RECOMMENDED amount (kobo) with a fresh unique reference.
  const reference = generateReference(assessment.id);
  let transfer: { transferCode: string; reference: string; status: string };
  try {
    transfer = await initiateTransfer({
      amountKobo: rec.recommendedAmountKobo,
      recipientCode,
      reason: `CrediScout ${rec.decision === "REDUCED" ? "reduced approval" : "approval"}: ${assessment.borrower.displayName}`,
      reference,
    });
  } catch (e) {
    await prisma.disbursement.upsert({
      where: { assessmentId: assessment.id },
      update: {
        status: "FAILED",
        failureReason: e instanceof Error ? e.message : "Transfer initiation failed",
        attempts: { increment: 1 },
      },
      create: {
        assessmentId: assessment.id,
        borrowerId: assessment.borrowerId,
        amountKobo: rec.recommendedAmountKobo,
        bankCode: parsed.bankCode,
        accountNumber: parsed.accountNumber,
        accountName,
        recipientCode,
        reference,
        status: "FAILED",
        failureReason: e instanceof Error ? e.message : "Transfer initiation failed",
        initiatedBy: session.user.id,
      },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transfer failed" },
      { status: 502 },
    );
  }

  const status = toStatus(transfer.status);
  const row = await prisma.disbursement.upsert({
    where: { assessmentId: assessment.id },
    update: {
      amountKobo: rec.recommendedAmountKobo,
      bankCode: parsed.bankCode,
      accountNumber: parsed.accountNumber,
      accountName,
      recipientCode,
      reference: transfer.reference,
      transferCode: transfer.transferCode,
      status,
      failureReason: null,
      attempts: { increment: 1 },
    },
    create: {
      assessmentId: assessment.id,
      borrowerId: assessment.borrowerId,
      amountKobo: rec.recommendedAmountKobo,
      bankCode: parsed.bankCode,
      accountNumber: parsed.accountNumber,
      accountName,
      recipientCode,
      reference: transfer.reference,
      transferCode: transfer.transferCode,
      status,
      initiatedBy: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    assessmentId: assessment.id,
    action: "DISBURSE_INITIATE",
    entityType: "Disbursement",
    entityId: row.id,
    after: { reference: row.reference, amountKobo: row.amountKobo.toString(), status },
  });

  return NextResponse.json({
    reference: row.reference,
    transferCode: row.transferCode,
    status: row.status,
    amountKobo: row.amountKobo.toString(),
    accountName: row.accountName,
  });
}
