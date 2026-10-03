import { dscr } from "./ratios";
import { flatSchedule, rbSchedule } from "./schedules";
import type { Frequency, RateType } from "./types";

function serviceFor(
  principalKobo: bigint,
  monthlyRatePct: number,
  rateType: RateType,
  tenorMonths: number,
  frequency: Frequency,
): bigint {
  const s =
    rateType === "RB"
      ? rbSchedule({ principalKobo, monthlyRatePct, tenorMonths, frequency })
      : flatSchedule({ principalKobo, monthlyRatePct, tenorMonths, frequency });
  return s.instalmentKobo;
}

// Largest principal whose debt service keeps DSCR >= dscrMin.
// Rounds DOWN to roundToKobo (default ₦50,000). Returns 0n when unfeasible.
export function supportableAmount(args: {
  cashFlowKobo: bigint;
  existingServiceKobo?: bigint;
  dscrMin: number;
  monthlyRatePct: number;
  rateType: RateType;
  tenorMonths: number;
  frequency?: Frequency;
  roundToKobo?: bigint;
}): bigint {
  const {
    cashFlowKobo,
    dscrMin,
    monthlyRatePct,
    rateType,
    tenorMonths,
  } = args;
  const existing = args.existingServiceKobo ?? 0n;
  const frequency = args.frequency ?? "MONTHLY";
  const roundTo = args.roundToKobo ?? 5_000_000n; // ₦50,000

  if (cashFlowKobo <= 0n || dscrMin <= 0) return 0n;
  const feasible = (p: bigint) => {
    if (p <= 0n) return true;
    const service = existing + serviceFor(p, monthlyRatePct, rateType, tenorMonths, frequency);
    const cover = dscr(cashFlowKobo, service);
    return cover !== null && cover >= dscrMin;
  };

  if (!feasible(roundTo)) {
    // Even the smallest step fails — check whether anything at all fits.
    if (!feasible(100n)) return 0n;
    let hi = 100n;
    while (feasible(hi) && hi < 10_000_000_000_000_000n) hi *= 2n;
    let lo = 0n;
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2n;
      if (mid === lo || mid === hi) break;
      if (feasible(mid)) lo = mid;
      else hi = mid;
    }
    return (lo / roundTo) * roundTo;
  }

  let hi = roundTo;
  while (feasible(hi) && hi < 10_000_000_000_000_000n) hi *= 2n;
  let lo = 0n;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2n;
    if (mid === lo || mid === hi) break;
    if (feasible(mid)) lo = mid;
    else hi = mid;
  }
  return (lo / roundTo) * roundTo;
}
