import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { formatKobo } from "@/lib/format";
import { PRODUCT_LABELS, PRODUCT_RATE_HINTS, type ProductKey } from "@/lib/products";
import { updateBorrowerProfile, verifyClientStatus } from "../../actions";

export default async function ProfilePage({
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
  const b = assessment.borrower;
  const profile = (b.businessProfile ?? {}) as Record<string, string | number | null>;
  const isIndividual = b.type === "INDIVIDUAL";

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{b.displayName}</a> / Profile
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 2 — Borrower &amp; Loan Profile</h1>
      </div>

      {query.error && <AlertBanner title="Could not save." message={query.error} tone="danger" />}

      <Card>
        <CardHeader>
          <CardTitle>Loan (from Stage 1)</CardTitle>
          <CardDescription>
            {PRODUCT_LABELS[assessment.product as ProductKey]} ·{" "}
            {PRODUCT_RATE_HINTS[assessment.product as ProductKey]}
          </CardDescription>
        </CardHeader>
        <CardContent className="num grid gap-1.5 text-sm sm:grid-cols-2">
          <p><span className="font-semibold text-ink">Requested: </span>{formatKobo(assessment.requestedAmountKobo)}</p>
          <p><span className="font-semibold text-ink">Tenor: </span>{assessment.proposedTenorMonths} months</p>
          <p><span className="font-semibold text-ink">Purpose: </span>{assessment.loanPurpose}</p>
          <p><span className="font-semibold text-ink">Repayment source: </span>{assessment.repaymentSource}</p>
          <p><span className="font-semibold text-ink">Frequency: </span>{assessment.repaymentFrequency}</p>
          <p><span className="font-semibold text-ink">Existing exposure: </span>{formatKobo(assessment.existingExposureKobo)}</p>
        </CardContent>
      </Card>

      <form action={updateBorrowerProfile.bind(null, id)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Borrower</CardTitle>
            <CardDescription>Fields adapt to borrower type; extras persist per loan product.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Borrower type">
              <Select name="type" defaultValue={b.type}>
                <option value="BUSINESS">Business</option>
                <option value="INDIVIDUAL">Individual</option>
              </Select>
            </Field>
            <Field label={isIndividual ? "Full name" : "Business name"}>
              <Input name="displayName" defaultValue={b.displayName} required />
            </Field>
            <Field label="Phone">
              <Input name="phone" defaultValue={b.phone ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={b.email ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address / location">
                <Input name="address" defaultValue={b.address ?? ""} />
              </Field>
            </div>
            <Field label={isIndividual ? "Employer" : "Business type"}>
              <Input name="businessType" defaultValue={String(profile.businessType ?? "")} placeholder={isIndividual ? "e.g. State civil service" : "e.g. Retail trading"} />
            </Field>
            <Field label={isIndividual ? "Years in employment" : "Business age (months)"}>
              <Input name="businessAgeMonths" defaultValue={String(profile.businessAgeMonths ?? "")} inputMode="numeric" />
            </Field>
            <Field label="Industry / sector">
              <Input name="industry" defaultValue={String(profile.industry ?? "")} placeholder="e.g. Fast-moving consumer goods" />
            </Field>
            <Field label={isIndividual ? "Employment / income notes" : "Management & experience"}>
              <Input name="experience" defaultValue={String(profile.experience ?? "")} />
            </Field>
          </CardContent>
        </Card>
        <Button type="submit">Save profile → unlock Stage 3</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Client status verification</CardTitle>
          <CardDescription>
            Returning = a fully repaid prior facility in good standing, or a performing facility with ≥ 6 months clean history. The verified flag drives SBL/SME pricing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            <span className="font-semibold text-ink">Declared: </span>
            <Badge tone="navy">{b.clientStatus}</Badge>{" "}
            {b.clientStatusVerified ? (
              <Badge tone="green">VERIFIED{b.clientStatusVerifiedAt ? ` · ${b.clientStatusVerifiedAt.toLocaleDateString("en-NG")}` : ""}</Badge>
            ) : (
              <Badge tone="amber">UNVERIFIED</Badge>
            )}
          </p>
          {b.clientStatusEvidence && (
            <p className="text-[13px] text-slate-600">
              <span className="font-semibold text-ink">Evidence on file: </span>{b.clientStatusEvidence}
            </p>
          )}
          {!b.clientStatusVerified && (
            <form action={verifyClientStatus.bind(null, id)} className="space-y-3">
              <Field label="Verification evidence (required)">
                <Input name="evidence" required placeholder="e.g. Facility LN-2024-118 repaid 12 Mar 2025, confirmed from ledger" />
              </Field>
              <Button type="submit" variant="success">Verify client status</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
