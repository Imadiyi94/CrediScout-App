import { prisma } from "./db";
import {
  createRecipient,
  generateReference,
  initiateTransfer,
  resolveAccountNumber,
} from "./paystack";

export type DisburseOutcome =
  | { ok: true; reference: string; transferCode: string | null; status: string; amountKobo: bigint; accountName: string | null }
  | { ok: false; status: number; error: string; reference?: string };

// Shared by POST /api/disbursements and the Stage 11 Disburse button.
// Only APPROVE / REDUCED recommendations can be paid, once each.
export async function disburseLoan(args: {
  assessmentId: string;
  accountNumber: string;
  bankCode: string;
  adminId: string;
}): Promise<DisburseOutcome> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: args.assessmentId },
    include: { borrower: true, recommendation: true, disbursement: true },
  });
  if (!assessment) return { ok: false, status: 404, error: "Assessment not found" };

  const rec = assessment.recommendation;
  if (!rec || (rec.decision !== "APPROVE" && rec.decision !== "REDUCED")) {
    return { ok: false, status: 422, error: "Loan is not approved — only APPROVE / APPROVE AT REDUCED AMOUNT can be disbursed" };
  }
  if (rec.recommendedAmountKobo <= 0n) {
    return { ok: false, status: 422, error: "Recommended amount is zero — nothing to disburse" };
  }
  if (assessment.disbursement?.status === "SUCCESS") {
    return { ok: false, status: 409, error: "This loan was already disbursed successfully" };
  }
  if (assessment.disbursement?.status === "PENDING") {
    return {
      ok: false, status: 409,
      error: "A transfer is already pending for this loan — wait for the Paystack callback",
      reference: assessment.disbursement.reference,
    };
  }
  if (!/^\d{10}$/.test(args.accountNumber)) {
    return { ok: false, status: 400, error: "Account number must be 10 digits" };
  }

  let accountName: string;
  try {
    ({ accountName } = await resolveAccountNumber({ accountNumber: args.accountNumber, bankCode: args.bankCode }));
  } catch (e) {
    return { ok: false, status: 422, error: e instanceof Error ? e.message : "Account verification failed" };
  }

  let recipientCode = assessment.disbursement?.recipientCode ?? undefined;
  if (!recipientCode) {
    try {
      ({ recipientCode } = await createRecipient({
        accountNumber: args.accountNumber,
        bankCode: args.bankCode,
        name: assessment.borrower.displayName,
      }));
    } catch (e) {
      return { ok: false, status: 502, error: e instanceof Error ? e.message : "Recipient creation failed" };
    }
  }

  const reference = generateReference(assessment.id);
  try {
    var transfer = await initiateTransfer({
      amountKobo: rec.recommendedAmountKobo,
      recipientCode,
      reason: `CrediScout ${rec.decision === "REDUCED" ? "reduced approval" : "approval"}: ${assessment.borrower.displayName}`,
      reference,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transfer failed";
    await prisma.disbursement.upsert({
      where: { assessmentId: assessment.id },
      update: { status: "FAILED", failureReason: message, attempts: { increment: 1 } },
      create: {
        assessmentId: assessment.id,
        borrowerId: assessment.borrowerId,
        amountKobo: rec.recommendedAmountKobo,
        bankCode: args.bankCode,
        accountNumber: args.accountNumber,
        accountName,
        recipientCode,
        reference,
        status: "FAILED",
        failureReason: message,
        initiatedBy: args.adminId,
      },
    });
    await prisma.auditEvent.create({
      data: {
        actorId: args.adminId, assessmentId: assessment.id, action: "DISBURSE_FAILED",
        entityType: "Disbursement", entityId: assessment.id, afterJson: { reference, error: message } as never,
      },
    });
    return { ok: false, status: 502, error: message };
  }

  const status =
    transfer.status.toLowerCase() === "success" ? "SUCCESS"
    : ["failed", "abandoned"].includes(transfer.status.toLowerCase()) ? "FAILED"
    : transfer.status.toLowerCase() === "reversed" ? "REVERSED"
    : "PENDING";
  const row = await prisma.disbursement.upsert({
    where: { assessmentId: assessment.id },
    update: {
      amountKobo: rec.recommendedAmountKobo,
      bankCode: args.bankCode,
      accountNumber: args.accountNumber,
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
      bankCode: args.bankCode,
      accountNumber: args.accountNumber,
      accountName,
      recipientCode,
      reference: transfer.reference,
      transferCode: transfer.transferCode,
      status,
      initiatedBy: args.adminId,
    },
  });
  await prisma.auditEvent.create({
    data: {
      actorId: args.adminId, assessmentId: assessment.id, action: "DISBURSE_INITIATE",
      entityType: "Disbursement", entityId: row.id,
      afterJson: { reference: row.reference, amountKobo: row.amountKobo.toString(), status } as never,
    },
  });

  return {
    ok: true,
    reference: row.reference,
    transferCode: row.transferCode,
    status: row.status,
    amountKobo: row.amountKobo,
    accountName: row.accountName,
  };
}
