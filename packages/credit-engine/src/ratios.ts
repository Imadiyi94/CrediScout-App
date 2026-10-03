import { Decimal } from "decimal.js";

// Debt-to-Income: total debt service relative to income. Null when income is zero.
export function dti(totalDebtServiceKobo: bigint, incomeKobo: bigint): number | null {
  if (incomeKobo <= 0n) return null;
  return new Decimal(totalDebtServiceKobo.toString()).div(incomeKobo.toString()).toNumber();
}

// Debt Service Coverage Ratio: cash flow relative to debt service.
// Null when there is no debt service (nothing to cover).
export function dscr(cashFlowKobo: bigint, debtServiceKobo: bigint): number | null {
  if (debtServiceKobo <= 0n) return null;
  return new Decimal(cashFlowKobo.toString()).div(debtServiceKobo.toString()).toNumber();
}

// Loan-to-Income: facility size relative to earning capacity. Null on zero income.
export function loanToIncome(loanKobo: bigint, incomeKobo: bigint): number | null {
  if (incomeKobo <= 0n) return null;
  return new Decimal(loanKobo.toString()).div(incomeKobo.toString()).toNumber();
}

// Loan-to-Value: proposed exposure relative to security value.
// Null when the security has no positive net value.
export function ltv(loanKobo: bigint, netSecurityKobo: bigint): number | null {
  if (netSecurityKobo <= 0n) return null;
  return new Decimal(loanKobo.toString()).div(netSecurityKobo.toString()).toNumber();
}

// Net security value after existing encumbrances (floored at zero).
export function netSecurityValue(verifiedOrEstimatedKobo: bigint, encumbrancesKobo: bigint): bigint {
  const net = verifiedOrEstimatedKobo - encumbrancesKobo;
  return net > 0n ? net : 0n;
}

export interface ExposureSplit {
  existingKobo: bigint;
  proposedKobo: bigint;
  totalKobo: bigint;
}

export function exposureSplit(existingKobo: bigint, proposedKobo: bigint): ExposureSplit {
  return { existingKobo, proposedKobo, totalKobo: existingKobo + proposedKobo };
}
