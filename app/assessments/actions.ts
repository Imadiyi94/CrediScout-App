"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { parseNairaToKobo } from "@/lib/format";
import {
  assessmentCreateSchema,
  borrowerSchema,
  clientStatusVerifySchema,
  financialsSchema,
  profileUpdateSchema,
} from "@/lib/validators";
import { putDocument } from "@/lib/storage";
import { ALLOWED_MIME_PREFIXES, DOC_KINDS, MAX_UPLOAD_BYTES } from "@/lib/documents";
import { getAssessmentForUser } from "@/lib/assessments";
import { dscr, dti, loanToIncome } from "@engine/index";

function fail(to: string, message: string): never {
  redirect(`${to}?error=${encodeURIComponent(message)}`);
}

export async function createAssessment(formData: FormData) {
  const session = await requireUser();
  const parsed = assessmentCreateSchema.safeParse({
    borrowerId: formData.get("borrowerId") ?? "",
    product: formData.get("product"),
    requestedNaira: formData.get("requestedNaira"),
    proposedTenorMonths: formData.get("proposedTenorMonths"),
    loanPurpose: formData.get("loanPurpose"),
    repaymentSource: formData.get("repaymentSource"),
    repaymentFrequency: formData.get("repaymentFrequency"),
    existingExposureNaira: formData.get("existingExposureNaira") ?? "",
    clientStatus: formData.get("clientStatus"),
  });
  if (!parsed.success) fail("/assessments/new", parsed.error.issues[0]?.message ?? "Invalid input");
  const v = parsed.data;

  let requestedKobo: bigint;
  let existingKobo = 0n;
  try {
    requestedKobo = parseNairaToKobo(v.requestedNaira);
    if (v.existingExposureNaira.trim() !== "") existingKobo = parseNairaToKobo(v.existingExposureNaira);
  } catch {
    fail("/assessments/new", "Amounts must be numbers in naira");
  }
  if (requestedKobo! <= 0n) fail("/assessments/new", "Requested amount must be above zero");

  let borrowerId = v.borrowerId;
  if (!borrowerId) {
    const b = borrowerSchema.safeParse({
      type: formData.get("borrowerType"),
      displayName: formData.get("displayName"),
      phone: formData.get("phone") ?? "",
      email: formData.get("email") ?? "",
      address: formData.get("address") ?? "",
    });
    if (!b.success) fail("/assessments/new", b.error.issues[0]?.message ?? "Invalid borrower");
    const borrower = await prisma.borrower.create({
      data: {
        type: b.data.type as "INDIVIDUAL" | "BUSINESS",
        displayName: b.data.displayName,
        phone: b.data.phone || null,
        email: b.data.email || null,
        address: b.data.address || null,
        clientStatus: v.clientStatus,
      },
    });
    await logAudit({
      actorId: session.user.id,
      action: "BORROWER_CREATE",
      entityType: "Borrower",
      entityId: borrower.id,
      after: borrower,
    });
    borrowerId = borrower.id;
  } else {
    const borrower = await prisma.borrower.findUnique({ where: { id: borrowerId } });
    if (!borrower) fail("/assessments/new", "Selected borrower not found");
    await prisma.borrower.update({
      where: { id: borrowerId },
      data: { clientStatus: v.clientStatus, clientStatusVerified: false },
    });
  }

  const assessment = await prisma.assessment.create({
    data: {
      borrowerId,
      analystId: session.user.id,
      product: v.product,
      requestedAmountKobo: requestedKobo!,
      proposedTenorMonths: v.proposedTenorMonths,
      loanPurpose: v.loanPurpose,
      repaymentSource: v.repaymentSource,
      repaymentFrequency: v.repaymentFrequency as "MONTHLY" | "QUARTERLY" | "BULLET",
      existingExposureKobo: existingKobo,
      currentStage: 2,
    },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId: assessment.id,
    action: "ASSESSMENT_CREATE",
    entityType: "Assessment",
    entityId: assessment.id,
    after: assessment,
  });
  redirect(`/assessments/${assessment.id}`);
}

export async function updateBorrowerProfile(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/profile`, "Assessment not found");

  const parsed = profileUpdateSchema.safeParse({
    type: formData.get("type"),
    displayName: formData.get("displayName"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    businessType: formData.get("businessType") ?? "",
    businessAgeMonths: formData.get("businessAgeMonths") ?? "",
    industry: formData.get("industry") ?? "",
    experience: formData.get("experience") ?? "",
  });
  if (!parsed.success) {
    fail(`/assessments/${assessmentId}/profile`, parsed.error.issues[0]?.message ?? "Invalid profile");
  }
  const v = parsed.data;
  const before = assessment.borrower;
  const after = await prisma.borrower.update({
    where: { id: assessment.borrowerId },
    data: {
      type: v.type as "INDIVIDUAL" | "BUSINESS",
      displayName: v.displayName,
      phone: v.phone || null,
      email: v.email || null,
      address: v.address || null,
      businessProfile: {
        businessType: v.businessType || null,
        businessAgeMonths: v.businessAgeMonths ? Number(v.businessAgeMonths) : null,
        industry: v.industry || null,
        experience: v.experience || null,
      },
    },
  });
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { currentStage: Math.max(assessment.currentStage, 3) },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "BORROWER_UPDATE",
    entityType: "Borrower",
    entityId: after.id,
    before,
    after,
  });
  revalidatePath(`/assessments/${assessmentId}/profile`);
}

export async function verifyClientStatus(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/profile`, "Assessment not found");

  const parsed = clientStatusVerifySchema.safeParse({ evidence: formData.get("evidence") });
  if (!parsed.success) {
    fail(
      `/assessments/${assessmentId}/profile`,
      parsed.error.issues[0]?.message ?? "Describe the verification evidence",
    );
  }
  const after = await prisma.borrower.update({
    where: { id: assessment.borrowerId },
    data: {
      clientStatusVerified: true,
      clientStatusVerifiedAt: new Date(),
      clientStatusVerifiedBy: session.user.id,
      clientStatusEvidence: parsed.data.evidence,
    },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "CLIENTSTATUS_VERIFY",
    entityType: "Borrower",
    entityId: after.id,
    after,
    reason: parsed.data.evidence,
  });
  revalidatePath(`/assessments/${assessmentId}/profile`);
}

