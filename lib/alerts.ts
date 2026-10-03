import { prisma } from "./db";
import { evaluateAlertRules } from "@engine/index";
import { CRITICAL_KINDS } from "./documents";

// Recomputes an assessment's alerts from current facts: creates newly-tripped
// alerts, resolves cleared ones. Called after every mutating assessment action.
export async function refreshAlerts(assessmentId: string) {
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      borrower: true,
      financialSnapshot: true,
      creditProfile: true,
      documents: true,
      collaterals: true,
    },
  });
  if (!a) return;

  const thresholds = await prisma.policyThreshold.findMany();
  const get = (key: string, product: string | null, fallback: number) => {
    const exact = thresholds.find((t) => t.key === key && t.product === (product as never));
    const global = thresholds.find((t) => t.key === key && t.product === null);
    return Number((exact ?? global)?.value ?? fallback);
  };

  const verifiedKinds = new Set(
    a.documents.filter((d) => d.verificationStatus === "VERIFIED").map((d) => d.kind),
  );
  const flags = ((a.creditProfile?.redFlags ?? []) as unknown as { severity?: string }[]);
  const worst = flags.some((f) => f.severity === "HIGH")
    ? ("HIGH" as const)
    : flags.some((f) => f.severity === "MEDIUM")
      ? ("MEDIUM" as const)
      : flags.length > 0
        ? ("LOW" as const)
        : null;
  const ltvs = a.collaterals.map((c) => (c.ltv === null ? null : Number(c.ltv))).filter((v) => v !== null);

  const drafts = evaluateAlertRules({
    currentStage: a.currentStage,
    clientVerified: a.borrower.clientStatusVerified,
    missingDocKinds: (CRITICAL_KINDS as string[]).filter((k) => !verifiedKinds.has(k)),
    hasFinancials: a.financialSnapshot !== null,
    dscr: a.financialSnapshot?.dscr === null || a.financialSnapshot?.dscr === undefined ? null : Number(a.financialSnapshot.dscr),
    dti: a.financialSnapshot?.dti === null || a.financialSnapshot?.dti === undefined ? null : Number(a.financialSnapshot.dti),
    dscrMin: get("DSCR_MIN", null, 1.2),
    dtiMax: get("DTI_MAX", null, 0.5),
    hasCreditProfile: a.creditProfile !== null,
    worstFlagSeverity: worst,
    pendingCollateralDocs: a.collaterals.filter((c) => c.documentationStatus !== "VERIFIED").length,
    maxLtv: ltvs.length > 0 ? Math.max(...ltvs) : null,
    ltvCap: (() => {
      const row = thresholds.find((t) => t.key === "LTV_MAX" && t.product === (a.product as never));
      return row ? Number(row.value) : null;
    })(),
  });

  const open = await prisma.alert.findMany({ where: { assessmentId, resolvedAt: null } });
  const liveCodes = new Set(drafts.map((d) => d.code));

  for (const d of drafts) {
    const existing = open.find((o) => o.code === d.code);
    if (existing) {
      if (existing.message !== d.message || existing.severity !== d.severity) {
        await prisma.alert.update({
          where: { id: existing.id },
          data: { message: d.message, severity: d.severity, whyItMatters: d.whyItMatters, stage: d.stage },
        });
      }
    } else {
      await prisma.alert.create({
        data: {
          assessmentId,
          code: d.code,
          severity: d.severity,
          message: d.message,
          whyItMatters: d.whyItMatters,
          stage: d.stage,
        },
      });
    }
  }
  for (const o of open) {
    if (!liveCodes.has(o.code)) {
      await prisma.alert.update({ where: { id: o.id }, data: { resolvedAt: new Date() } });
    }
  }
}
