// Pure alert-rule evaluation. The server layer (lib/alerts.ts) reconciles
// drafts against stored alerts: creates new ones, resolves cleared ones.

export type AlertSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface AlertDraft {
  code: string;
  severity: AlertSeverity;
  message: string;
  whyItMatters: string;
  stage: number;
}

export interface AlertFacts {
  currentStage: number;
  clientVerified: boolean;
  missingDocKinds: string[];
  hasFinancials: boolean;
  dscr: number | null;
  dti: number | null;
  dscrMin: number;
  dtiMax: number;
  hasCreditProfile: boolean;
  worstFlagSeverity: "HIGH" | "MEDIUM" | "LOW" | null;
  pendingCollateralDocs: number;
  maxLtv: number | null;
  ltvCap: number | null;
}

export function evaluateAlertRules(f: AlertFacts): AlertDraft[] {
  const out: AlertDraft[] = [];
  const push = (d: AlertDraft) => out.push(d);

  if (!f.clientVerified && f.currentStage >= 2) {
    push({
      code: "UNVERIFIED_CLIENT",
      severity: "MEDIUM",
      message: "Client status (New/Returning) is unverified — pricing cannot be finalised.",
      whyItMatters: "The SBL/SME rate tier depends on verified status; an unverified flag blocks the recommendation.",
      stage: 2,
    });
  }

  if (f.missingDocKinds.length > 0 && f.currentStage >= 3) {
    push({
      code: "CRITICAL_DOCS_PENDING",
      severity: "MEDIUM",
      message: `Critical documents unverified: ${f.missingDocKinds.join(", ")}.`,
      whyItMatters: "Capacity and identity conclusions rest on unverified paper until these are reviewed.",
      stage: 3,
    });
  }

  if (f.hasFinancials) {
    if (f.dscr !== null && f.dscr < f.dscrMin) {
      push({
        code: "WEAK_DSCR",
        severity: "HIGH",
        message: `DSCR ${f.dscr.toFixed(2)}× is below the ${f.dscrMin}× policy minimum.`,
        whyItMatters: "Cash flow does not cover existing obligations — any new facility starts underwater.",
        stage: 4,
      });
    }
    if (f.dti !== null && f.dti > f.dtiMax) {
      push({
        code: "HIGH_DTI",
        severity: "MEDIUM",
        message: `DTI ${(f.dti * 100).toFixed(1)}% exceeds the ${(f.dtiMax * 100).toFixed(0)}% cap.`,
        whyItMatters: "The borrower already commits too much income to debt; new service has no buffer.",
        stage: 4,
      });
    }
  }

  if (f.worstFlagSeverity === "HIGH") {
    push({
      code: "HIGH_RISK_FLAGS",
      severity: "HIGH",
      message: "One or more HIGH credit-risk flags are open.",
      whyItMatters: "HIGH flags (default, arrears, maxed utilisation) must be mitigated or the amount haircut before approval.",
      stage: 5,
    });
  }

  if (f.pendingCollateralDocs > 0) {
    push({
      code: "COLLATERAL_DOCS_PENDING",
      severity: "MEDIUM",
      message: `${f.pendingCollateralDocs} collateral item${f.pendingCollateralDocs > 1 ? "s" : ""} lack verified documentation.`,
      whyItMatters: "Unverified security cannot count toward cover at recommendation.",
      stage: 7,
    });
  }

  if (f.maxLtv !== null && f.ltvCap !== null && f.maxLtv > f.ltvCap) {
    push({
      code: "HIGH_LTV",
      severity: f.maxLtv > f.ltvCap * 1.2 ? "HIGH" : "MEDIUM",
      message: `Highest LTV ${(f.maxLtv * 100).toFixed(1)}% exceeds the ${(f.ltvCap * 100).toFixed(0)}% cap.`,
      whyItMatters: "Exposure is too large relative to the security value; a price dip leaves the loan under-collateralised.",
      stage: 7,
    });
  }

  return out;
}
