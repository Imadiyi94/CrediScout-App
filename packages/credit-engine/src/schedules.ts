import { Decimal } from "decimal.js";
import type { Frequency, Schedule, ScheduleRow } from "./types";

function toBigKobo(d: Decimal): bigint {
  return BigInt(d.toNearest(1, Decimal.ROUND_HALF_UP).toFixed(0));
}

// Equal-instalment reducing-balance amortisation.
// Quarterly: rate triples per 3-month period. Bullet: single payment at maturity.
export function rbSchedule(args: {
  principalKobo: bigint;
  monthlyRatePct: number;
  tenorMonths: number;
  frequency?: Frequency;
}): Schedule {
  const { principalKobo, monthlyRatePct, tenorMonths } = args;
  const frequency = args.frequency ?? "MONTHLY";
  if (principalKobo <= 0n) throw new Error("Principal must be above zero");
  if (tenorMonths < 1) throw new Error("Tenor must be at least 1 month");

  const P = new Decimal(principalKobo.toString());

  if (frequency === "BULLET") {
    const interest = toBigKobo(P.mul(monthlyRatePct).div(100).mul(tenorMonths));
    const instalment = principalKobo + interest;
    return {
      instalmentKobo: instalment,
      rows: [
        {
          period: 1,
          openingKobo: principalKobo,
          instalmentKobo: instalment,
          principalKobo,
          interestKobo: interest,
          closingKobo: 0n,
        },
      ],
      totalPrincipalKobo: principalKobo,
      totalInterestKobo: interest,
      totalPaidKobo: instalment,
      periods: 1,
      monthsPerPeriod: tenorMonths,
    };
  }

  const monthsPerPeriod = frequency === "QUARTERLY" ? 3 : 1;
  const periods = Math.ceil(tenorMonths / monthsPerPeriod);
  const i = new Decimal(monthlyRatePct).div(100).mul(monthsPerPeriod);

  let instalment: bigint;
  if (i.isZero()) {
    instalment = toBigKobo(P.div(periods));
  } else {
    // A = P·i / (1 − (1+i)^−n)
    const a = P.mul(i).div(new Decimal(1).minus(new Decimal(1).plus(i).pow(-periods)));
    instalment = toBigKobo(a);
  }

  const rows: ScheduleRow[] = [];
  let opening = P;
  let totalInterest = 0n;
  for (let p = 1; p <= periods; p++) {
    const interest = toBigKobo(opening.mul(i));
    let principal = instalment - interest;
    let paid = instalment;
    if (principal >= BigInt(opening.toFixed(0)) || p === periods) {
      principal = BigInt(opening.toNearest(1, Decimal.ROUND_HALF_UP).toFixed(0));
      paid = principal + interest;
    }
    const closing = opening.minus(principal);
    rows.push({
      period: p,
      openingKobo: BigInt(opening.toNearest(1, Decimal.ROUND_HALF_UP).toFixed(0)),
      instalmentKobo: paid,
      principalKobo: principal,
      interestKobo: interest,
      closingKobo: BigInt(closing.toNearest(1, Decimal.ROUND_HALF_UP).toFixed(0)),
    });
    totalInterest += interest;
    opening = closing;
  }

  const totalPrincipal = rows.reduce((s, r) => s + r.principalKobo, 0n);
  const totalPaid = rows.reduce((s, r) => s + r.instalmentKobo, 0n);
  return {
    instalmentKobo: rows[0]?.instalmentKobo ?? 0n,
    rows,
    totalPrincipalKobo: totalPrincipal,
    totalInterestKobo: totalInterest,
    totalPaidKobo: totalPaid,
    periods,
    monthsPerPeriod,
  };
}

// Flat-rate: interest on the ORIGINAL principal for the full tenor.
export function flatSchedule(args: {
  principalKobo: bigint;
  monthlyRatePct: number;
  tenorMonths: number;
  frequency?: Frequency;
}): Schedule {
  const { principalKobo, monthlyRatePct, tenorMonths } = args;
  const frequency = args.frequency ?? "MONTHLY";
  if (principalKobo <= 0n) throw new Error("Principal must be above zero");
  if (tenorMonths < 1) throw new Error("Tenor must be at least 1 month");

  const monthsPerPeriod = frequency === "BULLET" ? tenorMonths : frequency === "QUARTERLY" ? 3 : 1;
  const periods = frequency === "BULLET" ? 1 : Math.ceil(tenorMonths / monthsPerPeriod);
  const totalInterest = toBigKobo(
    new Decimal(principalKobo.toString()).mul(monthlyRatePct).div(100).mul(tenorMonths),
  );
  const totalPaid = principalKobo + totalInterest;

  const rows: ScheduleRow[] = [];
  let openingPrincipal = principalKobo;
  let interestLeft = totalInterest;
  for (let p = 1; p <= periods; p++) {
    const last = p === periods;
    // Split principal/interest as evenly as possible; remainder lands in the last row.
    const principal =
      last
        ? openingPrincipal
        : principalKobo / BigInt(periods) +
          (BigInt(p) <= principalKobo % BigInt(periods) ? 1n : 0n);
    const interest = last ? interestLeft : totalInterest / BigInt(periods);
    rows.push({
      period: p,
      openingKobo: openingPrincipal,
      instalmentKobo: principal + interest,
      principalKobo: principal,
      interestKobo: interest,
      closingKobo: openingPrincipal - principal,
    });
    openingPrincipal -= principal;
    interestLeft -= interest;
  }

  return {
    instalmentKobo: rows[0]?.instalmentKobo ?? 0n,
    rows,
    totalPrincipalKobo: principalKobo,
    totalInterestKobo: totalInterest,
    totalPaidKobo: totalPaid,
    periods,
    monthsPerPeriod,
  };
}

// Effective annual rate from schedule cashflows (bisection on NPV).
// Returns percent, e.g. 79.59 for ₦3.2m @ 5.00% RB × 12.
export function scheduleEAR(schedule: Schedule): number {
  const P = Number(schedule.totalPrincipalKobo);
  const cf = schedule.rows.map((r) => Number(r.instalmentKobo));
  const perYear = 12 / schedule.monthsPerPeriod;
  const npv = (periodic: number) =>
    cf.reduce((s, c, i) => s + c / Math.pow(1 + periodic, i + 1), 0) - P;
  let lo = 0;
  let hi = 1;
  while (npv(hi) > 0 && hi < 100) hi *= 2;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (Math.pow(1 + (lo + hi) / 2, perYear) - 1) * 100;
}
