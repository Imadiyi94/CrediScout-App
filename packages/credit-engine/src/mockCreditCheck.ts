// Deterministic mock credit-bureau check (no external calls).
// Same BVN always returns the same report — demos and tests stay trustworthy.
// Different BVNs look random. Scores span the standard 300–850 bureau range.

export interface MockBureauScore {
  provider: "MOCK-FirstCentral" | "MOCK-CRC";
  score: number;
  delinquencies: number;
  outstandingLoans: number;
}

export interface MockCreditReport {
  bvn: string;
  firstCentral: MockBureauScore;
  crc: MockBureauScore;
  averageScore: number;
}

// FNV-1a hash → stable seed per BVN.
function seedFrom(bvn: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bvn.length; i++) {
    h ^= bvn.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 — small deterministic PRNG.
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mockCreditCheck(bvn: string): MockCreditReport {
  const digits = bvn.replace(/\D/g, "");
  if (digits.length !== 11) throw new Error("BVN must be 11 digits");

  const rand = prng(seedFrom(digits));
  const score = () => 300 + Math.floor(rand() * 551); // 300–850 inclusive
  const firstCentral: MockBureauScore = {
    provider: "MOCK-FirstCentral",
    score: score(),
    delinquencies: Math.floor(rand() * 7),
    outstandingLoans: Math.floor(rand() * 6),
  };
  const crc: MockBureauScore = {
    provider: "MOCK-CRC",
    score: score(),
    delinquencies: Math.floor(rand() * 7),
    outstandingLoans: Math.floor(rand() * 6),
  };
  return {
    bvn: digits,
    firstCentral,
    crc,
    averageScore: Math.round(((firstCentral.score + crc.score) / 2) * 100) / 100,
  };
}
