// Rule-based credit-risk evaluation. Deterministic, no framework imports.
// Every flag carries: what was found → why it matters → suggested mitigation.

export type RiskSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface RiskFlag {
  code: string;
  severity: RiskSeverity;
  title: string;
  why: string;
  mitigation: string;
}

export type RepaymentGrade = "A" | "B" | "C" | "D" | "NONE";

export interface CreditRiskInput {
  repaymentGrade: RepaymentGrade;
  priorDelinquencies: number;
  priorDefaults: number;
  arrearsNow: boolean;
  /** Total obligations across facilities, kobo. */
  totalExposureKobo: bigint;
  /** Borrower monthly income, kobo. Null when unknown. */
  monthlyIncomeKobo: bigint | null;
  openFacilities: number;
  /** Highest utilization seen, 0–100. Null when unknown/not applicable. */
  maxUtilizationPct: number | null;
  /** Outstanding guaranteed facilities, kobo. */
  guarantorExposureKobo: bigint;
  hasMultipleLenders: boolean;
}

export interface CreditRiskResult {
  flags: RiskFlag[];
  worstSeverity: RiskSeverity | null;
}

const F = (
  code: string,
  severity: RiskSeverity,
  title: string,
  why: string,
  mitigation: string,
): RiskFlag => ({ code, severity, title, why, mitigation });

export function evaluateCreditRisk(input: CreditRiskInput): CreditRiskResult {
  const flags: RiskFlag[] = [];
  const income = input.monthlyIncomeKobo;

  if (input.priorDefaults > 0) {
    flags.push(
      F(
        "PRIOR_DEFAULT",
        "HIGH",
        `Prior default${input.priorDefaults > 1 ? `s (${input.priorDefaults})` : ""} on record`,
        "A previous default is the strongest predictor of future non-repayment; it signals willingness or capacity failure under stress.",
        "Require full settlement evidence plus 12 months of clean performance since; otherwise decline or demand full collateral cover.",
      ),
    );
  }

  if (input.arrearsNow) {
    flags.push(
      F(
        "ARREARS_NOW",
        "HIGH",
        "Currently in arrears on an existing facility",
        "New money behind an already-delinquent borrower layers exposure on demonstrated distress.",
        "Condition any approval on bringing arrears current first and re-verify before disbursement.",
      ),
    );
  } else if (input.priorDelinquencies >= 3) {
    flags.push(
      F(
        "REPEAT_DELINQUENCY",
        "HIGH",
        `${input.priorDelinquencies} prior delinquencies`,
        "Repeated lateness shows chronic cash-flow tightness or weak repayment discipline, even without a formal default.",
        "Haircut the supportable amount and shorten tenor; add a covenant to report repayment performance quarterly.",
      ),
    );
  } else if (input.priorDelinquencies >= 1) {
    flags.push(
      F(
        "PRIOR_DELINQUENCY",
        "MEDIUM",
        `${input.priorDelinquencies} prior delinquenc${input.priorDelinquencies > 1 ? "ies" : "y"}`,
        "Isolated lateness may reflect one-off strain, but it weakens the repayment-history grade.",
        "Seek written explanation with evidence; monitor first three instalments closely.",
      ),
    );
  }

  if (income !== null && income > 0n && input.totalExposureKobo > 0n) {
    const multiple = Number(input.totalExposureKobo) / Number(income);
    if (multiple > 6) {
      flags.push(
        F(
          "HIGH_EXPOSURE",
          "HIGH",
          `Total exposure is ${multiple.toFixed(1)}× monthly income`,
          "Debt stock above 6× monthly income leaves almost no shock absorber; any income dip breaks cover.",
          "Reduce the recommended amount until total exposure sits below 6× income, or require partial settlement of existing facilities.",
        ),
      );
    } else if (multiple > 3) {
      flags.push(
        F(
          "ELEVATED_EXPOSURE",
          "MEDIUM",
          `Total exposure is ${multiple.toFixed(1)}× monthly income`,
          "Exposure above 3× monthly income concentrates risk on continued income stability.",
          "Stress the recommendation against a 20% income drop before approving the full amount.",
        ),
      );
    }
  }

  if (input.maxUtilizationPct !== null) {
    if (input.maxUtilizationPct >= 90) {
      flags.push(
        F(
          "MAXED_UTILIZATION",
          "HIGH",
          `Credit utilization at ${input.maxUtilizationPct}%`,
          "Facilities drawn to the limit suggest the borrower is funding obligations with debt rather than income.",
          "Treat available limits as already spent in the capacity analysis; do not count undrawn headroom as a buffer.",
        ),
      );
    } else if (input.maxUtilizationPct >= 70) {
      flags.push(
        F(
          "HIGH_UTILIZATION",
          "MEDIUM",
          `Credit utilization at ${input.maxUtilizationPct}%`,
          "Heavy utilization narrows the borrower's room to absorb shocks without new borrowing.",
          "Cap the recommended amount so total utilization stays below 70% after disbursement.",
        ),
      );
    }
  }

  if (input.hasMultipleLenders || input.openFacilities >= 3) {
    flags.push(
      F(
        "MULTIPLE_BORROWING",
        "MEDIUM",
        input.hasMultipleLenders
          ? "Obligations spread across multiple lenders"
          : `${input.openFacilities} open facilities`,
        "Fragmented borrowing hides total indebtedness and raises the risk of cross-default the analyst cannot see.",
        "Obtain a full credit-bureau report and reconcile every facility before finalising the exposure figure.",
      ),
    );
  }

  if (input.guarantorExposureKobo > 0n) {
    const heavy = income !== null && income > 0n && input.guarantorExposureKobo > income;
    flags.push(
      F(
        "GUARANTOR_LOAD",
        heavy ? "HIGH" : "MEDIUM",
        "Standing guarantor on another facility",
        heavy
          ? "The guaranteed exposure alone exceeds a month of income — a call on the guarantee would immediately impair this loan."
          : "Guarantees are contingent debt that can crystallise without warning and compete with this facility.",
        "Quantify the guaranteed facility's performance; if it is delinquent, treat the guaranteed amount as live exposure.",
      ),
    );
  }

  if (input.repaymentGrade === "NONE") {
    flags.push(
      F(
        "THIN_HISTORY",
        "LOW",
        "No repayment history on file",
        "Without a track record the analysis leans entirely on current financials, which may not reflect behaviour under stress.",
        "Start with a smaller facility and shorter tenor to build history before larger exposures.",
      ),
    );
  } else if (input.repaymentGrade === "D") {
    flags.push(
      F(
        "POOR_GRADE",
        "HIGH",
        "Repayment history graded D",
        "The lowest passing grade indicates persistent repayment problems across the history window.",
        "Decline unless fully mitigated by fresh collateral and a verified new repayment source.",
      ),
    );
  } else if (input.repaymentGrade === "C") {
    flags.push(
      F(
        "WEAK_GRADE",
        "MEDIUM",
        "Repayment history graded C",
        "A below-average grade means late payments are a pattern, not an exception.",
        "Apply a supportable-amount haircut and require the first quarter of repayments by direct debit.",
      ),
    );
  }

  const rank: Record<RiskSeverity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const worst = flags.reduce<RiskSeverity | null>(
    (w, f) => (w === null || rank[f.severity] > rank[w] ? f.severity : w),
    null,
  );
  return { flags, worstSeverity: worst };
}
