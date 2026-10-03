# Analyst Guide — the 11-stage workflow

Sign in at `/login` (dev seeds: `analyst@crediscout.local` / `Analyst123!`).
Your pipeline lives at `/assessments`; reference borrowers at `/borrowers`.

## Stage 1 — Intake (`/assessments/new`)
Pick an existing borrower or enter a new one. Record product, requested amount (₦),
tenor, purpose, repayment source/frequency, existing exposure, and **client status
(New/Returning)**. The status can be changed later but starts UNVERIFIED.

## Stage 2 — Profile
Confirm identity/business fields (labels adapt to borrower type). Then **verify client
status**: Returning means a fully repaid prior facility in good standing, or a
performing facility with ≥ 6 months clean history. Evidence text is mandatory and
audit-logged. Unverified status blocks the final decision (REFER).

## Stage 3 — Documents
Upload by kind (PDF/images/CSV/Excel, ≤ 10 MB). Bank statement, financial statement,
and identity are **critical**: each needs explicit Verify/Reject — nothing is
auto-accepted. Download from the file link (ownership-checked).

## Stage 4 — Financials
Enter monthly revenue, opex, cash flow (defaults to revenue − opex), and existing debt
service. You get net surplus, DTI vs the 50% cap, DSCR vs the 1.20× floor, and the
existing/proposed/total split. Proposed service fills in at recommendation.

## Stage 5 — Credit & Risk
Grade history (A–D / none), counts, arrears, exposure, income, utilisation, guarantor
load, lender spread. Each rule fires a flag with **why it matters + mitigation**.
Flags flow into Stages 9 and 11 automatically.

## Stage 6 — Business
Score 8 dimensions 1–5 → Strong/Adequate/Fragile/Critical with a watchlist.

## Stage 7 — Collateral
Register each security with estimated/verified values, encumbrances, marketability,
and documentation. LTV and coverage are computed. **Collateral never overrides weak
repayment capacity** — the decision gate reads DSCR, not security.

## Stage 8 — Product
Product-specific risks per loan type (cycles, feasibility, affordability, asset
condition). Records the pricing basis; the exact rate resolves at Stage 11.

## Stage 9 — Risk summary
Auto-compiled strengths/risks; you own the **mitigations** (one per line).

## Stage 10 — Amount
Requested vs solver-assessed supportable vs applicable rate. Propose an amount
(**never above requested**) and tenor.

## Stage 11 — Decision
System suggestion (REFER on blockers → DECLINE on failed DSCR → REDUCED on haircut or
HIGH flags → APPROVE), real schedule + EAR preview. Confirm or override: **any change
to decision/amount/tenor needs a reason (≥ 10 chars)**. A different rate stays
**PENDING** until an Admin approves it. Confirming reprices collateral LTVs, stores
proposed service, raises HIGH-flag alerts, and audit-logs everything.

## After decision
`/summary` gives the executive + detailed views and the PDF. The hub shows open
alerts with the stage that clears each one.
