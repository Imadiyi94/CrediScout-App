"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireUser, sessionRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { parseNairaToKobo, formatKobo } from "@/lib/format";
import {
  assessmentCreateSchema,
  borrowerSchema,
  clientStatusVerifySchema,
  collateralSchema,
  creditRiskSchema,
  financialsSchema,
  profileUpdateSchema,
  qualitativeSchema,
  riskSummarySchema,
  proposalSchema,
  confirmSchema,
} from "@/lib/validators";
import { putDocument } from "@/lib/storage";
import { ALLOWED_MIME_PREFIXES, DOC_KINDS, MAX_UPLOAD_BYTES } from "@/lib/documents";
import { getAssessmentForUser } from "@/lib/assessments";
import { PRODUCT_FIELDS } from "@/lib/product-fields";
import { refreshAlerts } from "@/lib/alerts";
import { disburseLoan } from "@/lib/disbursements";
import { dscr, dti, evaluateCreditRisk, loanToIncome, ltv, netSecurityValue, scoreQualitative } from "@engine/index";

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
    data: { currentStage: Math.max(assessment.currentStage, after.ninVerified && after.bvnVerified ? 3 : 2) },
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
  await refreshAlerts(assessmentId);
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
  await refreshAlerts(assessmentId);
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
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/financials`);
}

export async function saveCreditRisk(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/credit-risk`, "Assessment not found");

  const parsed = creditRiskSchema.safeParse({
    repaymentGrade: formData.get("repaymentGrade"),
    priorDelinquencies: formData.get("priorDelinquencies"),
    priorDefaults: formData.get("priorDefaults"),
    arrearsNow: formData.get("arrearsNow") ?? "no",
    totalExposureNaira: formData.get("totalExposureNaira") ?? "",
    monthlyIncomeNaira: formData.get("monthlyIncomeNaira") ?? "",
    openFacilities: formData.get("openFacilities"),
    maxUtilizationPct: formData.get("maxUtilizationPct") ?? "",
    guarantorNaira: formData.get("guarantorNaira") ?? "",
    multipleLenders: formData.get("multipleLenders") ?? "no",
  });
  if (!parsed.success) {
    fail(`/assessments/${assessmentId}/credit-risk`, parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const v = parsed.data;

  const naira = (s: string) => (s.trim() === "" ? 0n : parseNairaToKobo(s));
  let totalExposure = 0n;
  let income: bigint | null = null;
  let guarantor = 0n;
  try {
    totalExposure = naira(v.totalExposureNaira);
    if (v.monthlyIncomeNaira.trim() !== "") income = parseNairaToKobo(v.monthlyIncomeNaira);
    guarantor = naira(v.guarantorNaira);
  } catch {
    fail(`/assessments/${assessmentId}/credit-risk`, "Money figures must be numbers in naira");
  }

  const result = evaluateCreditRisk({
    repaymentGrade: v.repaymentGrade,
    priorDelinquencies: v.priorDelinquencies,
    priorDefaults: v.priorDefaults,
    arrearsNow: v.arrearsNow === "yes",
    totalExposureKobo: totalExposure,
    monthlyIncomeKobo: income,
    openFacilities: v.openFacilities,
    maxUtilizationPct: v.maxUtilizationPct.trim() === "" ? null : Number(v.maxUtilizationPct),
    guarantorExposureKobo: guarantor,
    hasMultipleLenders: v.multipleLenders === "yes",
  });

  const data = {
    assessmentId,
    repaymentHistoryGrade: v.repaymentGrade,
    delinquencyFlags: result.flags
      .filter((f) => f.code.includes("DELINQUENCY") || f.code.includes("DEFAULT") || f.code === "ARREARS_NOW")
      .map((f) => f.code),
    totalExposureKobo: totalExposure,
    utilizationPct:
      v.maxUtilizationPct.trim() === "" ? null : Number(v.maxUtilizationPct).toFixed(2),
    multipleBorrowingFlags: result.flags
      .filter((f) => f.code === "MULTIPLE_BORROWING")
      .map((f) => `${f.code}:facilities=${v.openFacilities}`),
    guarantorObligationsKobo: guarantor,
    redFlags: result.flags as never,
  };
  const before = await prisma.creditProfile.findUnique({ where: { assessmentId } });
  const after = before
    ? await prisma.creditProfile.update({ where: { assessmentId }, data })
    : await prisma.creditProfile.create({ data });
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { currentStage: Math.max(assessment.currentStage, 6) },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "CREDITRISK_SAVE",
    entityType: "CreditProfile",
    entityId: after.id,
    before,
    after,
  });
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/credit-risk`);
}

export async function saveQualitative(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/qualitative`, "Assessment not found");

  const parsed = qualitativeSchema.safeParse({
    history: formData.get("history"),
    industry: formData.get("industry"),
    management: formData.get("management"),
    stability: formData.get("stability"),
    concentration: formData.get("concentration"),
    seasonality: formData.get("seasonality"),
    purpose: formData.get("purpose"),
    repayment: formData.get("repayment"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    fail(`/assessments/${assessmentId}/qualitative`, parsed.error.issues[0]?.message ?? "Rate every dimension 1–5");
  }
  const { notes, ...answers } = parsed.data;
  const result = scoreQualitative(answers);
  const data = {
    assessmentId,
    payload: { ...answers, band: result.band, weakest: result.weakest },
    qualitativeScore: result.average.toFixed(2),
    notes: notes || null,
  };
  const before = await prisma.businessProfile.findUnique({ where: { assessmentId } });
  const after = before
    ? await prisma.businessProfile.update({ where: { assessmentId }, data })
    : await prisma.businessProfile.create({ data });
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { currentStage: Math.max(assessment.currentStage, 7) },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "QUALITATIVE_SAVE",
    entityType: "BusinessProfile",
    entityId: after.id,
    before,
    after,
  });
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/qualitative`);
}

export async function addCollateral(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/collateral`, "Assessment not found");

  const parsed = collateralSchema.safeParse({
    type: formData.get("type"),
    ownership: formData.get("ownership") ?? "",
    estimatedNaira: formData.get("estimatedNaira"),
    verifiedNaira: formData.get("verifiedNaira") ?? "",
    marketability: formData.get("marketability"),
    encumbrancesNaira: formData.get("encumbrancesNaira") ?? "",
    documentationStatus: formData.get("documentationStatus"),
  });
  if (!parsed.success) {
    fail(`/assessments/${assessmentId}/collateral`, parsed.error.issues[0]?.message ?? "Invalid security");
  }
  const v = parsed.data;
  let estimated: bigint;
  let verified: bigint | null = null;
  let encumbrances = 0n;
  try {
    estimated = parseNairaToKobo(v.estimatedNaira);
    if (v.verifiedNaira.trim() !== "") verified = parseNairaToKobo(v.verifiedNaira);
    if (v.encumbrancesNaira.trim() !== "") encumbrances = parseNairaToKobo(v.encumbrancesNaira);
  } catch {
    fail(`/assessments/${assessmentId}/collateral`, "Values must be numbers in naira");
  }
  if (estimated! <= 0n) fail(`/assessments/${assessmentId}/collateral`, "Estimated value must be above zero");

  const base = verified ?? estimated!;
  const net = netSecurityValue(base, encumbrances);
  const ltvVal = ltv(assessment.requestedAmountKobo, net);
  const row = await prisma.collateral.create({
    data: {
      assessmentId,
      type: v.type,
      ownership: v.ownership || null,
      estimatedValueKobo: estimated!,
      verifiedValueKobo: verified,
      marketability: v.marketability,
      encumbrancesKobo: encumbrances,
      documentationStatus: v.documentationStatus as "PENDING" | "VERIFIED" | "REJECTED",
      ltv: ltvVal === null ? null : ltvVal.toFixed(4),
    },
  });
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { currentStage: Math.max(assessment.currentStage, 8) },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "COLLATERAL_ADD",
    entityType: "Collateral",
    entityId: row.id,
    after: row,
  });
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/collateral`);
}

export async function removeCollateral(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/collateral`, "Assessment not found");
  const id = String(formData.get("id") ?? "");
  const row = await prisma.collateral.findFirst({ where: { id, assessmentId } });
  if (!row) fail(`/assessments/${assessmentId}/collateral`, "Security not found");
  await prisma.collateral.delete({ where: { id } });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "COLLATERAL_REMOVE",
    entityType: "Collateral",
    entityId: id,
    before: row,
  });
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/collateral`);
}

export async function saveProductAssessment(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/product`, "Assessment not found");

  const fields = PRODUCT_FIELDS[assessment.product as keyof typeof PRODUCT_FIELDS];
  const payload: Record<string, string> = {};
  for (const f of fields) {
    const raw = String(formData.get(f.name) ?? "").trim();
    if (f.kind === "select" && !raw) {
      fail(`/assessments/${assessmentId}/product`, `Select ${f.label}`);
    }
    if (raw) payload[f.name] = raw;
  }
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes) payload.notes = notes;

  const record = {
    assessmentId,
    product: assessment.product,
    payload: payload as never,
    notes: notes || null,
  };
  const before = await prisma.productAssessment.findUnique({ where: { assessmentId } });
  const after = before
    ? await prisma.productAssessment.update({ where: { assessmentId }, data: record })
    : await prisma.productAssessment.create({ data: record });
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { currentStage: Math.max(assessment.currentStage, 9) },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "PRODUCT_SAVE",
    entityType: "ProductAssessment",
    entityId: after.id,
    before,
    after,
  });
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/product`);
}

export async function uploadDocument(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/documents`, "Assessment not found");
  if (!assessment.borrower.ninVerified || !assessment.borrower.bvnVerified) {
    fail(`/assessments/${assessmentId}/documents`, "Stage 3 is locked — verify NIN and BVN in Stage 2 first");
  }

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
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/documents`);
}

export async function saveRiskSummary(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/risk-summary`, "Assessment not found");

  const parsed = riskSummarySchema.safeParse({ mitigations: formData.get("mitigations") ?? "" });
  if (!parsed.success) {
    fail(`/assessments/${assessmentId}/risk-summary`, "Mitigations text is too long");
  }
  const flags = ((await prisma.creditProfile.findUnique({ where: { assessmentId } }))?.redFlags ?? []) as unknown as import("@engine/index").RiskFlag[];
  const fin = await prisma.financialSnapshot.findUnique({ where: { assessmentId } });
  const snapshot = {
    strengths: buildStrengths(assessment as never, fin),
    risks: flags,
    savedAt: new Date().toISOString(),
  };
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      riskSummary: snapshot as never,
      mitigationsText: parsed.data.mitigations || null,
      currentStage: Math.max(assessment.currentStage, 10),
    },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "RISKSUMMARY_SAVE",
    entityType: "Assessment",
    entityId: assessmentId,
    after: { mitigations: parsed.data.mitigations || null },
  });
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/risk-summary`);
}

function buildStrengths(assessment: {
  borrower: { clientStatusVerified: boolean };
  financialSnapshot?: { dscr?: unknown } | null;
  businessProfile?: { payload?: unknown } | null;
  collaterals?: { id: string }[];
}, fin: { dscr?: unknown; dti?: unknown } | null): string[] {
  void assessment;
  const out: string[] = [];
  if (fin && fin.dscr !== null && fin.dscr !== undefined && Number(fin.dscr) >= 1.2) {
    out.push(`Adequate debt-service cover at ${Number(fin.dscr).toFixed(2)}×.`);
  }
  if (fin && fin.dti !== null && fin.dti !== undefined && Number(fin.dti) <= 0.5) {
    out.push(`Existing debt burden within policy at ${(Number(fin.dti) * 100).toFixed(1)}% of income.`);
  }
  return out;
}

export async function saveProposal(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/amount`, "Assessment not found");

  const parsed = proposalSchema.safeParse({
    proposedNaira: formData.get("proposedNaira"),
    proposedTenor: formData.get("proposedTenor"),
  });
  if (!parsed.success) {
    fail(`/assessments/${assessmentId}/amount`, parsed.error.issues[0]?.message ?? "Invalid proposal");
  }
  let amount = 0n;
  try {
    amount = parseNairaToKobo(parsed.data.proposedNaira);
  } catch {
    fail(`/assessments/${assessmentId}/amount`, "Amount must be a number in naira");
  }
  if (amount < 0n) fail(`/assessments/${assessmentId}/amount`, "Amount cannot be negative");
  if (amount > assessment.requestedAmountKobo) {
    fail(`/assessments/${assessmentId}/amount`, "Proposed amount cannot exceed the requested amount");
  }
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      proposedAmountKobo: amount,
      proposedTenorMonths: parsed.data.proposedTenor,
      currentStage: Math.max(assessment.currentStage, 11),
    },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "PROPOSAL_SAVE",
    entityType: "Assessment",
    entityId: assessmentId,
    after: { proposedAmountKobo: amount.toString(), proposedTenorMonths: parsed.data.proposedTenor },
  });
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/amount`);
}

export async function confirmRecommendation(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/decision`, "Assessment not found");

  const parsed = confirmSchema.safeParse({
    decision: formData.get("decision"),
    amountNaira: formData.get("amountNaira"),
    tenorMonths: formData.get("tenorMonths"),
    reasons: formData.get("reasons"),
    conditions: formData.get("conditions") ?? "",
    overrideReason: formData.get("overrideReason") ?? "",
    overrideRatePct: formData.get("overrideRatePct") ?? "",
  });
  if (!parsed.success) {
    fail(`/assessments/${assessmentId}/decision`, parsed.error.issues[0]?.message ?? "Invalid decision");
  }
  const v = parsed.data;

  // Recompute the system suggestion at confirmation time (never trust the form).
  const { computeProposal } = await import("@/lib/recommendation");
  const proposal = await computeProposal(assessmentId);
  if (!proposal || !proposal.schedule) {
    fail(`/assessments/${assessmentId}/decision`, "Cannot price this facility yet — resolve blockers first");
  }

  let amount = 0n;
  try {
    amount = parseNairaToKobo(v.amountNaira);
  } catch {
    fail(`/assessments/${assessmentId}/decision`, "Amount must be a number in naira");
  }

  const differs =
    v.decision !== proposal.suggestion ||
    amount !== proposal.recommendedKobo ||
    v.tenorMonths !== proposal.tenorMonths;
  if (differs && v.overrideReason.trim().length < 10) {
    fail(
      `/assessments/${assessmentId}/decision`,
      "You changed the system suggestion — give a reason (min 10 characters)",
    );
  }

  // Rebuild the schedule for the CONFIRMED amount/tenor (analyst may have adjusted).
  const { rbSchedule, flatSchedule, scheduleEAR } = await import("@engine/index");
  const build = proposal.rateType === "RB" ? rbSchedule : flatSchedule;
  const schedule = build({
    principalKobo: amount,
    monthlyRatePct: Number(proposal.ratePct),
    tenorMonths: v.tenorMonths,
    frequency: assessment.repaymentFrequency as "MONTHLY" | "QUARTERLY" | "BULLET",
  });

  const existing = await prisma.recommendation.findUnique({ where: { assessmentId } });
  const record = {
    assessmentId,
    decision: v.decision as "APPROVE" | "REDUCED" | "DECLINE" | "REFER",
    requestedAmountKobo: assessment.requestedAmountKobo,
    recommendedAmountKobo: amount,
    recommendedTenorMonths: v.tenorMonths,
    ratePctMonthly: proposal.ratePct,
    rateType: proposal.rateType,
    rateBasis: proposal.rateBasis,
    installmentKobo: schedule.instalmentKobo,
    totalInterestKobo: schedule.totalInterestKobo,
    effectiveAnnualRatePct: (Math.round(scheduleEAR(schedule) * 100) / 100).toFixed(4),
    reasons: v.reasons,
    risks: proposal.flags as never,
    mitigations: (assessment.mitigationsText ? assessment.mitigationsText.split("\n").map((s) => s.trim()).filter(Boolean) : []) as never,
    conditions: v.conditions || null,
    analystNotes: differs ? v.overrideReason : null,
    decidedBy: session.user.id,
  };
  const rec = existing
    ? await prisma.recommendation.update({ where: { assessmentId }, data: record })
    : await prisma.recommendation.create({ data: record });

  if (differs) {
    await prisma.recommendationOverride.create({
      data: {
        recommendationId: rec.id,
        field: "DECISION",
        oldValue: `${proposal.suggestion} ${proposal.recommendedKobo.toString()} x${proposal.tenorMonths}`,
        newValue: `${v.decision} ${amount.toString()} x${v.tenorMonths}`,
        reason: v.overrideReason,
        createdBy: session.user.id,
        status: "APPROVED",
        approvedByAdmin: session.user.id,
      },
    });
  }

  // Analyst-proposed rate differing from resolved → pending Admin approval.
  if (v.overrideRatePct.trim() !== "" && v.overrideRatePct !== proposal.ratePct) {
    await prisma.recommendationOverride.create({
      data: {
        recommendationId: rec.id,
        field: "RATE",
        oldValue: `${proposal.ratePct}% ${proposal.rateType}`,
        newValue: `${v.overrideRatePct}% ${proposal.rateType}`,
        reason: v.overrideReason || "Rate adjustment proposed at decision",
        createdBy: session.user.id,
        status: "PENDING",
      },
    });
    // Alert admins by email (Phase 9 notification). Never fails the confirmation.
    try {
      const { notifyAdminsRateOverride } = await import("@/lib/email");
      await notifyAdminsRateOverride({
        borrowerName: assessment.borrower.displayName,
        assessmentId,
        oldRate: `${proposal.ratePct}% ${proposal.rateType}`,
        newRate: `${v.overrideRatePct}% ${proposal.rateType}`,
        reason: v.overrideReason,
        analystEmail: session.user.email,
      });
    } catch {
      // Email is best-effort; the pending override in /admin/overrides is authoritative.
    }
  }

  // Reprice collateral LTVs against the confirmed amount; record proposed service.
  const collaterals = await prisma.collateral.findMany({ where: { assessmentId } });
  for (const c of collaterals) {
    const { netSecurityValue, ltv } = await import("@engine/index");
    const net = netSecurityValue(c.verifiedValueKobo ?? c.estimatedValueKobo, c.encumbrancesKobo);
    const ltvVal = amount > 0n ? ltv(amount, net) : null;
    await prisma.collateral.update({
      where: { id: c.id },
      data: { ltv: ltvVal === null ? null : ltvVal.toFixed(4) },
    });
  }
  await prisma.financialSnapshot.update({
    where: { assessmentId },
    data: { proposedDebtServiceKobo: schedule.instalmentKobo },
  });
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: "RECOMMENDED" },
  });

  // Surface HIGH flags as alerts on non-declined decisions.
  if (v.decision === "APPROVE" || v.decision === "REDUCED") {
    for (const f of proposal.flags.filter((fl) => fl.severity === "HIGH")) {
      const dup = await prisma.alert.findFirst({
        where: { assessmentId, code: f.code, resolvedAt: null },
      });
      if (!dup) {
        await prisma.alert.create({
          data: {
            assessmentId,
            code: f.code,
            severity: "HIGH",
            message: `${v.decision === "APPROVE" ? "Approved" : "Approved at reduced amount"} with HIGH flag: ${f.title}`,
            whyItMatters: f.why,
            stage: 11,
          },
        });
      }
    }
  }

  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "RECOMMENDATION_CONFIRM",
    entityType: "Recommendation",
    entityId: rec.id,
    before: existing,
    after: rec,
    reason: differs ? v.overrideReason : undefined,
  });
  await refreshAlerts(assessmentId);

  // Borrower SMS on admin-confirmed APPROVE / DECLINE (best-effort).
  if (
    (v.decision === "APPROVE" || v.decision === "DECLINE") &&
    sessionRole(session) === "ADMIN" &&
    assessment.borrower.phone
  ) {
    const verdict =
      v.decision === "APPROVE"
        ? `approved for ${formatKobo(amount)}`
        : "not approved at this time";
    const text =
      `Hello ${assessment.borrower.displayName}, your CrediScout loan application was ${verdict}. ` +
      (v.decision === "APPROVE"
        ? "Our team will contact you about disbursement."
        : "Contact us for other options. Thank you.");
    try {
      const { sendSms } = await import("@/lib/sms");
      await sendSms({ to: assessment.borrower.phone, message: text });
      await logAudit({
        actorId: session.user.id,
        assessmentId,
        action: "NOTIFY_SMS",
        entityType: "Recommendation",
        entityId: rec.id,
        after: { to: assessment.borrower.phone, decision: v.decision },
      });
    } catch {
      // SMS is best-effort (e.g. number not on the test allow-list); decision stands.
    }
  }

  revalidatePath(`/assessments/${assessmentId}/decision`);
}

