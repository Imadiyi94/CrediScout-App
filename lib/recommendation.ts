import { prisma } from "./db";
import { resolveRate } from "./pricing";
import { formatKobo } from "./format";
import {
  dscr,
  flatSchedule,
  rbSchedule,
  scheduleEAR,
  supportableAmount,
  type Frequency,
  type RateType,
  type RiskFlag,
  type Schedule,
} from "@engine/index";
import { CRITICAL_KINDS } from "./documents";

export type Decision = "APPROVE" | "REDUCED" | "DECLINE" | "REFER";

export interface Proposal {
  requestedKobo: bigint;
  supportableKobo: bigint;
  recommendedKobo: bigint;
  tenorMonths: number;
  ratePct: string;
  rateType: RateType;
  rateBasis: string;
  schedule: Schedule | null;
  earPct: number | null;
  dscrFinal: number | null;
  flags: RiskFlag[];
  blockers: string[];
  suggestion: Decision;
  reasonsDraft: string;
  conditionsDraft: string;
}

async function thresholds() {
  const rows = await prisma.policyThreshold.findMany({ where: { product: null } });
  const get = (k: string, fallback: number) => Number(rows.find((r) => r.key === k)?.value ?? fallback);
  return { dscrMin: get("DSCR_MIN", 1.2), dtiMax: get("DTI_MAX", 0.5) };
}

// Two-pass proposal: solve at the requested-amount rate, re-resolve at the
// supportable amount, solve again. Amount/tenor overrides (Stage 10 analyst
// adjustments, Stage 11 proposed values) replace the computed recommendation.
export async function computeProposal(
  assessmentId: string,
  overrides?: { amountKobo?: bigint; tenorMonths?: number },
): Promise<Proposal | null> {
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      borrower: true,
      financialSnapshot: true,
      creditProfile: true,
      businessProfile: true,
      collaterals: true,
      productAssessment: true,
      documents: true,
    },
  });
  if (!a || !a.financialSnapshot || !a.creditProfile) return null;

  const fin = a.financialSnapshot;
  const flags = (a.creditProfile.redFlags ?? []) as unknown as RiskFlag[];
  const { dscrMin } = await thresholds();
  const frequency = a.repaymentFrequency as Frequency;
  const requestedKobo = a.requestedAmountKobo;
  const tenorMonths = overrides?.tenorMonths ?? a.proposedTenorMonths;

  // --- Blockers gate (REFER) ---
  const blockers: string[] = [];
  if (!a.borrower.clientStatusVerified) blockers.push("Client status (New/Returning) is unverified — verify in Stage 2.");
  const verifiedKinds = new Set(
    a.documents.filter((d) => d.verificationStatus === "VERIFIED").map((d) => d.kind),
  );
  const missingDocs = (CRITICAL_KINDS as string[]).filter((k) => !verifiedKinds.has(k));
  if (missingDocs.length > 0) blockers.push(`Critical documents unverified: ${missingDocs.join(", ")}.`);
  if (fin.cashFlowKobo <= 0n) blockers.push("No positive cash flow on file — revisit Stage 4.");

  // --- Amount: two-pass solve at the applicable rate ---
  const rate0 = await resolveRate({ product: a.product, amountKobo: requestedKobo, clientStatus: a.borrower.clientStatus });
  const supp0 = rate0
    ? supportableAmount({
        cashFlowKobo: fin.cashFlowKobo,
        existingServiceKobo: fin.existingDebtServiceKobo,
        dscrMin,
        monthlyRatePct: Number(rate0.ratePctMonthly),
        rateType: rate0.rateType,
        tenorMonths,
        frequency,
      })
    : 0n;
  const computed = supp0 <= 0n ? 0n : supp0 < requestedKobo ? supp0 : requestedKobo;
  const recommendedKobo = overrides?.amountKobo ?? computed;

  const rate = await resolveRate({ product: a.product, amountKobo: recommendedKobo > 0n ? recommendedKobo : requestedKobo, clientStatus: a.borrower.clientStatus });
  const ratePct = rate ? String(rate.ratePctMonthly) : "0";
  const rateType: RateType = rate?.rateType ?? "RB";
  const rateBasis = rate
    ? `${a.borrower.clientStatus === "RETURNING" ? "Returning" : "New"} · ${a.product}${rate.clientStatus ? "" : " · all clients"}${a.borrower.clientStatusVerified ? " · verified" : " · UNVERIFIED"}`
    : "No active rate row";

  let schedule: Schedule | null = null;
  let earPct: number | null = null;
  let dscrFinal: number | null = null;
  if (rate && recommendedKobo > 0n) {
    const build = rateType === "RB" ? rbSchedule : flatSchedule;
    schedule = build({ principalKobo: recommendedKobo, monthlyRatePct: Number(ratePct), tenorMonths, frequency });
    earPct = Math.round(scheduleEAR(schedule) * 100) / 100;
    dscrFinal = dscr(fin.cashFlowKobo, fin.existingDebtServiceKobo + schedule.instalmentKobo);
  }

  // --- Decision suggestion ---
  const highFlags = flags.filter((f) => f.severity === "HIGH");
  let suggestion: Decision;
  if (blockers.length > 0) suggestion = "REFER";
  else if (recommendedKobo <= 0n || (dscrFinal !== null && dscrFinal < dscrMin)) suggestion = "DECLINE";
  else if (recommendedKobo < requestedKobo || highFlags.length > 0) suggestion = "REDUCED";
  else suggestion = "APPROVE";

  // --- Drafts ---
  const parts: string[] = [];
  if (suggestion === "REFER") parts.push(`Further review required: ${blockers.join(" ")}`);
  else {
    parts.push(
      `Assessed repayment capacity ${recommendedKobo >= requestedKobo ? "supports the full requested facility" : `supports ${formatKobo(recommendedKobo)} against ${formatKobo(requestedKobo)} requested`}.`,
    );
    if (dscrFinal !== null) parts.push(`Cover at ${dscrFinal.toFixed(2)}× against the ${dscrMin}× policy minimum.`);
    if (highFlags.length > 0) parts.push(`Capped by ${highFlags.length} HIGH risk flag${highFlags.length > 1 ? "s" : ""}: ${highFlags.map((f) => f.title).join("; ")}.`);
    const band = ((a.businessProfile?.payload ?? {}) as { band?: string }).band;
    if (band) parts.push(`Qualitative assessment: ${band}.`);
  }
  const coverageNote =
    a.collaterals.length > 0
      ? "Security on file supports — but does not replace — the capacity verdict."
      : "No security on file; decision rests on repayment capacity alone.";
  parts.push(coverageNote);

  const conditions: string[] = ["Satisfactory verification of supporting financial information."];
  if (missingDocs.length > 0) conditions.push(`Verify before disbursement: ${missingDocs.join(", ")}.`);
  if (highFlags.some((f) => f.code === "HIGH_EXPOSURE" || f.code === "ELEVATED_EXPOSURE")) {
    conditions.push("Settle or restructure existing facilities to bring total exposure within policy before disbursement.");
  }
  if (a.collaterals.some((c) => c.documentationStatus !== "VERIFIED") && a.collaterals.length > 0) {
    conditions.push("Complete security documentation for all collateral items.");
  }

  return {
    requestedKobo,
    supportableKobo: supp0,
    recommendedKobo,
    tenorMonths,
    ratePct,
    rateType,
    rateBasis,
    schedule,
    earPct,
    dscrFinal,
    flags,
    blockers,
    suggestion,
    reasonsDraft: parts.join(" "),
    conditionsDraft: conditions.join(" "),
  };
}
