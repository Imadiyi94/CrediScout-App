import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { RecommendationPanel } from "@/components/domain/recommendation-panel";
import { RepaymentScheduleTable, type ScheduleRow } from "@/components/domain/repayment-schedule-table";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { prisma } from "@/lib/db";
import { formatKobo } from "@/lib/format";
import { computeProposal } from "@/lib/recommendation";
import { confirmRecommendation } from "../../actions";

export default async function DecisionPage({
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

  const saved = await prisma.recommendation.findUnique({
    where: { assessmentId: id },
    include: { overrides: { orderBy: { createdAt: "desc" } } },
  });

  // Show the confirmed recommendation when one exists.
  if (saved) {
    const sched = await computeProposal(id, {
      amountKobo: saved.recommendedAmountKobo,
      tenorMonths: saved.recommendedTenorMonths,
    });
    const rows: ScheduleRow[] = (sched?.schedule?.rows ?? []).map((r) => ({
      period: r.period,
      openingKobo: Number(r.openingKobo),
      instalmentKobo: Number(r.instalmentKobo),
      principalKobo: Number(r.principalKobo),
      interestKobo: Number(r.interestKobo),
      closingKobo: Number(r.closingKobo),
    }));
    if (sched?.schedule) {
      rows.push({
        period: `Total (${sched.schedule.periods} mo)`,
        openingKobo: null,
        instalmentKobo: Number(sched.schedule.totalPaidKobo),
        principalKobo: Number(sched.schedule.totalPrincipalKobo),
        interestKobo: Number(sched.schedule.totalInterestKobo),
        closingKobo: 0,
        total: true,
      });
    }
    const pendingRate = saved.overrides.find((o) => o.field === "RATE" && o.status === "PENDING");
    return (
      <AppShell section="Assessments">
        <div>
          <p className="text-sm text-slate-500">
            <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Decision
          </p>
          <h1 className="text-2xl font-extrabold text-ink">Stage 11 — Final Credit Recommendation</h1>
        </div>
        {pendingRate && (
          <AlertBanner
            title="Rate change pending Admin approval."
            message={`${pendingRate.oldValue} → ${pendingRate.newValue}. Reason: ${pendingRate.reason}`}
            tone="warning"
          />
        )}
        <RecommendationPanel
          decisionLabel={`RECOMMENDATION · ${saved.decision.replace("_", " ")}`}
          requestedKobo={Number(saved.requestedAmountKobo)}
          recommendedKobo={Number(saved.recommendedAmountKobo)}
          tenorMonths={saved.recommendedTenorMonths}
          ratePct={String(saved.ratePctMonthly)}
          rateType={saved.rateType}
          rateBasis={saved.rateBasis}
          instalmentKobo={Number(saved.installmentKobo ?? 0n)}
          totalInterestKobo={Number(saved.totalInterestKobo ?? 0n)}
          basis={saved.reasons ?? "—"}
          conditions={saved.conditions ?? "—"}
        />
        <Card>
          <CardHeader>
            <CardTitle>Repayment schedule</CardTitle>
            <CardDescription>
              Effective annual rate {saved.effectiveAnnualRatePct ? `${Number(saved.effectiveAnnualRatePct).toFixed(2)}%` : "—"}.
              Decided by {saved.decidedBy === session.user.id ? "you" : "another analyst"} on {saved.decidedAt.toLocaleDateString("en-NG")}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RepaymentScheduleTable rows={rows} />
          </CardContent>
        </Card>
        {saved.overrides.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Overrides &amp; judgment trail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {saved.overrides.map((o) => (
                <p key={o.id}>
                  <Badge tone={o.status === "PENDING" ? "amber" : "blue"}>{o.field} · {o.status}</Badge>{" "}
                  <span className="num">{o.oldValue} → {o.newValue}</span>
                  <br />
                  <span className="text-slate-600">Reason: {o.reason}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Revise</CardTitle>
            <CardDescription>Re-confirming overwrites this recommendation (audit-kept).</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmForm
              assessmentId={id}
              suggestion={saved.decision}
              defaultAmount={String(Number(saved.recommendedAmountKobo) / 100)}
              defaultTenor={saved.recommendedTenorMonths}
              defaultReasons={saved.reasons ?? ""}
              defaultConditions={saved.conditions ?? ""}
              currentRate={`${String(saved.ratePctMonthly)}% ${saved.rateType}`}
            />
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  // Fresh decision: suggestion + schedule preview + confirm form.
  const proposal = await computeProposal(id, {
    amountKobo: assessment.proposedAmountKobo ?? undefined,
    tenorMonths: assessment.proposedTenorMonths,
  });
  if (!proposal || !proposal.schedule) {
    return (
      <AppShell section="Assessments">
        <AlertBanner
          title="Cannot price yet."
          message={proposal?.blockers.join(" ") || "Complete Stages 4 and 5 first."}
          tone="danger"
        />
      </AppShell>
    );
  }
  const rows: ScheduleRow[] = proposal.schedule.rows.map((r) => ({
    period: r.period,
    openingKobo: Number(r.openingKobo),
    instalmentKobo: Number(r.instalmentKobo),
    principalKobo: Number(r.principalKobo),
    interestKobo: Number(r.interestKobo),
    closingKobo: Number(r.closingKobo),
  }));

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Decision
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 11 — Final Credit Recommendation</h1>
      </div>

      {query.error && <AlertBanner title="Could not confirm." message={query.error} tone="danger" />}
      {proposal.blockers.length > 0 && (
        <AlertBanner title="Blockers." message={proposal.blockers.join(" ")} tone="warning" />
      )}

      <RecommendationPanel
        decisionLabel={`SYSTEM SUGGESTION · ${proposal.suggestion.replace("_", " ")}`}
        requestedKobo={Number(proposal.requestedKobo)}
        recommendedKobo={Number(proposal.recommendedKobo)}
        tenorMonths={proposal.tenorMonths}
        ratePct={proposal.ratePct}
        rateType={proposal.rateType}
        rateBasis={proposal.rateBasis}
        instalmentKobo={Number(proposal.schedule.instalmentKobo)}
        totalInterestKobo={Number(proposal.schedule.totalInterestKobo)}
        basis={proposal.reasonsDraft}
        conditions={proposal.conditionsDraft}
      />

      <Card>
        <CardHeader>
          <CardTitle>Repayment schedule preview</CardTitle>
          <CardDescription>
            {formatKobo(proposal.schedule.instalmentKobo)}/mo · total interest {formatKobo(proposal.schedule.totalInterestKobo)} · EAR {proposal.earPct?.toFixed(2)}%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RepaymentScheduleTable rows={rows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analyst confirmation</CardTitle>
          <CardDescription>
            Accept the suggestion or override it — any change to decision, amount, or tenor requires a reason.
            A different rate needs Admin approval and stays pending.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmForm
            assessmentId={id}
            suggestion={proposal.suggestion}
            defaultAmount={String(Number(proposal.recommendedKobo) / 100)}
            defaultTenor={proposal.tenorMonths}
            defaultReasons={proposal.reasonsDraft}
            defaultConditions={proposal.conditionsDraft}
            currentRate={`${proposal.ratePct}% ${proposal.rateType}`}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}

function ConfirmForm({
  assessmentId,
  suggestion,
  defaultAmount,
  defaultTenor,
  defaultReasons,
  defaultConditions,
  currentRate,
}: {
  assessmentId: string;
  suggestion: string;
  defaultAmount: string;
  defaultTenor: number;
  defaultReasons: string;
  defaultConditions: string;
  currentRate: string;
}) {
  return (
    <form action={confirmRecommendation.bind(null, assessmentId)} className="grid gap-3 sm:grid-cols-2">
      <Field label={`Decision (system suggests ${suggestion})`}>
        <Select name="decision" defaultValue={suggestion}>
          <option value="APPROVE">APPROVE</option>
          <option value="REDUCED">APPROVE AT REDUCED AMOUNT</option>
          <option value="DECLINE">DECLINE</option>
          <option value="REFER">REFER FOR FURTHER REVIEW</option>
        </Select>
      </Field>
      <Field label="Confirmed amount (₦)">
        <Input name="amountNaira" required defaultValue={defaultAmount} className="num" />
      </Field>
      <Field label="Confirmed tenor (months)">
        <Input name="tenorMonths" required defaultValue={String(defaultTenor)} className="num" inputMode="numeric" />
      </Field>
      <Field label={`Rate override (resolved ${currentRate} — blank to accept)`}>
        <Input name="overrideRatePct" placeholder="e.g. 4.50" className="num" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Key reasons">
          <Input name="reasons" required defaultValue={defaultReasons} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Conditions">
          <Input name="conditions" defaultValue={defaultConditions} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Override reason (required if you change the suggestion)">
          <Input name="overrideReason" placeholder="e.g. Verified rental income not in the cash-flow file" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">Confirm recommendation</Button>
      </div>
    </form>
  );
}
