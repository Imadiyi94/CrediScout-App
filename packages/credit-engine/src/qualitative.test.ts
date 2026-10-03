import { describe, expect, it } from "vitest";
import { scoreQualitative, validateRating, type QualitativeAnswers } from "./qualitative";

const STRONG: QualitativeAnswers = {
  history: 5, industry: 4, management: 5, stability: 4,
  concentration: 4, seasonality: 4, purpose: 5, repayment: 5,
};

describe("scoreQualitative", () => {
  it("averages all eight dimensions", () => {
    const r = scoreQualitative(STRONG);
    expect(r.average).toBeCloseTo(4.5, 2);
    expect(r.band).toBe("Strong");
    expect(r.weakest).toHaveLength(0);
  });

  it("bands Adequate / Fragile / Critical", () => {
    const adeq = scoreQualitative({ ...STRONG, history: 2, industry: 2 });
    expect(adeq.band).toBe("Adequate");
    const frag = scoreQualitative({ history: 2, industry: 2, management: 2, stability: 2, concentration: 3, seasonality: 3, purpose: 3, repayment: 3 });
    expect(frag.band).toBe("Fragile");
    const crit = scoreQualitative({ history: 1, industry: 1, management: 1, stability: 1, concentration: 1, seasonality: 1, purpose: 1, repayment: 1 });
    expect(crit.band).toBe("Critical");
  });

  it("names the weakest dimensions", () => {
    const r = scoreQualitative({ ...STRONG, concentration: 1, seasonality: 2 });
    expect(r.weakest).toContain("Customer / supplier spread");
    expect(r.weakest).toContain("Seasonality handling");
  });

  it("rejects out-of-range ratings", () => {
    expect(() => scoreQualitative({ ...STRONG, history: 0 })).toThrow();
    expect(() => scoreQualitative({ ...STRONG, history: 6 })).toThrow();
  });

  it("validates rating bounds", () => {
    expect(validateRating(1) && validateRating(5)).toBe(true);
    expect(validateRating(0) || validateRating(6) || validateRating(2.5)).toBe(false);
  });
});
