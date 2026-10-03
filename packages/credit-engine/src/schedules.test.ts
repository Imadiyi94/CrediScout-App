import { describe, expect, it } from "vitest";
import { flatSchedule, rbSchedule, scheduleEAR } from "./schedules";

const M3_2 = 320_000_000n; // ₦3.2m in kobo

describe("rbSchedule", () => {
  it("reproduces the design fixture: 3.2m @ 5.00% x 12 -> 361,041.31/mo", () => {
    const s = rbSchedule({ principalKobo: M3_2, monthlyRatePct: 5, tenorMonths: 12 });
    expect(s.periods).toBe(12);
    expect(s.instalmentKobo).toBe(36_104_131n);
    expect(s.totalPrincipalKobo).toBe(M3_2);
    expect(s.totalPaidKobo).toBe(s.totalPrincipalKobo + s.totalInterestKobo);
    expect(s.rows[s.rows.length - 1]?.closingKobo).toBe(0n);
  });

  it("charges first-month interest on full principal", () => {
    const s = rbSchedule({ principalKobo: M3_2, monthlyRatePct: 5, tenorMonths: 12 });
    expect(s.rows[0]?.interestKobo).toBe(16_000_000n); // 3.2m x 5%
    expect(s.rows[0]?.principalKobo).toBe(s.instalmentKobo - 16_000_000n);
  });

  it("declines in interest over time (reducing balance)", () => {
    const s = rbSchedule({ principalKobo: M3_2, monthlyRatePct: 5, tenorMonths: 12 });
    expect(s.rows[11]?.interestKobo as bigint).toBeLessThan(s.rows[0]?.interestKobo as bigint);
  });

  it("handles zero rate as straight split", () => {
    const s = rbSchedule({ principalKobo: 1_200_000_00n, monthlyRatePct: 0, tenorMonths: 12 });
    expect(s.totalInterestKobo).toBe(0n);
    expect(s.totalPrincipalKobo).toBe(1_200_000_00n);
    expect(s.rows[s.rows.length - 1]?.closingKobo).toBe(0n);
  });

  it("rejects non-positive principal", () => {
    expect(() => rbSchedule({ principalKobo: 0n, monthlyRatePct: 5, tenorMonths: 12 })).toThrow();
  });

  it("quarterly uses 3-month periods with tripled rate", () => {
    const s = rbSchedule({ principalKobo: M3_2, monthlyRatePct: 5, tenorMonths: 12, frequency: "QUARTERLY" });
    expect(s.periods).toBe(4);
    expect(s.monthsPerPeriod).toBe(3);
    expect(s.rows[s.rows.length - 1]?.closingKobo).toBe(0n);
    expect(s.totalPrincipalKobo).toBe(M3_2);
  });

  it("bullet pays everything once at maturity", () => {
    const s = rbSchedule({ principalKobo: M3_2, monthlyRatePct: 5, tenorMonths: 12, frequency: "BULLET" });
    expect(s.periods).toBe(1);
    expect(s.totalInterestKobo).toBe(192_000_000n); // 3.2m x 5% x 12
    expect(s.rows[0]?.closingKobo).toBe(0n);
  });
});

describe("flatSchedule", () => {
  it("charges interest on original principal: 1m @ 3% x 12 -> 360k interest", () => {
    const s = flatSchedule({ principalKobo: 100_000_000n, monthlyRatePct: 3, tenorMonths: 12 });
    expect(s.totalInterestKobo).toBe(36_000_000n);
    expect(s.totalPrincipalKobo).toBe(100_000_000n);
    expect(s.totalPaidKobo).toBe(136_000_000n);
    expect(s.rows[s.rows.length - 1]?.closingKobo).toBe(0n);
  });

  it("exceeds RB totals for the same nominal rate", () => {
    const rb = rbSchedule({ principalKobo: 100_000_000n, monthlyRatePct: 3, tenorMonths: 12 });
    const flat = flatSchedule({ principalKobo: 100_000_000n, monthlyRatePct: 3, tenorMonths: 12 });
    expect(flat.totalInterestKobo).toBeGreaterThan(rb.totalInterestKobo);
  });

  it("quarterly splits into 4 instalments", () => {
    const s = flatSchedule({ principalKobo: 100_000_000n, monthlyRatePct: 3, tenorMonths: 12, frequency: "QUARTERLY" });
    expect(s.periods).toBe(4);
    expect(s.totalInterestKobo).toBe(36_000_000n);
  });
});

describe("scheduleEAR", () => {
  it("annualises RB 5%/mo to ~79.59%", () => {
    const s = rbSchedule({ principalKobo: M3_2, monthlyRatePct: 5, tenorMonths: 12 });
    expect(scheduleEAR(s)).toBeCloseTo(79.59, 1);
  });

  it("annualises RB 4.6%/mo to ~71.55%", () => {
    const s = rbSchedule({ principalKobo: M3_2, monthlyRatePct: 4.6, tenorMonths: 12 });
    expect(scheduleEAR(s)).toBeCloseTo(71.55, 1);
  });

  it("prices flat loans above their nominal rate", () => {
    const s = flatSchedule({ principalKobo: 100_000_000n, monthlyRatePct: 3, tenorMonths: 12 });
    expect(scheduleEAR(s)).toBeGreaterThan(3 * 12);
  });
});
