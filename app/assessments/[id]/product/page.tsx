import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { RateBadge } from "@/components/domain/rate-badge";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { prisma } from "@/lib/db";
import { PRODUCT_FIELDS } from "@/lib/product-fields";
import { PRODUCT_LABELS, PRODUCT_RATE_HINTS, type ProductKey } from "@/lib/products";
import { saveProductAssessment } from "../../actions";

export default async function ProductPage({
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

  const product = assessment.product as ProductKey;
  const fields = PRODUCT_FIELDS[product];
  const saved = await prisma.productAssessment.findUnique({ where: { assessmentId: id } });
  const savedPayload = (saved?.payload ?? {}) as Record<string, string>;

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Product
        </p>
        <h1 className="text-2xl font-extrabold text-ink">
          Stage 8 — {PRODUCT_LABELS[product]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Product-specific risks and pricing basis.</p>
      </div>

      {query.error && <AlertBanner title="Could not save." message={query.error} tone="danger" />}

      <Card>
        <CardHeader>
          <CardTitle>Pricing basis</CardTitle>
        </CardHeader>
        <CardContent>
          <RateBadge ratePct="?" rateType={product === "CLEAN_ENERGY" || product === "HOUSING_EDU" ? "FLAT" : "RB"} basis={PRODUCT_RATE_HINTS[product]} />
          <p className="mt-2 text-[13px] text-slate-500">
            The exact rate resolves from the recommended amount at Stage 11 — this panel records the product risks that justify it.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveProductAssessment.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) =>
              f.kind === "select" ? (
                <Field key={f.name} label={f.label}>
                  <Select name={f.name} defaultValue={savedPayload[f.name] ?? ""}>
                    <option value="">— Select —</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field key={f.name} label={f.label}>
                  <Input
                    name={f.name}
                    defaultValue={savedPayload[f.name] ?? ""}
                    placeholder={f.placeholder}
                    className={f.kind === "naira" ? "num" : undefined}
                    inputMode={f.kind === "naira" ? "numeric" : undefined}
                  />
                </Field>
              ),
            )}
            <div className="sm:col-span-2">
              <Field label="Product-specific notes">
                <Input name="notes" defaultValue={saved?.notes ?? ""} placeholder="e.g. Cycle aligns with 9-month tenor; off-taker agreement verified" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save product assessment</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
