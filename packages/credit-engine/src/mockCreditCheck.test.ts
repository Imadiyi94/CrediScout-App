import { describe, expect, it } from "vitest";
import { mockCreditCheck } from "./mockCreditCheck";

describe("mockCreditCheck", () => {
  it("returns both bureaus plus the average", () => {
    const r = mockCreditCheck("22222222222");
    expect(r.bvn).toBe("22222222222");
    expect(r.firstCentral.provider).toBe("MOCK-FirstCentral");
    expect(r.crc.provider).toBe("MOCK-CRC");
    expect(r.averageScore).toBeCloseTo((r.firstCentral.score + r.crc.score) / 2, 2);
  });

  it("keeps scores inside 300–850", () => {
    for (const bvn of ["22222222222", "12345678901", "99999999999", "08012345678".slice(0, 11)]) {
      const r = mockCreditCheck(bvn);
      expect(r.firstCentral.score).toBeGreaterThanOrEqual(300);
      expect(r.firstCentral.score).toBeLessThanOrEqual(850);
      expect(r.crc.score).toBeGreaterThanOrEqual(300);
      expect(r.crc.score).toBeLessThanOrEqual(850);
    }
  });

  it("is deterministic per BVN", () => {
    const a = mockCreditCheck("22222222222");
    const b = mockCreditCheck("22222222222");
    expect(a).toEqual(b);
  });

  it("differs across BVNs", () => {
    const a = mockCreditCheck("22222222222");
    const b = mockCreditCheck("12345678901");
    expect(
      a.firstCentral.score !== b.firstCentral.score || a.crc.score !== b.crc.score,
    ).toBe(true);
  });

  it("keeps counts in sane ranges", () => {
    const r = mockCreditCheck("22222222222");
    for (const s of [r.firstCentral, r.crc]) {
      expect(s.delinquencies).toBeGreaterThanOrEqual(0);
      expect(s.delinquencies).toBeLessThanOrEqual(6);
      expect(s.outstandingLoans).toBeGreaterThanOrEqual(0);
      expect(s.outstandingLoans).toBeLessThanOrEqual(5);
    }
  });

  it("rejects non-11-digit input", () => {
    expect(() => mockCreditCheck("123")).toThrow();
    expect(() => mockCreditCheck("2222222222a".replace("a", ""))).toThrow();
  });

  it("normalises formatted input", () => {
    const plain = mockCreditCheck("22222222222");
    const spaced = mockCreditCheck("222 2222 2222");
    expect(spaced).toEqual(plain);
  });
});
