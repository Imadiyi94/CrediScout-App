// Pure credit-math core. No framework imports — usable from UI, API, and tests.
// Money: integer kobo (bigint). Rates: percent-per-month (number).

export type RateType = "RB" | "FLAT";
export type Frequency = "MONTHLY" | "QUARTERLY" | "BULLET";

export interface ScheduleRow {
  period: number;
  openingKobo: bigint;
  instalmentKobo: bigint;
  principalKobo: bigint;
  interestKobo: bigint;
  closingKobo: bigint;
}

export interface Schedule {
  instalmentKobo: bigint;
  rows: ScheduleRow[];
  totalPrincipalKobo: bigint;
  totalInterestKobo: bigint;
  totalPaidKobo: bigint;
  periods: number;
  monthsPerPeriod: number;
}

export const KOBO_PER_NAIRA = 100n;
