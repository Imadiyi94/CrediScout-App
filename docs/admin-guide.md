# Admin Guide

Sign in with an ADMIN account (`/admin`). Designers and managers operate as scoped
Admins — grant only the scopes they need (`rates:write`, `users:write`, `audit:read`
are informational; enforcement today is role-wide).

## Lending rates (`/admin/rates`)
- **Dry-run first**: enter product + status + recommended amount to preview the
  resolved rate — the same resolver decisions use.
- **Never edit a row.** To change pricing: **Expire** the old row, then **Add** the
  replacement. Old recommendations keep their snapshot rate (ADR 0005).
- New row: product, client (blank = all clients, for fixed-rate products),
  min inclusive, max exclusive (blank = open-ended top band), %/month, RB/FLAT, note.
- Boundary rule: first band max-inclusive (exactly ₦5,000,000 → 5.00%); higher exact
  boundaries fall in the higher band (₦10,000,000 → 4.60% tier).

## Policy thresholds (`/admin/thresholds`)
`DSCR_MIN` (1.2000), `DTI_MAX` (0.5000), per-product `LTV_MAX`. New assessments read
these live; every edit is audit-logged.

## Users (`/admin/users`)
Two roles only. You cannot demote or deactivate yourself. Scope strings are
comma-separated and informational for now.

## Rate overrides (`/admin/overrides`)
Analyst-proposed rates appear as PENDING. **Approve & reprice** rebuilds the schedule
at the new rate and updates the recommendation + proposed service. **Reject** keeps
the resolved rate. Both are audit-logged.

## Audit (`/admin/audit`)
Filter by action and actor. Append-only: creates, verifies, expires, overrides,
resolves — who, when, before/after.

## Analytics (`/admin/analytics`)
Pipeline by status/product, decisions, override rate, median requested→recommended
haircut, open alerts, pending rate overrides.
