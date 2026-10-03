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

// Worked example: ₦3.2m falls in the ≤₦5m band → 5.00% RB, 12 months → ≈₦361,037/mo.
// (Authoritative schedules come from the Phase 4 credit engine.)
export const demoSchedule = {
  rows: [
    { period: 1, openingKobo: 320000000, instalmentKobo: 36103700, principalKobo: 20103700, interestKobo: 16000000, closingKobo: 299896300 },
    { period: 2, openingKobo: 299896300, instalmentKobo: 36103700, principalKobo: 21108900, interestKobo: 14994800, closingKobo: 278787400 },
    { period: 3, openingKobo: 278787400, instalmentKobo: 36103700, principalKobo: 22164300, interestKobo: 13939400, closingKobo: 256623100 },
    { period: "…", openingKobo: null, instalmentKobo: 36103700, principalKobo: 0, interestKobo: 0, closingKobo: null },
    { period: "Total (12 mo)", openingKobo: null, instalmentKobo: 433244400, principalKobo: 320000000, interestKobo: 113244400, closingKobo: 0, total: true },
  ],
  earNote: "Effective annual rate ≈ 79.6% — shown for transparency (RB nominal 5.00%/mo).",
};
