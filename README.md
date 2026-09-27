# CrediScout App — Phase 0 Foundations

Next.js 15 + TypeScript monolith. Local-first: Postgres 16 + MinIO (R2 stand-in)
in Docker Compose on your machine; cloud later with managed Postgres 16 + Cloudflare R2.

## Prereqs

- Node.js 20+ (`scoop install nodejs`)
- Docker Desktop (Admin install: `winget install --id Docker.DockerDesktop -e`)
- Postgres 16 + MinIO come from Compose — no separate install needed.

## Setup

```bash
cp .env.example .env
# 1. Start infra
docker compose up -d postgres minio
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
- Lending math lives in `packages/credit-engine/` (Phase 4) — never inline in UI.
- Storage uses the S3-compatible client: MinIO locally, **Cloudflare R2** in staging/prod (endpoint + keys swap only).
- Auth: **Better Auth** (email/password + sessions, Prisma adapter, admin plugin).
- Every mutation writes an `AuditEvent`.

## Branching

`master` = deployable. Features: `feat/<phase>-<slug>` via PR.
