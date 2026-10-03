import { describe, expect, it } from "vitest";
import { evaluateCreditRisk, type CreditRiskInput } from "./risk";

const CLEAN: CreditRiskInput = {
  repaymentGrade: "A",
  priorDelinquencies: 0,
  priorDefaults: 0,
  arrearsNow: false,
  totalExposureKobo: 1_000_000_00n,
  monthlyIncomeKobo: 1_000_000_00n,
  openFacilities: 1,
  maxUtilizationPct: 30,
  guarantorExposureKobo: 0n,
  hasMultipleLenders: false,
};

describe("evaluateCreditRisk", () => {
  it("returns no flags for a clean profile", () => {
    const r = evaluateCreditRisk(CLEAN);
    expect(r.flags).toHaveLength(0);
    expect(r.worstSeverity).toBeNull();
  });

  it("flags prior default as HIGH", () => {
    const r = evaluateCreditRisk({ ...CLEAN, priorDefaults: 1 });
    expect(r.flags.map((f) => f.code)).toContain("PRIOR_DEFAULT");
    expect(r.worstSeverity).toBe("HIGH");
  });

  it("flags current arrears as HIGH", () => {
    const r = evaluateCreditRisk({ ...CLEAN, arrearsNow: true });
    expect(r.flags.map((f) => f.code)).toContain("ARREARS_NOW");
    expect(r.worstSeverity).toBe("HIGH");
  });

  it("tiers delinquency: 1-2 MEDIUM, 3+ HIGH", () => {
    const med = evaluateCreditRisk({ ...CLEAN, priorDelinquencies: 2 });
    expect(med.flags.map((f) => f.code)).toContain("PRIOR_DELINQUENCY");
    expect(med.flags.find((f) => f.code === "PRIOR_DELINQUENCY")?.severity).toBe("MEDIUM");
    const high = evaluateCreditRisk({ ...CLEAN, priorDelinquencies: 3 });
    expect(high.flags.map((f) => f.code)).toContain("REPEAT_DELINQUENCY");
    expect(high.worstSeverity).toBe("HIGH");
  });

  it("tiers exposure: >3x MEDIUM, >6x HIGH", () => {
    const med = evaluateCreditRisk({ ...CLEAN, totalExposureKobo: 4_000_000_00n });
    expect(med.flags.map((f) => f.code)).toContain("ELEVATED_EXPOSURE");
    const high = evaluateCreditRisk({ ...CLEAN, totalExposureKobo: 7_000_000_00n });
    expect(high.flags.map((f) => f.code)).toContain("HIGH_EXPOSURE");
    expect(high.worstSeverity).toBe("HIGH");
  });

  it("skips exposure flags when income is unknown", () => {
    const r = evaluateCreditRisk({ ...CLEAN, monthlyIncomeKobo: null, totalExposureKobo: 99_000_000_00n });
    expect(r.flags.map((f) => f.code)).not.toContain("HIGH_EXPOSURE");
  });

  it("tiers utilization: 70+ MEDIUM, 90+ HIGH", () => {
    const med = evaluateCreditRisk({ ...CLEAN, maxUtilizationPct: 75 });
    expect(med.flags.map((f) => f.code)).toContain("HIGH_UTILIZATION");
    const high = evaluateCreditRisk({ ...CLEAN, maxUtilizationPct: 95 });
    expect(high.flags.map((f) => f.code)).toContain("MAXED_UTILIZATION");
  });

  it("flags multiple borrowing by lender count or facility count", () => {
    expect(evaluateCreditRisk({ ...CLEAN, hasMultipleLenders: true }).flags.map((f) => f.code)).toContain("MULTIPLE_BORROWING");
    expect(evaluateCreditRisk({ ...CLEAN, openFacilities: 3 }).flags.map((f) => f.code)).toContain("MULTIPLE_BORROWING");
    expect(evaluateCreditRisk({ ...CLEAN, openFacilities: 2 }).flags.map((f) => f.code)).not.toContain("MULTIPLE_BORROWING");
  });

  it("flags guarantor load, HIGH when above monthly income", () => {
    const med = evaluateCreditRisk({ ...CLEAN, guarantorExposureKobo: 500_000_00n });
    expect(med.flags.find((f) => f.code === "GUARANTOR_LOAD")?.severity).toBe("MEDIUM");
    const high = evaluateCreditRisk({ ...CLEAN, guarantorExposureKobo: 2_000_000_00n });
    expect(high.flags.find((f) => f.code === "GUARANTOR_LOAD")?.severity).toBe("HIGH");
  });

  it("flags thin file as LOW and poor grades accordingly", () => {
    const thin = evaluateCreditRisk({ ...CLEAN, repaymentGrade: "NONE" });
    expect(thin.flags.find((f) => f.code === "THIN_HISTORY")?.severity).toBe("LOW");
    expect(evaluateCreditRisk({ ...CLEAN, repaymentGrade: "C" }).flags.map((f) => f.code)).toContain("WEAK_GRADE");
    expect(evaluateCreditRisk({ ...CLEAN, repaymentGrade: "D" }).flags.map((f) => f.code)).toContain("POOR_GRADE");
  });

  it("every flag carries why + mitigation", () => {
    const r = evaluateCreditRisk({
      ...CLEAN,
      priorDefaults: 1,
      arrearsNow: true,
      maxUtilizationPct: 95,
      guarantorExposureKobo: 5_000_000_00n,
      repaymentGrade: "D",
    });
    expect(r.flags.length).toBeGreaterThan(3);
    for (const f of r.flags) {
      expect(f.why.length).toBeGreaterThan(10);
      expect(f.mitigation.length).toBeGreaterThan(10);
    }
  });
});
