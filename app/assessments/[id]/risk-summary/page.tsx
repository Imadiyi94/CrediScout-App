import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { RiskRow } from "@/components/domain/risk-row";
import { NarrativePanel } from "@/components/ai/narrative-panel";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { prisma } from "@/lib/db";
import type { RiskFlag } from "@engine/index";
import { saveRiskSummary } from "../../actions";

export default async function RiskSummaryPage({
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

  const [fin, credit, business] = await Promise.all([
    prisma.financialSnapshot.findUnique({ where: { assessmentId: id } }),
    prisma.creditProfile.findUnique({ where: { assessmentId: id } }),
    prisma.businessProfile.findUnique({ where: { assessmentId: id } }),
  ]);
  const flags = ((credit?.redFlags ?? []) as unknown) as RiskFlag[];

  const strengths: string[] = [];
  if (fin && fin.dscr !== null && Number(fin.dscr) >= 1.2) {
    strengths.push(`Adequate debt-service cover at ${Number(fin.dscr).toFixed(2)}×.`);
  }
  if (fin && fin.dti !== null && Number(fin.dti) <= 0.5) {
    strengths.push(`Existing burden within policy at ${(Number(fin.dti) * 100).toFixed(1)}% of income.`);
  }
  if (fin && fin.cashFlowKobo > 0n) strengths.push("Positive operating cash flow on file.");
  const band = ((business?.payload ?? {}) as { band?: string }).band;
  if (band === "Strong" || band === "Adequate") strengths.push(`Qualitative assessment: ${band}.`);
  if (assessment.borrower.clientStatusVerified) strengths.push("Client relationship status verified.");

  const metricRisks: string[] = [];
  if (fin && fin.dscr !== null && Number(fin.dscr) < 1.2) {
    metricRisks.push(`Weak cover: DSCR ${Number(fin.dscr).toFixed(2)}× below the 1.20× minimum.`);
  }
  if (fin && fin.dti !== null && Number(fin.dti) > 0.5) {
    metricRisks.push(`High burden: DTI ${(Number(fin.dti) * 100).toFixed(1)}% above the 50% cap.`);
  }
  if (band === "Fragile" || band === "Critical") metricRisks.push(`Qualitative assessment: ${band}.`);

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Risk summary
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 9 — Risk &amp; Red-Flag Summary</h1>
        <p className="mt-1 text-sm text-slate-500">Why this application is supportable — or problematic.</p>
      </div>

      {query.error && <AlertBanner title="Could not save." message={query.error} tone="danger" />}

      <Card>
        <CardHeader>
          <CardTitle>Key strengths</CardTitle>
        </CardHeader>
        <CardContent>
          {strengths.length === 0 ? (
            <p className="text-sm text-slate-500">No strengths identified — the capacity picture is weak.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {strengths.map((s) => (
                <li key={s} className="text-green-800">✓ {s}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key risks</CardTitle>
          <CardDescription>Credit flags plus weak financial metrics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {metricRisks.map((m) => (
            <AlertBanner key={m} title="Financial metric." message={m} tone="danger" />
          ))}
          {flags.map((f) => (
            <RiskRow key={f.code} title={f.title} severity={f.severity} why={f.why} mitigation={f.mitigation} />
          ))}
          {flags.length === 0 && metricRisks.length === 0 && (
            <AlertBanner title="No material risks." message="No flags and all metrics within policy." tone="info" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI risk narrative</CardTitle>
          <CardDescription>Three-paragraph draft from this assessment&apos;s numbers. You own the final wording.</CardDescription>
        </CardHeader>
        <CardContent>
          <NarrativePanel assessmentId={id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mitigating factors</CardTitle>
          <CardDescription>Analyst-owned. One per line — carried into the final recommendation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveRiskSummary.bind(null, id)} className="space-y-3">
            <Field label="Mitigations">
              <Input name="mitigations" defaultValue={assessment.mitigationsText ?? ""} placeholder="e.g. Off-taker agreement covers 70% of projected sales" />
            </Field>
            <Button type="submit">Save summary → Stage 10</Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
