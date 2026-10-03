import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { prisma } from "@/lib/db";
import { QUALITY_DIMENSIONS, type QualitativeAnswers } from "@engine/index";
import { saveQualitative } from "../../actions";

const bandTone = (band: string) =>
  band === "Strong" ? "green" : band === "Adequate" ? "blue" : band === "Fragile" ? "amber" : "red";

export default async function QualitativePage({
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

  const saved = await prisma.businessProfile.findUnique({ where: { assessmentId: id } });
  const savedPayload = (saved?.payload ?? {}) as Partial<Record<keyof QualitativeAnswers, number>> & { band?: string; weakest?: string[] };
  const individual = assessment.borrower.type === "INDIVIDUAL";

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Business
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 6 — Borrower / Business Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Qualitative factors ratios cannot capture. Rate each dimension 1 (weak) – 5 (strong).
          {individual && " Labels adapt to individual borrowers."}
        </p>
      </div>

      {query.error && <AlertBanner title="Could not save." message={query.error} tone="danger" />}

      <Card>
        <CardHeader>
          <CardTitle>Scorecard</CardTitle>
          <CardDescription>
            {saved
              ? <>Current score: <span className="num font-bold text-ink">{Number(saved.qualitativeScore).toFixed(2)} / 5.00</span> <Badge tone={bandTone(String(savedPayload.band ?? "")) as "green"}>{String(savedPayload.band ?? "")}</Badge></>
              : "No scorecard saved yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveQualitative.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            {QUALITY_DIMENSIONS.map((d) => (
              <Field key={d.key} label={`${d.label} — ${d.guidance}`}>
                <Select name={d.key} defaultValue={savedPayload[d.key] ?? 3}>
                  <option value={1}>1 — Weak</option>
                  <option value={2}>2 — Below average</option>
                  <option value={3}>3 — Average</option>
                  <option value={4}>4 — Good</option>
                  <option value={5}>5 — Strong</option>
                </Select>
              </Field>
            ))}
            <div className="sm:col-span-2">
              <Field label="Analyst notes">
                <Input name="notes" defaultValue={saved?.notes ?? ""} placeholder="e.g. 9 years trading, owner keeps daily sales ledger" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save scorecard</Button>
            </div>
          </form>
          {savedPayload.weakest && savedPayload.weakest.length > 0 && (
            <p className="mt-3 text-[13px] text-amber-800">
              <span className="font-bold">Watch: </span>{savedPayload.weakest.join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
