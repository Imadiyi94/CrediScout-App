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

// Worked example: ₦3.2m, 4.60% RB, 12 months → ≈₦352,942/mo.
// (Authoritative schedules come from the Phase 4 credit engine.)
export const demoSchedule = {
  rows: [
    { period: 1, openingKobo: 320000000, instalmentKobo: 35294200, principalKobo: 20574200, interestKobo: 14720000, closingKobo: 299425800 },
    { period: 2, openingKobo: 299425800, instalmentKobo: 35294200, principalKobo: 21520600, interestKobo: 13773600, closingKobo: 277905200 },
    { period: 3, openingKobo: 277905200, instalmentKobo: 35294200, principalKobo: 22510600, interestKobo: 12783600, closingKobo: 255394600 },
    { period: "…", openingKobo: null, instalmentKobo: 35294200, principalKobo: 0, interestKobo: 0, closingKobo: null },
    { period: "Total (12 mo)", openingKobo: null, instalmentKobo: 423530400, principalKobo: 320000000, interestKobo: 103530400, closingKobo: 0, total: true },
  ],
  earNote: "Effective annual rate ≈ 71.5% — shown for transparency (RB nominal 4.60%/mo).",
};
