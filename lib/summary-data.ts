import { prisma } from "./db";
import { formatKobo } from "./format";
import { PRODUCT_LABELS, type ProductKey } from "./products";
import { DOC_KIND_LABELS, type DocKind } from "./documents";
import {
  flatSchedule,
  rbSchedule,
  scheduleEAR,
  type RiskFlag,
  type Schedule,
} from "@engine/index";

export interface SummaryData {
  borrowerName: string;
  borrowerType: string;
  clientStatus: string;
  clientVerified: boolean;
  product: string;
  requestedKobo: bigint;
  proposedTenor: number;
  loanPurpose: string;
  repaymentSource: string;
  frequency: string;
  existingExposureKobo: bigint;
  status: string;
  currentStage: number;
  financials: {
    revenue: string; opex: string; net: string; cashFlow: string;
    existingService: string; proposedService: string;
    dti: string | null; dscr: string | null; lti: string | null; notes: string | null;
  } | null;
  credit: { grade: string | null; exposure: string; utilization: string | null; guarantor: string; flags: RiskFlag[] } | null;
  qualitative: { score: string | null; band: string | null; weakest: string[]; notes: string | null } | null;
  collaterals: { type: string; value: string; encumbrances: string; ltv: string | null; docs: string; marketability: string | null }[];
  coveragePct: string | null;
  productAssessment: { fields: Record<string, string>; notes: string | null } | null;
  documents: { kind: string; name: string; status: string }[];
  strengths: string[];
  risks: { title: string; severity: string }[];
  mitigations: string[];
  recommendation: {
    decision: string; amount: string; tenor: number; rate: string; rateBasis: string;
    instalment: string; totalInterest: string; ear: string | null;
    reasons: string; conditions: string | null; decided: string;
    schedule: { period: number; openingKobo: number; instalmentKobo: number; principalKobo: number; interestKobo: number; closingKobo: number }[];
  } | null;
}

