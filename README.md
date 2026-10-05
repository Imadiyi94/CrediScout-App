# CrediScout App — Credit Analysis & Lending Decisions

CrediScout turns borrower information into **structured, evidence-based lending
recommendations**: 11 assessment stages, automatic lending-rate pricing, pure-math
credit engine, admin console, document handling with AI extraction, Groq AI
assistance, Paystack disbursement, Dojah identity verification, bureau scores,
and email/SMS notifications.

Live demo: **https://crediscout-app.netlify.app** (needs production env to run fully)

---

## 1. What analysts do (the 11 stages)

| Stage | Route | What happens |
|-------|-------|--------------|
| 1 Intake | `/assessments/new` | Borrower picker/quick-create, product, amount, tenor, purpose, client status |
| 2 Profile | `/assessments/[id]/profile` | Adaptive borrower form, client-status verification, **NIN/BVN/face cards (Dojah)** |
| 3 Documents | `/assessments/[id]/documents` | Progress uploader + **AI Extract**, verify/reject — locked until NIN+BVN verify |
| 4 Financials | `…/financials` | Revenue/opex/cash-flow → DTI, DSCR, exposure split |
| 5 Credit & Risk | `…/credit-risk` | Rule-based flags + **bureau scores** (FirstCentral/CRC/average) |
| 6 Business | `…/qualitative` | 8-dimension scorecard → Strong…Critical |
| 7 Collateral | `…/collateral` | Multi-item register, LTV, coverage (never overrides DSCR) |
| 8 Product | `…/product` | Per-product risk panels for all 6 loan products |
| 9 Risk summary | `…/risk-summary` | Auto-compiled strengths/risks + mitigations + **AI narrative** |
| 10 Amount | `…/amount` | Requested vs solver-assessed supportable + rate |
| 11 Decision | `…/decision` | Explicit decision, real schedule + EAR, overrides, **Disburse Loan (Paystack)** |
| Summary | `…/summary` | Executive + detailed views, 18-item summary, PDF export |
| Ask AI | hub card | Grounded Q&A about the assessment |

## 2. Roles

- **ANALYST** — runs assessments, verifies, confirms (overrides need reasons).
- **ADMIN** — everything above, plus `/admin`: rate tables (effective-dated),
  thresholds, users (create logins, reset passwords, roles), rate-override
  approvals, audit log, analytics. Admins disburse loans and trigger borrower SMS.

## 3. Tech stack

Next.js 15 + TypeScript · Tailwind + shadcn-style components · Prisma + PostgreSQL 16 ·
Better Auth (email/password + email OTP, admin plugin) · Zod · `packages/credit-engine`
(pure math: ratios, RB/flat schedules, EAR, DSCR solver, risk/alert rules, mock bureau —
64+ vitest tests) · **Groq** (`openai/gpt-oss-120b`: extraction, narratives, chat) ·
**Paystack** (kobo transfers + signed webhooks) · **Dojah** (NIN/BVN/face, sandbox
default) · **FirstCentral + CRC** (MOCK mode via internal self-call) · **Resend**
email (+OTP; SES at go-live) · **Termii** SMS (test-number guard) · S3-compatible
storage (**Adobe S3Mock** locally — MinIO is uninstallable — **Cloudflare R2**
`crediscout-documents` live, bucket-scoped token only) · Docker Compose locally,
Netlify (auto-deploy on push) + Docker image for servers.

## 4. Run it locally (5 minutes)

Prereqs: Node 20+, Docker Desktop.

```bash
# 1. Infra (Postgres 16 + S3 stand-in)
docker compose up -d postgres s3

# 2. Install + migrate + seed (§17 rate tables, thresholds, demo users)
npm install
cp .env.example .env        # then fill secrets, see §5
npm run db:migrate
npm run db:seed

# 3. Run (http://localhost:3000, or -p 3005)
npm run dev
```

Demo logins (dev only — change immediately): `analyst@crediscout.local / Analyst123!`,
`admin@crediscout.local / Admin123!`.

Health: `GET /api/health` → `{ ok, db, time }`.

## 5. Environment variables (secrets NEVER go in chat or git)

`.env` is gitignored; production values live only in the Netlify dashboard.

