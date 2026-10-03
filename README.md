# CrediScout App — Phase 0 Foundations

Next.js 15 + TypeScript monolith. Local-first: Postgres 16 + LocalStack S3 (R2 stand-in)
in Docker Compose on your machine; cloud later with managed Postgres 16 + Cloudflare R2.

## Prereqs

- Node.js 20+ (`scoop install nodejs`)
- Docker Desktop (Admin install: `winget install --id Docker.DockerDesktop -e`)
- Postgres 16 + LocalStack S3 come from Compose — no separate install needed.

## Setup

```bash
cp .env.example .env
# 1. Start infra
docker compose up -d postgres s3
# 2. Migrate + seed (§17 rate tables, thresholds, demo users)
npm install
npm run db:migrate
npm run db:seed
# 3. Run
npm run dev   # http://localhost:3000
```

Health: `GET /api/health` → `{ ok, db, time }`.

## Demo logins (dev only — change immediately)

- Admin: `admin@crediscout.local` / `Admin123!`
- Analyst: `analyst@crediscout.local` / `Analyst123!`

## Conventions

- Money in **integer kobo** (`BigInt`); format with `lib/format.ts`.
- Lending math lives in `packages/credit-engine/` (tested: `npm run test:engine`).
- Storage uses the S3-compatible client: Adobe S3Mock locally, **Cloudflare R2** in staging/prod (endpoint + keys swap only).
- Auth: **Better Auth** (email/password + sessions, Prisma adapter, admin plugin).
- Every mutation writes an `AuditEvent`.
- RBAC/integration checks: `npm run audit:security` (needs dev server + DB).

## Docs

- `docs/analyst-guide.md` — the 11-stage workflow
- `docs/admin-guide.md` — rates, thresholds, users, overrides
- `docs/engine-math.md` — rate/schedule/solver formulas
- `docs/runbook.md` — ops, backup/restore, R2 cutover, troubleshooting
- `docs/demo-success-criteria.md` — PRD §23 demo script
- `docs/adr/` — architecture decision records

## Branching

`master` = deployable. Features: `feat/<phase>-<slug>` via PR.
