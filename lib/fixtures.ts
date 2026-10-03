import type { StageStatus } from "@/lib/stages";

export const demoStageStates: StageStatus[] = [
  "complete",
  "complete",
  "complete",
  "complete",
  "active",
  "todo",
  "todo",
  "todo",
  "attention",
  "todo",
  "todo",
];

// Worked example: ₦3.2m falls in the ≤₦5m band → 5.00% RB, 12 months → ₦361,041.31/mo.
// (Authoritative schedules come from the Phase 4 credit engine.)
export const demoSchedule = {
  rows: [
    { period: 1, openingKobo: 320000000, instalmentKobo: 36104131, principalKobo: 20104131, interestKobo: 16000000, closingKobo: 299895869 },
    { period: 2, openingKobo: 299895869, instalmentKobo: 36104131, principalKobo: 21109338, interestKobo: 14994793, closingKobo: 278786531 },
    { period: 3, openingKobo: 278786531, instalmentKobo: 36104131, principalKobo: 22164804, interestKobo: 13939327, closingKobo: 256621727 },
    { period: "…", openingKobo: null, instalmentKobo: 36104131, principalKobo: 0, interestKobo: 0, closingKobo: null },
    { period: "Total (12 mo)", openingKobo: null, instalmentKobo: 433249574, principalKobo: 320000000, interestKobo: 113249574, closingKobo: 0, total: true },
  ],
  earNote: "Effective annual rate ≈ 79.59% — shown for transparency (RB nominal 5.00%/mo).",
};
