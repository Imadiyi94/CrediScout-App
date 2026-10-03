import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { MetricCard } from "@/components/domain/metric-card";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { prisma } from "@/lib/db";
import { formatKobo } from "@/lib/format";
import { saveFinancials } from "../../actions";

function fmtKobo(v: bigint | null | undefined) {
  if (v === null || v === undefined) return "—";
  return formatKobo(v);
}

export default async function FinancialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const assessment = await getAssessmentForUser(id, session);
  if (!assessment) notFound();

  const snap = await prisma.financialSnapshot.findUnique({ where: { assessmentId: id } });
  const thresholds = await prisma.policyThreshold.findMany({
    where: { key: { in: ["DSCR_MIN", "DTI_MAX"] }, product: null },
  });
  const dscrMin = Number(thresholds.find((t) => t.key === "DSCR_MIN")?.value ?? 1.2);
  const dtiMax = Number(thresholds.find((t) => t.key === "DTI_MAX")?.value ?? 0.5);

  const dscrVal = snap?.dscr === null || snap?.dscr === undefined ? null : Number(snap.dscr);
  const dtiVal = snap?.dti === null || snap?.dti === undefined ? null : Number(snap.dti);
  const ltiVal =
    snap?.loanToIncome === null || snap?.loanToIncome === undefined
      ? null
      : Number(snap.loanToIncome);

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Financials
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 4 — Financial Capacity Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Can the borrower afford the facility? Existing obligations vs proposed burden are kept separate.
        </p>
      </div>

      {query.error && <AlertBanner title="Could not save." message={query.error} tone="danger" />}

      <Card>
        <CardHeader>
          <CardTitle>Figures (verified from Stage 3 documents where possible)</CardTitle>
          <CardDescription>Cash flow defaults to revenue minus opex when left blank.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveFinancials.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            <Field label="Revenue / income per month (₦)">
              <Input name="revenueNaira" required defaultValue={snap ? String(Number(snap.revenueKobo) / 100) : ""} placeholder="850,000" className="num" />
            </Field>
            <Field label="Operating expenses per month (₦)">
              <Input name="opexNaira" defaultValue={snap ? String(Number(snap.opexKobo) / 100) : ""} placeholder="520,000" className="num" />
            </Field>
            <Field label="Cash flow per month (₦, blank = revenue − opex)">
              <Input name="cashFlowNaira" defaultValue={snap ? String(Number(snap.cashFlowKobo) / 100) : ""} placeholder="330,000" className="num" />
            </Field>
            <Field label="Existing debt service per month (₦)">
              <Input name="existingServiceNaira" defaultValue={snap ? String(Number(snap.existingDebtServiceKobo) / 100) : ""} placeholder="0" className="num" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Analyst notes">
                <Input name="notes" defaultValue={snap?.notes ?? ""} placeholder="e.g. Cash flow cross-checked against 6-month statement average" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save &amp; analyse</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {snap && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard
              title="Net income / surplus"
              value={fmtKobo(snap.netIncomeKobo)}
              meaning="amount remaining after operating expenses (revenue − opex)."
              interpretation={`Revenue ${fmtKobo(snap.revenueKobo)} against opex ${fmtKobo(snap.opexKobo)} per month.`}
            />
            <MetricCard
              title="Cash flow available"
              value={fmtKobo(snap.cashFlowKobo)}
              meaning="movement of funds available for repayment."
              interpretation="Used as the numerator for debt-service cover. Override revenue − opex only with evidence."
            />
            <MetricCard
              title="Debt Service Coverage Ratio"
              value={dscrVal === null ? "—" : `${dscrVal.toFixed(2)}×`}
              meaning="ability of assessed cash flow to cover debt-service obligations."
              interpretation={
                dscrVal === null
                  ? "No existing debt service recorded — cover will be assessed against the proposed facility at recommendation."
                  : dscrVal >= dscrMin
                    ? `Cash flow is ${dscrVal.toFixed(2)}× the existing service requirement — above the ${dscrMin}× policy minimum.`
                    : `Cash flow is only ${dscrVal.toFixed(2)}× the existing service requirement — below the ${dscrMin}× policy minimum. Weak capacity.`
              }
              tone={dscrVal === null ? "neutral" : dscrVal >= dscrMin ? "good" : "bad"}
            />
            <MetricCard
              title="Debt-to-Income Ratio"
              value={dtiVal === null ? "—" : `${(dtiVal * 100).toFixed(1)}%`}
              meaning="existing debt obligations relative to income."
              interpretation={
                dtiVal === null
                  ? "No income figure to compare against."
                  : dtiVal <= dtiMax
                    ? `Existing obligations consume ${(dtiVal * 100).toFixed(1)}% of income — within the ${(dtiMax * 100).toFixed(0)}% policy cap.`
                    : `Existing obligations consume ${(dtiVal * 100).toFixed(1)}% of income — above the ${(dtiMax * 100).toFixed(0)}% policy cap. High burden.`
              }
              tone={dtiVal === null ? "neutral" : dtiVal <= dtiMax ? "good" : "bad"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Obligation split</CardTitle>
              <CardDescription>Existing vs proposed vs total — proposed fills in at recommendation (Stage 10–11).</CardDescription>
            </CardHeader>
            <CardContent className="num space-y-1.5 text-sm">
              <p><span className="font-semibold text-ink">Existing obligations: </span>{fmtKobo(snap.existingDebtServiceKobo)}/mo</p>
              <p><span className="font-semibold text-ink">Proposed obligation: </span>{fmtKobo(snap.proposedDebtServiceKobo)}/mo (pending)</p>
              <p><span className="font-semibold text-ink">Requested facility vs income: </span>{ltiVal === null ? "—" : `${ltiVal.toFixed(2)}×`}</p>
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}