export async function saveFinancials(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/financials`, "Assessment not found");

  const parsed = financialsSchema.safeParse({
    revenueNaira: formData.get("revenueNaira"),
    opexNaira: formData.get("opexNaira") ?? "",
    cashFlowNaira: formData.get("cashFlowNaira") ?? "",
    existingServiceNaira: formData.get("existingServiceNaira") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    fail(`/assessments/${assessmentId}/financials`, parsed.error.issues[0]?.message ?? "Invalid figures");
  }
  const v = parsed.data;
  let revenue: bigint;
  let opex = 0n;
  let existing = 0n;
  try {
    revenue = parseNairaToKobo(v.revenueNaira);
    if (v.opexNaira.trim() !== "") opex = parseNairaToKobo(v.opexNaira);
    if (v.existingServiceNaira.trim() !== "") existing = parseNairaToKobo(v.existingServiceNaira);
  } catch {
    fail(`/assessments/${assessmentId}/financials`, "Figures must be numbers in naira");
  }
  if (revenue! <= 0n) fail(`/assessments/${assessmentId}/financials`, "Revenue must be above zero");

  const net = revenue! - opex;
  let cashFlow = net;
  if (v.cashFlowNaira.trim() !== "") {
    try {
      cashFlow = parseNairaToKobo(v.cashFlowNaira);
    } catch {
      fail(`/assessments/${assessmentId}/financials`, "Cash flow must be a number in naira");
    }
  }

  const dtiVal = dti(existing, revenue!);
  const dscrVal = dscr(cashFlow, existing);
  const ltiVal = loanToIncome(assessment.requestedAmountKobo, revenue!);

  const data = {
    assessmentId,
    revenueKobo: revenue!,
    opexKobo: opex,
    netIncomeKobo: net,
    cashFlowKobo: cashFlow,
    existingDebtServiceKobo: existing,
    proposedDebtServiceKobo: 0n,
    dti: dtiVal === null ? null : dtiVal.toFixed(4),
    dscr: dscrVal === null ? null : dscrVal.toFixed(4),
    loanToIncome: ltiVal === null ? null : ltiVal.toFixed(4),
    source: "analyst-entry",
    notes: v.notes || null,
  };
  const before = await prisma.financialSnapshot.findUnique({ where: { assessmentId } });
  const after = before
    ? await prisma.financialSnapshot.update({ where: { assessmentId }, data })
    : await prisma.financialSnapshot.create({ data });
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { currentStage: Math.max(assessment.currentStage, 5) },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "FINANCIALS_SAVE",
    entityType: "FinancialSnapshot",
    entityId: after.id,
    before,
    after,
  });
  revalidatePath(`/assessments/${assessmentId}/financials`);
}

export async function uploadDocument(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/documents`, "Assessment not found");

  const kind = String(formData.get("kind") ?? "");
  if (!(DOC_KINDS as readonly string[]).includes(kind)) {
    fail(`/assessments/${assessmentId}/documents`, "Select a document kind");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    fail(`/assessments/${assessmentId}/documents`, "Choose a file to upload");
  }
  if (file.size > MAX_UPLOAD_BYTES) fail(`/assessments/${assessmentId}/documents`, "File exceeds 10 MB");
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) && mime !== "application/octet-stream") {
    fail(`/assessments/${assessmentId}/documents`, `File type not accepted: ${mime}`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const key = `assessments/${assessmentId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await putDocument(key, buffer, mime);

  const doc = await prisma.document.create({
    data: {
      assessmentId,
      kind,
      fileKey: key,
      originalName: file.name.slice(0, 200),
      mimeType: mime,
      sizeBytes: file.size,
    },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "DOCUMENT_UPLOAD",
    entityType: "Document",
    entityId: doc.id,
    after: { kind, originalName: doc.originalName, sizeBytes: doc.sizeBytes },
  });
  revalidatePath(`/assessments/${assessmentId}/documents`);
}

export async function setDocumentStatus(
  assessmentId: string,
  formData: FormData,
) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/documents`, "Assessment not found");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "VERIFIED" && status !== "REJECTED") {
    fail(`/assessments/${assessmentId}/documents`, "Invalid verification status");
  }
  const doc = await prisma.document.findFirst({ where: { id, assessmentId } });
  if (!doc) fail(`/assessments/${assessmentId}/documents`, "Document not found");

  const after = await prisma.document.update({
    where: { id },
    data: {
      verificationStatus: status as "VERIFIED" | "REJECTED",
      verifiedBy: session.user.id,
      verifiedAt: new Date(),
    },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: status === "VERIFIED" ? "DOCUMENT_VERIFY" : "DOCUMENT_REJECT",
    entityType: "Document",
    entityId: id,
    before: { verificationStatus: doc.verificationStatus },
    after: { verificationStatus: after.verificationStatus },
  });
  revalidatePath(`/assessments/${assessmentId}/documents`);
}
