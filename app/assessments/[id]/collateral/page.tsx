import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { MetricCard } from "@/components/domain/metric-card";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { prisma } from "@/lib/db";
import { formatKobo } from "@/lib/format";
import { netSecurityValue } from "@engine/index";
import { addCollateral, removeCollateral } from "../../actions";

export default async function CollateralPage({
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

  const items = await prisma.collateral.findMany({
    where: { assessmentId: id },
    orderBy: { createdAt: "asc" },
  });
  const totalNet = items.reduce(
    (s, c) => s + netSecurityValue(c.verifiedValueKobo ?? c.estimatedValueKobo, c.encumbrancesKobo),
    0n,
  );
  const coverage =
    assessment.requestedAmountKobo > 0n
      ? Number((totalNet * 10_000n) / assessment.requestedAmountKobo) / 100
      : null;

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Collateral
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 7 — Collateral &amp; Security Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Security supports a recommendation — it never overrides weak repayment capacity.
        </p>
      </div>

      {query.error && <AlertBanner title="Could not save." message={query.error} tone="danger" />}

      <div className="grid gap-3 md:grid-cols-2">
        <MetricCard
          title="Security coverage"
          value={coverage === null ? "—" : `${coverage.toFixed(0)}%`}
          meaning="total net security value relative to the requested facility."
          interpretation={
            totalNet <= 0n
              ? "No security registered yet."
              : coverage !== null && coverage >= 100
                ? `Net security ${formatKobo(totalNet)} covers the requested ${formatKobo(assessment.requestedAmountKobo)} in full.`
                : `Net security ${formatKobo(totalNet)} covers only part of the requested ${formatKobo(assessment.requestedAmountKobo)}.`
          }
        />
        <MetricCard
          title="Items registered"
          value={String(items.length)}
          meaning="count of security items with ownership, value, and documentation status."
          interpretation="Every item needs verified value and documentation before it counts toward cover at recommendation."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add security</CardTitle>
          <CardDescription>LTV is computed against the requested facility for now; recommendation reprices it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addCollateral.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Security type">
                <Select name="type" defaultValue="Residential property">
                  <option>Residential property</option>
                  <option>Commercial property</option>
                  <option>Land (titled)</option>
                  <option>Vehicle</option>
                  <option>Equipment / machinery</option>
                  <option>Inventory</option>
                  <option>Receivables</option>
                  <option>Cash / fixed deposit</option>
                  <option>Third-party guarantee</option>
                  <option>Other</option>
                </Select>
              </Field>
            </div>
            <Field label="Ownership">
              <Input name="ownership" placeholder="e.g. Borrower, C of O verified" />
            </Field>
            <Field label="Marketability">
              <Select name="marketability" defaultValue="Medium">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </Select>
            </Field>
            <Field label="Estimated value (₦)">
              <Input name="estimatedNaira" required placeholder="8,000,000" className="num" />
            </Field>
            <Field label="Verified value (₦, blank if unverified)">
              <Input name="verifiedNaira" placeholder="7,500,000" className="num" />
            </Field>
            <Field label="Encumbrances (₦)">
              <Input name="encumbrancesNaira" placeholder="0" className="num" />
            </Field>
            <Field label="Documentation">
              <Select name="documentationStatus" defaultValue="PENDING">
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Add security</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered security</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No security registered.</p>
          ) : (
            <div className="space-y-3">
              {items.map((c) => (
                <div key={c.id} className="num rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-ink">{c.type}</p>
                    <Badge tone={c.documentationStatus === "VERIFIED" ? "green" : c.documentationStatus === "REJECTED" ? "red" : "amber"}>
                      {c.documentationStatus}
                    </Badge>
                    <Badge tone="navy">{c.marketability} marketability</Badge>
                    <form action={removeCollateral.bind(null, id)} className="ml-auto">
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="dangerGhost" size="sm">Remove</Button>
                    </form>
                  </div>
                  <p className="mt-1 text-slate-600">
                    Estimated {formatKobo(c.estimatedValueKobo)}
                    {c.verifiedValueKobo !== null ? ` · Verified ${formatKobo(c.verifiedValueKobo)}` : " · Unverified"}
                    {" · "}Encumbrances {formatKobo(c.encumbrancesKobo)}
                    {" · "}LTV {c.ltv === null ? "—" : `${(Number(c.ltv) * 100).toFixed(1)}%`}
                  </p>
                  {c.ownership && <p className="text-slate-500">Ownership: {c.ownership}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