export async function getSummaryData(assessmentId: string): Promise<SummaryData | null> {
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      borrower: true,
      financialSnapshot: true,
      creditProfile: true,
      businessProfile: true,
      collaterals: true,
      productAssessment: true,
      documents: { orderBy: { createdAt: "asc" } },
      recommendation: true,
    },
  });
  if (!a) return null;

  const fin = a.financialSnapshot;
  const credit = a.creditProfile;
  const flags = ((credit?.redFlags ?? []) as unknown) as RiskFlag[];
  const qualPayload = ((a.businessProfile?.payload ?? {}) as { band?: string; weakest?: string[] });
  const totalNet = a.collaterals.reduce((s, c) => {
    const base = c.verifiedValueKobo ?? c.estimatedValueKobo;
    const net = base - c.encumbrancesKobo;
    return s + (net > 0n ? net : 0n);
  }, 0n);

  let recommendation: SummaryData["recommendation"] = null;
  const r = a.recommendation;
  if (r) {
    let schedule: Schedule | null = null;
    let ear: string | null = null;
    try {
      const build = r.rateType === "RB" ? rbSchedule : flatSchedule;
      schedule = build({
        principalKobo: r.recommendedAmountKobo,
        monthlyRatePct: Number(r.ratePctMonthly),
        tenorMonths: r.recommendedTenorMonths,
        frequency: a.repaymentFrequency as "MONTHLY" | "QUARTERLY" | "BULLET",
      });
      ear = scheduleEAR(schedule).toFixed(2);
    } catch {
      schedule = null;
    }
    recommendation = {
      decision: r.decision.replace("_", " "),
      amount: formatKobo(r.recommendedAmountKobo),
      tenor: r.recommendedTenorMonths,
      rate: `${String(r.ratePctMonthly)}% ${r.rateType} / month`,
      rateBasis: r.rateBasis,
      instalment: r.installmentKobo !== null ? formatKobo(r.installmentKobo) : "—",
      totalInterest: r.totalInterestKobo !== null ? formatKobo(r.totalInterestKobo) : "—",
      ear,
      reasons: r.reasons ?? "—",
      conditions: r.conditions,
      decided: r.decidedAt.toLocaleDateString("en-NG"),
      schedule: (schedule?.rows ?? []).map((row) => ({
        period: row.period,
        openingKobo: Number(row.openingKobo),
        instalmentKobo: Number(row.instalmentKobo),
        principalKobo: Number(row.principalKobo),
        interestKobo: Number(row.interestKobo),
        closingKobo: Number(row.closingKobo),
      })),
    };
  }

  const strengths: string[] = [];
  if (fin && fin.dscr !== null && Number(fin.dscr) >= 1.2) strengths.push(`Debt-service cover ${Number(fin.dscr).toFixed(2)}× (≥ 1.20× policy).`);
  if (fin && fin.dti !== null && Number(fin.dti) <= 0.5) strengths.push(`Debt burden ${(Number(fin.dti) * 100).toFixed(1)}% of income (≤ 50% policy).`);
  if (fin && fin.cashFlowKobo > 0n) strengths.push("Positive operating cash flow.");
  if (qualPayload.band === "Strong" || qualPayload.band === "Adequate") strengths.push(`Qualitative: ${qualPayload.band}.`);
  if (a.borrower.clientStatusVerified) strengths.push("Client status verified.");

  return {
    borrowerName: a.borrower.displayName,
    borrowerType: a.borrower.type,
    clientStatus: a.borrower.clientStatus,
    clientVerified: a.borrower.clientStatusVerified,
    product: PRODUCT_LABELS[a.product as ProductKey],
    requestedKobo: a.requestedAmountKobo,
    proposedTenor: a.proposedTenorMonths,
    loanPurpose: a.loanPurpose,
    repaymentSource: a.repaymentSource,
    frequency: a.repaymentFrequency,
    existingExposureKobo: a.existingExposureKobo,
    status: a.status.replace("_", " "),
    currentStage: a.currentStage,
    financials: fin
      ? {
          revenue: formatKobo(fin.revenueKobo),
          opex: formatKobo(fin.opexKobo),
          net: formatKobo(fin.netIncomeKobo),
          cashFlow: formatKobo(fin.cashFlowKobo),
          existingService: formatKobo(fin.existingDebtServiceKobo),
          proposedService: formatKobo(fin.proposedDebtServiceKobo),
          dti: fin.dti === null ? null : `${(Number(fin.dti) * 100).toFixed(1)}%`,
          dscr: fin.dscr === null ? null : `${Number(fin.dscr).toFixed(2)}×`,
          lti: fin.loanToIncome === null ? null : `${Number(fin.loanToIncome).toFixed(2)}×`,
          notes: fin.notes,
        }
      : null,
    credit: credit
      ? {
          grade: credit.repaymentHistoryGrade,
          exposure: formatKobo(credit.totalExposureKobo),
          utilization: credit.utilizationPct === null ? null : `${Number(credit.utilizationPct).toFixed(1)}%`,
          guarantor: formatKobo(credit.guarantorObligationsKobo),
          flags,
        }
      : null,
    qualitative: a.businessProfile
      ? {
          score: a.businessProfile.qualitativeScore === null ? null : `${Number(a.businessProfile.qualitativeScore).toFixed(2)} / 5.00`,
          band: qualPayload.band ?? null,
          weakest: qualPayload.weakest ?? [],
          notes: a.businessProfile.notes,
        }
      : null,
    collaterals: a.collaterals.map((c) => ({
      type: c.type,
      value: formatKobo(c.verifiedValueKobo ?? c.estimatedValueKobo),
      encumbrances: formatKobo(c.encumbrancesKobo),
      ltv: c.ltv === null ? null : `${(Number(c.ltv) * 100).toFixed(1)}%`,
      docs: c.documentationStatus,
      marketability: c.marketability,
    })),
    coveragePct:
      a.requestedAmountKobo > 0n && totalNet > 0n
        ? `${(Number((totalNet * 10_000n) / a.requestedAmountKobo) / 100).toFixed(0)}%`
        : null,
    productAssessment: a.productAssessment
      ? { fields: (a.productAssessment.payload ?? {}) as Record<string, string>, notes: a.productAssessment.notes }
      : null,
    documents: a.documents.map((d) => ({
      kind: DOC_KIND_LABELS[d.kind as DocKind] ?? d.kind,
      name: d.originalName,
      status: d.verificationStatus,
    })),
    strengths,
    risks: flags.map((f) => ({ title: f.title, severity: f.severity })),
    mitigations: (a.mitigationsText ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    recommendation,
  };
}
