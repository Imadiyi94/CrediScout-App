# ADR 0004 — Integer kobo for all money

Date: 2026-09-27 · Status: accepted

## Context
Naira amounts with interest math must never drift by fractions of a kobo.

## Decision
`BigInt` kobo in the database and engine; `Decimal.js` for intermediate rate math
with half-up rounding to whole kobo per amortisation row; the final row absorbs
residuals so schedules close exactly to zero. Display via `formatKobo()` (₦, no decimals).

## Consequences
+ Totals reconcile to the kobo; audit-safe.
+ JSON transport needs care (BigInt → Number/String at boundaries; done in loaders).
