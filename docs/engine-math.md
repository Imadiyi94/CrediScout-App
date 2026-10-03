# Engine Math (`packages/credit-engine`)

All money in integer kobo (`bigint`); rates in percent-per-month (`number`);
`Decimal.js` intermediates, half-up rounding per row, final row absorbs residuals.

## Reducing balance (equal instalments)
Monthly rate `i = pct/100`, `n` periods:
`A = P·i / (1 − (1+i)^−n)`, rounded to whole kobo.
Per row: `interest = round(opening × i)`, `principal = instalment − interest`
(last row: `principal = opening`, instalment recomputed → closes to 0).
Quarterly: 3-month periods at `3i`. Bullet: single payment `P + P·i·months`.

Worked check: ₦3,200,000 @ 5.00% × 12 → ₦361,041.31/mo, ₦1,132,495.74 interest.

## Flat rate
`totalInterest = P × r × months` on the ORIGINAL principal; split evenly across
periods (remainder in last row). Same nominal rate always costs more than RB.

Worked check: ₦1,000,000 @ 3.00% × 12 → ₦360,000 interest.

## Effective annual rate
Bisection on NPV of the schedule cashflows → periodic IRR → annualised
`(1+i)^periodsPerYear − 1`. RB 5%/mo → 79.59%; flat 3%/mo × 12 → above 36% nominal.

## Supportable amount
Binary-searches the largest principal whose instalment keeps
`DSCR = cashFlow / (existing + newService) ≥ dscrMin`, rounded DOWN to ₦50,000
steps (configurable). Returns `0n` when nothing is feasible. Existing service is
always counted first.

## Rate bands (PRD §17)
Recommended amount (not requested) + verified status → row. First band
max-inclusive; others min-inclusive/max-exclusive; top open-ended. Verified:
₦3.2m Returning SBL → 5.00% RB; ₦5m exactly → 5.00%; ₦5,000,001 → 4.65%;
₦10m → 4.60%; ₦50m Returning → 3.50%.

## Qualitative & risk & alerts
8-dimension 1–5 average → Strong ≥ 4 / Adequate ≥ 3 / Fragile ≥ 2 / else Critical.
Risk rules and alert rules are deterministic tables in `risk.ts` / `alerts.ts`;
every flag/alert carries why-it-matters + mitigation/clearing stage.
