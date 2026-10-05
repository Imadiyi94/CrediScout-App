import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { RiskRow } from "@/components/domain/risk-row";
import { BureauCards } from "@/components/bureau/bureau-cards";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { prisma } from "@/lib/db";
import { formatKobo } from "@/lib/format";
import type { RiskFlag, RiskSeverity } from "@engine/index";
import { saveCreditRisk } from "../../actions";

export default async function CreditRiskPage({
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

  const profile = await prisma.creditProfile.findUnique({ where: { assessmentId: id } });
  const latestReport = await prisma.creditReport.findFirst({
    where: { assessmentId: id },
    orderBy: { checkedAt: "desc" },
  });
  const flags = ((profile?.redFlags ?? []) as unknown) as RiskFlag[];
  const worst = flags.reduce<RiskSeverity | null>(
    (w, f) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
      return w === null || rank[f.severity] > rank[w] ? f.severity : w;
    },
    null,
  );

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Credit &amp; Risk
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 5 — Credit &amp; Risk Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Flags feed the Stage 9 risk summary and recommendation automatically.{" "}
          {worst && (
            <>Current worst flag: <Badge tone={worst === "HIGH" ? "red" : worst === "MEDIUM" ? "amber" : "green"}>{worst}</Badge></>
          )}
        </p>
      </div>

      {query.error && <AlertBanner title="Could not save." message={query.error} tone="danger" />}

      <Card>
        <CardHeader>
          <CardTitle>Credit profile</CardTitle>
          <CardDescription>Reconcile against bureau reports and existing loan schedules.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveCreditRisk.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            <Field label="Repayment history grade">
              <Select name="repaymentGrade" defaultValue={profile?.repaymentHistoryGrade ?? "A"}>
                <option value="A">A — clean</option>
                <option value="B">B — minor issues</option>
                <option value="C">C — below average</option>
                <option value="D">D — poor</option>
                <option value="NONE">No history on file</option>
              </Select>
            </Field>
            <Field label="Open facilities">
              <Input name="openFacilities" defaultValue="1" inputMode="numeric" className="num" />
            </Field>
            <Field label="Prior delinquencies (count)">
              <Input name="priorDelinquencies" defaultValue="0" inputMode="numeric" className="num" />
            </Field>
            <Field label="Prior defaults (count)">
              <Input name="priorDefaults" defaultValue="0" inputMode="numeric" className="num" />
            </Field>
            <Field label="Currently in arrears?">
              <Select name="arrearsNow" defaultValue="no">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </Field>
            <Field label="Obligations across lenders?">
              <Select name="multipleLenders" defaultValue="no">
                <option value="no">No — single lender</option>
                <option value="yes">Yes — multiple lenders</option>
              </Select>
            </Field>
            <Field label="Total exposure across facilities (₦)">
              <Input name="totalExposureNaira" defaultValue={profile ? String(Number(profile.totalExposureKobo) / 100) : ""} placeholder="1,200,000" className="num" />
            </Field>
            <Field label="Borrower monthly income (₦, for exposure multiples)">
              <Input name="monthlyIncomeNaira" placeholder="850,000" className="num" />
            </Field>
            <Field label="Highest utilisation % (blank if n/a)">
              <Input name="maxUtilizationPct" defaultValue={profile?.utilizationPct ? String(profile.utilizationPct) : ""} placeholder="45" className="num" inputMode="numeric" />
            </Field>
            <Field label="Guaranteed facilities outstanding (₦)">
              <Input name="guarantorNaira" defaultValue={profile ? String(Number(profile.guarantorObligationsKobo) / 100) : ""} placeholder="0" className="num" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Save &amp; evaluate risk</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit bureau scores</CardTitle>
          <CardDescription>Pulled per BVN and saved to the assessment history.</CardDescription>
        </CardHeader>
        <CardContent>
          <BureauCards
            assessmentId={id}
            hasBvn={(assessment.borrower.bvnNumber ?? "").length === 11}
            initial={
              latestReport
                ? {
                    firstCentralScore: latestReport.firstCentralScore ?? 0,
                    crcScore: latestReport.crcScore ?? 0,
                    averageScore: Number(latestReport.averageScore ?? 0),
                    mode: latestReport.provider.startsWith("MOCK") ? "MOCK" : "LIVE",
                    providers: latestReport.provider.split("+"),
                    checkedAt: latestReport.checkedAt.toISOString(),
                    bvnMasked: `*** *** ${latestReport.bvn.slice(-3)}`,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Risk flags</CardTitle>
            <CardDescription>
              {flags.length === 0
                ? "Clean profile — no flags raised."
                : `${flags.length} flag${flags.length > 1 ? "s" : ""} requiring analyst attention.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {flags.length === 0 ? (
              <AlertBanner
                title="No red flags."
                message={`Total exposure ${formatKobo(profile.totalExposureKobo)} reconciled with no delinquency, default, or concentration signals.`}
                tone="info"
              />
            ) : (
              flags.map((f) => (
                <RiskRow key={f.code} title={f.title} severity={f.severity} why={f.why} mitigation={f.mitigation} />
              ))
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