export async function resolveAlert(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}`, "Assessment not found");
  const id = String(formData.get("id") ?? "");
  const row = await prisma.alert.findFirst({ where: { id, assessmentId, resolvedAt: null } });
  if (!row) fail(`/assessments/${assessmentId}`, "Alert not found");
  await prisma.alert.update({ where: { id }, data: { resolvedAt: new Date() } });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "ALERT_RESOLVE",
    entityType: "Alert",
    entityId: id,
    reason: String(formData.get("reason") ?? "Manually resolved by analyst"),
  });
  revalidatePath(`/assessments/${assessmentId}`);
}

export async function disburseLoanAction(assessmentId: string, formData: FormData) {
  const session = await requireUser();
  if (sessionRole(session) !== "ADMIN") {
    fail(`/assessments/${assessmentId}/decision`, "Only admins can disburse loans");
  }
  const out = await disburseLoan({
    assessmentId,
    accountNumber: String(formData.get("accountNumber") ?? "").trim(),
    bankCode: String(formData.get("bankCode") ?? "").trim(),
    adminId: session.user.id,
  });
  if (!out.ok) fail(`/assessments/${assessmentId}/decision`, out.error);
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/decision`);
}

export async function setDocumentStatus(
  assessmentId: string,
  formData: FormData,
) {
  const session = await requireUser();
  const assessment = await getAssessmentForUser(assessmentId, session);
  if (!assessment) fail(`/assessments/${assessmentId}/documents`, "Assessment not found");
  if (!assessment.borrower.ninVerified || !assessment.borrower.bvnVerified) {
    fail(`/assessments/${assessmentId}/documents`, "Stage 3 is locked — verify NIN and BVN in Stage 2 first");
  }

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
  await refreshAlerts(assessmentId);
  revalidatePath(`/assessments/${assessmentId}/documents`);
}
