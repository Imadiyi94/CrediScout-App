# ADR 0002 — Better Auth for authentication

Date: 2026-09-27 · Status: accepted

## Context
Two roles (ANALYST, ADMIN), email/password sign-in, self-hosted, Prisma-backed.

## Decision
Better Auth with the Prisma adapter and the `admin` plugin. Sessions in Postgres,
`role`/`scopes` as user fields, route gating in middleware (cookie presence) plus
per-request role checks in layouts and actions.

## Consequences
+ No external IdP; sessions auditable in our own DB.
+ Gotcha recorded: credential `Account.accountId` must equal `user.id`, not the email
  (Better Auth v1.7 sign-in lookup). Seeds must follow this.
− Password rules and lockout are our responsibility; review before handling real PII.
