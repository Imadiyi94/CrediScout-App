import { describe, expect, it } from "vitest";
import { supportableAmount } from "./solver";
import { dscr } from "./ratios";
import { rbSchedule } from "./schedules";

const RATE = { monthlyRatePct: 5, rateType: "RB" as const, tenorMonths: 12 };

describe("supportableAmount", () => {
  it("supports the full request when capacity is generous", () => {
    const got = supportableAmount({ cashFlowKobo: 5_000_000_00n, dscrMin: 1.2, ...RATE });
    expect(got).toBeGreaterThanOrEqual(5_000_000_00n);
  });

  it("haircuts the request when capacity is tight", () => {
    const got = supportableAmount({ cashFlowKobo: 500_000_00n, dscrMin: 1.2, ...RATE });
    expect(got).toBeGreaterThan(0n);
    expect(got).toBeLessThan(5_000_000_00n);
  });

  it("result satisfies the DSCR floor", () => {
    const cash = 500_000_00n;
    const got = supportableAmount({ cashFlowKobo: cash, dscrMin: 1.2, ...RATE });
    const service = rbSchedule({ principalKobo: got, monthlyRatePct: 5, tenorMonths: 12 }).instalmentKobo;
    expect(dscr(cash, service)).toBeGreaterThanOrEqual(1.2);
  });

  it("rounds DOWN to the step (default ₦50,000)", () => {
    const got = supportableAmount({ cashFlowKobo: 500_000_00n, dscrMin: 1.2, ...RATE });
    expect(got % 5_000_000n).toBe(0n);
  });

  it("returns zero when cash flow cannot cover anything", () => {
    expect(supportableAmount({ cashFlowKobo: 0n, dscrMin: 1.2, ...RATE })).toBe(0n);
    expect(supportableAmount({ cashFlowKobo: -100n, dscrMin: 1.2, ...RATE })).toBe(0n);
  });

  it("accounts for existing service before proposing", () => {
    const free = supportableAmount({ cashFlowKobo: 1_000_000_00n, dscrMin: 1.2, ...RATE });
    const burdened = supportableAmount({
      cashFlowKobo: 1_000_000_00n,
      existingServiceKobo: 400_000_00n,
      dscrMin: 1.2,
      ...RATE,
    });
    expect(burdened).toBeLessThan(free);
  });

  it("works for flat-rate products", () => {
    const got = supportableAmount({
      cashFlowKobo: 500_000_00n,
      dscrMin: 1.2,
      monthlyRatePct: 3,
      rateType: "FLAT",
      tenorMonths: 12,
    });
    expect(got).toBeGreaterThan(0n);
    expect(got % 5_000_000n).toBe(0n);
  });
});
