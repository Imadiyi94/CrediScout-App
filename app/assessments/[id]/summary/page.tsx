import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExecutiveSummaryCard } from "@/components/domain/executive-summary-card";
import { PrintButton } from "@/components/layout/print-button";
import { MetricCard } from "@/components/domain/metric-card";
import { RiskRow } from "@/components/domain/risk-row";
import { RepaymentScheduleTable, type ScheduleRow } from "@/components/domain/repayment-schedule-table";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { getSummaryData } from "@/lib/summary-data";
import { formatKobo } from "@/lib/format";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  const assessment = await getAssessmentForUser(id, session);
  if (!assessment) notFound();
  const d = await getSummaryData(id);
  if (!d) notFound();

  const schedRows: ScheduleRow[] = (d.recommendation?.schedule ?? []).map((r) => ({
    period: r.period,
    openingKobo: r.openingKobo,
    instalmentKobo: r.instalmentKobo,
    principalKobo: r.principalKobo,
    interestKobo: r.interestKobo,
    closingKobo: r.closingKobo,
  }));

  return (
    <AppShell section="Assessments">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm text-slate-500">
            <a href={`/assessments/${id}`} className="font-semibold text-primary">{d.borrowerName}</a> / Summary
          </p>
          <h1 className="text-2xl font-extrabold text-ink">Credit Assessment Summary</h1>
          <p className="mt-1 text-sm text-slate-500">
            Status <Badge tone="blue">{d.status}</Badge> · Stage {d.currentStage} / 11
          </p>
        </div>
        <a
          href={`/api/assessments/${id}/summary-pdf`}
          className="ml-auto rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Download PDF
        </a>
      </div>

      <section aria-label="Executive summary">
        <ExecutiveSummaryCard
          borrower={`${d.borrowerName} (${d.borrowerType}, ${d.clientStatus}${d.clientVerified ? ", verified" : ", UNVERIFIED"})`}
          product={d.product}
          requestedKobo={Number(assessment.requestedAmountKobo)}
          recommendedKobo={Number(assessment.proposedAmountKobo ?? assessment.requestedAmountKobo)}
          decision={d.recommendation?.decision ?? "Pending"}
          rateLine={d.recommendation ? `${d.recommendation.rate} · ${d.recommendation.rateBasis}` : "Unpriced"}
          reasons={d.recommendation?.reasons ?? "Assessment in progress."}
          conditions={d.recommendation?.conditions ?? "—"}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>1–2 · Borrower &amp; loan request</CardTitle>
        </CardHeader>
        <CardContent className="num grid gap-1.5 text-sm sm:grid-cols-2">
          <p><span className="font-semibold text-ink">Borrower: </span>{d.borrowerName} ({d.borrowerType})</p>
          <p><span className="font-semibold text-ink">Client: </span>{d.clientStatus}{d.clientVerified ? " (verified)" : " (UNVERIFIED)"}</p>
          <p><span className="font-semibold text-ink">Product: </span>{d.product}</p>
          <p><span className="font-semibold text-ink">Requested: </span>{formatKobo(assessment.requestedAmountKobo)} · {d.proposedTenor} months · {d.frequency}</p>
          <p><span className="font-semibold text-ink">Purpose: </span>{d.loanPurpose}</p>
          <p><span className="font-semibold text-ink">Repayment source: </span>{d.repaymentSource}</p>
          <p><span className="font-semibold text-ink">Existing exposure: </span>{formatKobo(assessment.existingExposureKobo)}</p>
        </CardContent>
      </Card>

      {d.financials && (
        <Card>
          <CardHeader>
            <CardTitle>3–4 · Financial position &amp; repayment capacity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <MetricCard title="Revenue" value={d.financials.revenue} meaning="primary income-generating capacity per month." interpretation={d.financials.notes ?? "As entered at Stage 4."} />
            <MetricCard title="Cash flow" value={d.financials.cashFlow} meaning="funds available for repayment per month." interpretation={`Net surplus ${d.financials.net}; existing service ${d.financials.existingService}/mo.`} />
            <MetricCard title="DSCR" value={d.financials.dscr ?? "—"} meaning="cover of debt service by cash flow." interpretation={d.financials.dscr ? "Against the 1.20× policy minimum." : "No service on file yet."} />
          </CardContent>
        </Card>
      )}

      {d.credit && (
        <Card>
          <CardHeader>
            <CardTitle>5 · Credit profile</CardTitle>
            <CardDescription>Grade {d.credit.grade ?? "—"} · exposure {d.credit.exposure} · guarantor {d.credit.guarantor}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.credit.flags.map((f) => (
              <RiskRow key={f.code} title={f.title} severity={f.severity} why={f.why} mitigation={f.mitigation} />
            ))}
            {d.credit.flags.length === 0 && <p className="text-sm text-slate-500">No flags.</p>}
          </CardContent>
        </Card>
      )}

      {d.qualitative && (
        <Card>
          <CardHeader>
            <CardTitle>6 · Business / borrower assessment</CardTitle>
            <CardDescription>Score {d.qualitative.score ?? "—"}{d.qualitative.band ? ` · ${d.qualitative.band}` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {d.qualitative.weakest.length > 0 && <p>Watch: {d.qualitative.weakest.join(" · ")}</p>}
            {d.qualitative.notes && <p className="mt-1 text-slate-600">{d.qualitative.notes}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>7 · Security / collateral {d.coveragePct ? `(coverage ${d.coveragePct})` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="num space-y-1.5 text-sm">
          {d.collaterals.length === 0 && <p className="text-slate-500">No security registered.</p>}
          {d.collaterals.map((c, i) => (
            <p key={i}><span className="font-semibold text-ink">{c.type}: </span>{c.value} · encumbrances {c.encumbrances} · LTV {c.ltv ?? "—"} · docs {c.docs}</p>
          ))}
        </CardContent>
      </Card>

      {d.productAssessment && (
        <Card>
          <CardHeader>
            <CardTitle>8 · Product-specific assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.entries(d.productAssessment.fields).map(([k, v]) => (
              <p key={k}><span className="font-semibold text-ink">{k}: </span>{v}</p>
            ))}
            {d.productAssessment.notes && <p className="text-slate-600">{d.productAssessment.notes}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>9–11 · Strengths, risks, mitigations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {d.strengths.map((s) => (
            <p key={s} className="text-green-800">✓ {s}</p>
          ))}
          {d.risks.map((r) => (
            <p key={r.title}>⚠ {r.title} <Badge tone={r.severity === "HIGH" ? "red" : r.severity === "MEDIUM" ? "amber" : "green"}>{r.severity}</Badge></p>
          ))}
          {d.mitigations.map((m) => (
            <p key={m} className="text-slate-600">→ Mitigation: {m}</p>
          ))}
        </CardContent>
      </Card>

      {d.recommendation && (
        <Card>
          <CardHeader>
            <CardTitle>12–18 · Recommended facility, terms &amp; decision</CardTitle>
            <CardDescription>
              {d.recommendation.amount} · {d.recommendation.tenor} months · {d.recommendation.rate} · instalment {d.recommendation.instalment} · total interest {d.recommendation.totalInterest}
              {d.recommendation.ear ? ` · EAR ${d.recommendation.ear}%` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="font-semibold text-ink">Decision: </span>{d.recommendation.decision} ({d.recommendation.decided})</p>
            <p><span className="font-semibold text-ink">Basis: </span>{d.recommendation.reasons}</p>
            <p><span className="font-semibold text-ink">Conditions: </span>{d.recommendation.conditions ?? "—"}</p>
            <RepaymentScheduleTable rows={schedRows} />
            <PrintButton />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Supporting documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {d.documents.length === 0 && <p className="text-slate-500">None submitted.</p>}
          {d.documents.map((doc, i) => (
            <p key={i}>{doc.kind} — {doc.name} <Badge tone={doc.status === "VERIFIED" ? "green" : doc.status === "REJECTED" ? "red" : "amber"}>{doc.status}</Badge></p>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
