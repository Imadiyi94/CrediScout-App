import { describe, expect, it } from "vitest";
import { dti, dscr, loanToIncome, exposureSplit } from "./ratios";

describe("dti", () => {
  it("divides service by income", () => {
    expect(dti(410_000_00n, 1_000_000_00n)).toBeCloseTo(0.41, 10);
  });
  it("returns null on zero income", () => {
    expect(dti(100n, 0n)).toBeNull();
  });
});

describe("dscr", () => {
  it("computes the worked example 1.45x", () => {
    expect(dscr(1_450_000_00n, 1_000_000_00n)).toBeCloseTo(1.45, 10);
  });
  it("returns null with no debt service", () => {
    expect(dscr(500n, 0n)).toBeNull();
  });
  it("flags weak cover below 1", () => {
    expect(dscr(800_000_00n, 1_000_000_00n)).toBeLessThan(1);
  });
});

describe("loanToIncome", () => {
  it("relates facility to income", () => {
    expect(loanToIncome(5_000_000_00n, 20_000_000_00n)).toBeCloseTo(0.25, 10);
  });
  it("returns null on zero income", () => {
    expect(loanToIncome(5n, 0n)).toBeNull();
  });
});

describe("exposureSplit", () => {
  it("sums existing and proposed", () => {
    const s = exposureSplit(1_200_000_00n, 3_200_000_00n);
    expect(s.totalKobo).toBe(4_400_000_00n);
    expect(s.existingKobo).toBe(1_200_000_00n);
    expect(s.proposedKobo).toBe(3_200_000_00n);
  });
});