| Var | Local | Production |
|---|---|---|
| `DATABASE_URL` | Compose Postgres | Neon/managed PG16 |
| `BETTER_AUTH_SECRET` | long random string | secret manager / Netlify env |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | public URL |
| `STORAGE` | `local` | `r2` (+ `R2_*` below) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | from Cloudflare (verified) | Netlify env — bucket-scoped token ONLY, never the Account API Token |
| `GROQ_API_KEY` | your key | Netlify env |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` | live only at go-live |
| `DOJAH_APP_ID` / `DOJAH_SECRET_KEY` | sandbox keys | live + `DOJAH_ALLOW_LIVE=true` |
| `CREDIT_BUREAU_MODE` | `MOCK` (default) | `MOCK` until bureau go-live (+ bureau keys) |
| `INTERNAL_API_KEY` | any random string | same value in Netlify env |
| `RESEND_API_KEY` / `EMAIL_FROM` | your key (free tier → own email only) | SES + domain at go-live |
| `TERMII_API_KEY` / `TERMII_SENDER_ID` / `SMS_TEST_NUMBER` | your key + own number | open via `SMS_ALLOW_ANY=true` |

## 6. Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build/run |
| `npm run typecheck` | strict TS check |
| `npm run test:engine` | 64+ credit-engine unit tests |
| `npm run audit:security` | 13 live RBAC/integration checks (needs dev server + DB) |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma workflows |

## 7. Project layout

```
app/                    # routes: login, dashboard, admin/*, assessments/[id]/*, borrowers,
                        #   documents, design + api/* (health, auth, documents, ai/*,
                        #   disbursements, webhooks/paystack, kyc/*, credit-bureau/*, mock/*)
components/             # ui/* primitives, domain/* (MetricCard, RiskRow, …),
                        #   ai/*, kyc/*, bureau/*, documents/*, layout/*
lib/                    # auth, db, pricing, recommendation, storage, audit, groq,
                        #   paystack, dojah, email, sms, creditBureau, disbursements,
                        #   alerts, users, validators, summary-data, summary-pdf, …
packages/credit-engine/ # pure math + rules + mock bureau + tests (no framework imports)
prisma/                 # schema, migrations, seed (§17 rates, thresholds, demo users)
scripts/security-audit.ts
docs/                   # analyst/admin guides, engine math, runbook, ADRs, demo script
docker-compose.yml · Dockerfile · netlify.toml
```

## 8. Deploy

- **Netlify** (auto-deploy on push once repo-linked): `netlify.toml` builds
  `prisma generate && npm run build`. Set ALL §5 production vars in Site settings →
  Environment variables (including `INTERNAL_API_KEY`), then run migrations + seed
  against the production DB.
- **Docker**: `docker build -t crediscout-app .` (multi-stage, standalone output).
- Go-live switches are deliberately explicit: live Paystack/Dojah keys, `SMS_ALLOW_ANY`,
  SES + domain, `CREDIT_BUREAU_MODE=LIVE`, `DOJAH_ALLOW_LIVE` — each documented in
  `docs/runbook.md`. Test modes (sandbox/test keys/MOCK) never bill.

## 9. Key product rules (enforced in code, not just docs)

- Money in integer **kobo**; rates from the **recommended** amount band + verified status.
- First band max-inclusive (exactly ₦5m → 5.00%); higher exact boundaries → higher band.
- Collateral **never** overrides failed DSCR. Unverified docs/identity block progress.
- Recommendations snapshot their rate (tables are append-only/effective-dated).
- Disbursement: admin-only, APPROVE/REDUCED only, never twice, webhook-confirmed.
- Every mutation, verify, override, disbursement, AI call, and notification is audit-logged.
- AI output is always draft — analyst verifies before it counts.

## 10. Docs

`docs/analyst-guide.md` · `docs/admin-guide.md` · `docs/engine-math.md` ·
`docs/runbook.md` (ops, backup/restore, R2 cutover, troubleshooting) ·
`docs/demo-success-criteria.md` · `docs/adr/` (stack, auth, storage, money, rates).
Product requirements live in the sibling `CrediScout-PRD` repo (incl. §24 External
Integrations, §25 AI Features).
