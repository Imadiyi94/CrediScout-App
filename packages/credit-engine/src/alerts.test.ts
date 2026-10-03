import { describe, expect, it } from "vitest";
import { evaluateAlertRules, type AlertFacts } from "./alerts";

const BASE: AlertFacts = {
  currentStage: 11,
  clientVerified: true,
  missingDocKinds: [],
  hasFinancials: true,
  dscr: 1.45,
  dti: 0.3,
  dscrMin: 1.2,
  dtiMax: 0.5,
  hasCreditProfile: true,
  worstFlagSeverity: null,
  pendingCollateralDocs: 0,
  maxLtv: 0.6,
  ltvCap: 0.75,
};

describe("evaluateAlertRules", () => {
  it("is quiet on a healthy file", () => {
    expect(evaluateAlertRules(BASE)).toHaveLength(0);
  });

  it("flags unverified client from stage 2", () => {
    const r = evaluateAlertRules({ ...BASE, clientVerified: false });
    expect(r.map((d) => d.code)).toContain("UNVERIFIED_CLIENT");
    expect(evaluateAlertRules({ ...BASE, clientVerified: false, currentStage: 1 })).toHaveLength(0);
  });

  it("flags missing critical docs", () => {
    const r = evaluateAlertRules({ ...BASE, missingDocKinds: ["identity"] });
    const d = r.find((x) => x.code === "CRITICAL_DOCS_PENDING");
    expect(d?.severity).toBe("MEDIUM");
    expect(d?.stage).toBe(3);
  });

  it("flags weak DSCR as HIGH", () => {
    const r = evaluateAlertRules({ ...BASE, dscr: 0.9 });
    expect(r.find((d) => d.code === "WEAK_DSCR")?.severity).toBe("HIGH");
  });

  it("flags high DTI as MEDIUM and stays quiet at the cap", () => {
    expect(evaluateAlertRules({ ...BASE, dti: 0.62 }).map((d) => d.code)).toContain("HIGH_DTI");
    expect(evaluateAlertRules({ ...BASE, dti: 0.5 })).toHaveLength(0);
  });

  it("mirrors HIGH credit flags", () => {
    const r = evaluateAlertRules({ ...BASE, worstFlagSeverity: "HIGH" });
    expect(r.map((d) => d.code)).toContain("HIGH_RISK_FLAGS");
    expect(evaluateAlertRules({ ...BASE, worstFlagSeverity: "MEDIUM" }).map((d) => d.code)).not.toContain("HIGH_RISK_FLAGS");
  });

  it("flags unverified collateral docs", () => {
    const r = evaluateAlertRules({ ...BASE, pendingCollateralDocs: 2 });
    expect(r.find((d) => d.code === "COLLATERAL_DOCS_PENDING")?.message).toMatch(/2 collateral items/);
  });

  it("tiers LTV breaches, HIGH past 120% of cap", () => {
    const med = evaluateAlertRules({ ...BASE, maxLtv: 0.8 });
    expect(med.find((d) => d.code === "HIGH_LTV")?.severity).toBe("MEDIUM");
    const high = evaluateAlertRules({ ...BASE, maxLtv: 0.95 });
    expect(high.find((d) => d.code === "HIGH_LTV")?.severity).toBe("HIGH");
  });

  it("skips LTV when no cap or no security", () => {
    expect(evaluateAlertRules({ ...BASE, ltvCap: null }).map((d) => d.code)).not.toContain("HIGH_LTV");
    expect(evaluateAlertRules({ ...BASE, maxLtv: null }).map((d) => d.code)).not.toContain("HIGH_LTV");
  });

  it("every draft explains why it matters", () => {
    const r = evaluateAlertRules({
      ...BASE,
      clientVerified: false,
      missingDocKinds: ["bank-statement"],
      dscr: 0.8,
      dti: 0.9,
      worstFlagSeverity: "HIGH",
      pendingCollateralDocs: 1,
      maxLtv: 0.99,
    });
    expect(r.length).toBeGreaterThan(4);
    for (const d of r) {
      expect(d.whyItMatters.length).toBeGreaterThan(10);
      expect(d.stage).toBeGreaterThanOrEqual(2);
    }
  });
});
