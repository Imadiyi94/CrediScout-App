import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { MetricCard } from "@/components/domain/metric-card";
import { RateBadge } from "@/components/domain/rate-badge";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { formatKobo } from "@/lib/format";
import { computeProposal } from "@/lib/recommendation";
import { saveProposal } from "../../actions";

export default async function AmountPage({
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

  const proposal = await computeProposal(id);
  if (!proposal) {
    return (
      <AppShell section="Assessments">
        <AlertBanner
          title="Not ready."
          message="Stage 10 needs Stages 4 (financials) and 5 (credit profile) completed first."
          tone="danger"
        />
      </AppShell>
    );
  }

  const haircut =
    proposal.supportableKobo > 0n && proposal.supportableKobo < proposal.requestedKobo;
  const defAmount = assessment.proposedAmountKobo ?? proposal.recommendedKobo;

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Amount
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 10 — Recommended Loan Amount</h1>
        <p className="mt-1 text-sm text-slate-500">
          Not just “can they have it?” — what amount is supportable?
        </p>
      </div>

      {query.error && <AlertBanner title="Could not save." message={query.error} tone="danger" />}
      {proposal.blockers.length > 0 && (
        <AlertBanner
          title="Blockers — proposal cannot proceed to decision until resolved."
          message={proposal.blockers.join(" ")}
          tone="warning"
        />
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          title="Requested amount"
          value={formatKobo(proposal.requestedKobo)}
          meaning="facility size the borrower applied for."
          interpretation="Compared against assessed capacity and risk below."
        />
        <MetricCard
          title="Assessed supportable amount"
          value={proposal.supportableKobo > 0n ? formatKobo(proposal.supportableKobo) : "None identified"}
          meaning="largest facility keeping DSCR above policy at the applicable rate and tenor."
          interpretation={
            proposal.supportableKobo <= 0n
              ? "No supportable amount — capacity does not cover any new facility."
              : haircut
                ? `Capacity supports ${formatKobo(proposal.supportableKobo)} — a haircut driven by existing obligations and cover requirements.`
                : "Capacity supports the full requested facility."
          }
          tone={proposal.supportableKobo <= 0n ? "bad" : haircut ? "neutral" : "good"}
        />
        <MetricCard
          title="Applicable rate at supportable"
          value={`${proposal.ratePct}% ${proposal.rateType}`}
          meaning="rate for the computed amount band and verified client status."
          interpretation={proposal.rateBasis}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confirm the proposal</CardTitle>
          <CardDescription>
            Defaults to the assessed figure (capped at requested). You may propose less — never more.
            Tenor defaults to the requested {assessment.proposedTenorMonths} months.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveProposal.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            <Field label="Proposed amount (₦)">
              <Input
                name="proposedNaira"
                required
                defaultValue={String(Number(defAmount) / 100)}
                className="num"
              />
            </Field>
            <Field label="Proposed tenor (months)">
              <Input
                name="proposedTenor"
                required
                defaultValue={String(assessment.proposedTenorMonths)}
                className="num"
                inputMode="numeric"
              />
            </Field>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit">Save proposal → Stage 11</Button>
              <RateBadge ratePct={proposal.ratePct} rateType={proposal.rateType} basis={proposal.rateBasis} />
            </div>
          </form>
          {proposal.supportableKobo > 0n && (
            <p className="mt-2 text-[13px] text-slate-500">
              Highest-risk driver: {proposal.flags.find((f) => f.severity === "HIGH")?.title ?? "none — capacity is the binding constraint."}{" "}
              <Badge tone={proposal.suggestion === "REFER" ? "amber" : proposal.suggestion === "DECLINE" ? "red" : "blue"}>
                leaning {proposal.suggestion}
              </Badge>
            </p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
