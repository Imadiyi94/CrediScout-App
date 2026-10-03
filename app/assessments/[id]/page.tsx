import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentStepper } from "@/components/domain/assessment-stepper";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser, stageStatesFor } from "@/lib/assessments";
import { formatKobo } from "@/lib/format";
import { PRODUCT_LABELS, type ProductKey } from "@/lib/products";
import { CRITICAL_KINDS } from "@/lib/documents";

const STAGE_LINKS = [
  { stage: 2, href: "profile", title: "Borrower & Loan Profile", desc: "Context, verification of client status" },
  { stage: 3, href: "documents", title: "Information & Documents", desc: "Uploads, extraction review, verification" },
  { stage: 4, href: "financials", title: "Financial Capacity", desc: "Revenue, cash flow, DTI, DSCR, obligations" },
  { stage: 5, href: "credit-risk", title: "Credit & Risk", desc: "History, exposure, utilisation, flags" },
  { stage: 6, href: "qualitative", title: "Borrower / Business", desc: "Scorecard, management, stability" },
  { stage: 7, href: "collateral", title: "Collateral & Security", desc: "Items, LTV, coverage" },
  { stage: 8, href: "product", title: "Product Analysis", desc: "Product-specific risks" },
  { stage: 9, href: "risk-summary", title: "Risk Summary", desc: "Strengths, risks, mitigations" },
  { stage: 10, href: "amount", title: "Recommended Amount", desc: "Requested vs supportable" },
  { stage: 11, href: "decision", title: "Final Decision", desc: "Explicit recommendation + schedule" },
];

export default async function AssessmentHubPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  const assessment = await getAssessmentForUser(id, session);
  if (!assessment) notFound();

  const verifiedCritical = assessment.documents.filter(
    (d) => (CRITICAL_KINDS as string[]).includes(d.kind) && d.verificationStatus === "VERIFIED",
  ).length;
  const states = stageStatesFor(assessment.currentStage, verifiedCritical, CRITICAL_KINDS.length);

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href="/assessments" className="font-semibold text-primary">Assessments</a> /{" "}
          {assessment.borrower.displayName}
        </p>
        <h1 className="num mt-1 text-2xl font-extrabold text-ink">
          {assessment.borrower.displayName} · {formatKobo(assessment.requestedAmountKobo)}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {PRODUCT_LABELS[assessment.product as ProductKey]} · {assessment.proposedTenorMonths} months ·{" "}
          <Badge tone={assessment.borrower.clientStatusVerified ? "green" : "amber"}>
            {assessment.borrower.clientStatus}
            {assessment.borrower.clientStatusVerified ? " — VERIFIED" : " — UNVERIFIED"}
          </Badge>{" "}
          <Badge tone="blue">{assessment.status.replace("_", " ")}</Badge>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <AssessmentStepper states={states} />
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {STAGE_LINKS.map((s) => (
          <a key={s.stage} href={`/assessments/${assessment.id}/${s.href}`}>
            <Card>
              <CardHeader>
                <CardTitle>
                  Stage {s.stage} — {s.title}
                </CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-semibold text-primary">Open →</span>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
