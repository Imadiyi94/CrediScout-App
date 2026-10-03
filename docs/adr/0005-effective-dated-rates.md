# ADR 0005 — Effective-dated, never-edited rate tables

Date: 2026-09-27 · Status: accepted

## Context
Lending rates change over time, but old recommendations must keep the rate they were
decided at (auditability, disputes).

## Decision
`RateTable` rows carry `effectiveFrom/effectiveTo/active` and are never updated or
deleted — only expired (sets `effectiveTo`) and superseded by new rows. Recommendations
snapshot the resolved rate into their own columns. Band rule: first band (min 0) is
max-inclusive ("≤ ₦5,000,000"); other bands are min-inclusive/max-exclusive, so exact
higher boundaries fall in the higher band (see `docs/engine-math.md`).

## Consequences
+ Full pricing history; dry-run preview uses the same resolver as decisions.
+ Admin UI must make expire-then-add the obvious path (it does; no edit button exists).
