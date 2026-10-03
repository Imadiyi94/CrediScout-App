import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { createAssessment } from "../actions";

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; borrowerId?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const borrowers = await prisma.borrower.findMany({
    orderBy: { displayName: "asc" },
    take: 200,
  });

  return (
    <AppShell section="Assessments">
      <h1 className="text-2xl font-extrabold text-ink">Stage 1 — Create credit assessment</h1>
      <p className="text-sm text-slate-500">
        Pick an existing borrower or enter a new one. Client status drives the SBL/SME rate tier.
      </p>

      {params.error && <AlertBanner title="Could not create." message={params.error} tone="danger" />}

      <form action={createAssessment} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Borrower</CardTitle>
            <CardDescription>Leave “existing borrower” empty to create a new profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Existing borrower (optional)">
                <Select name="borrowerId" defaultValue={params.borrowerId ?? ""}>
                  <option value="">— New borrower —</option>
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.displayName} ({b.type}, {b.clientStatus})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Borrower type">
              <Select name="borrowerType" defaultValue="BUSINESS">
                <option value="BUSINESS">Business</option>
                <option value="INDIVIDUAL">Individual</option>
              </Select>
            </Field>
            <Field label="Borrower name">
              <Input name="displayName" placeholder="e.g. Adaeze Okafor Trading Co." />
            </Field>
            <Field label="Phone">
              <Input name="phone" placeholder="080…" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="name@example.com" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <Input name="address" placeholder="Shop 12, Market Road…" />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan request</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Loan product">
              <Select name="product" defaultValue="SBL">
                <option value="SBL">Small Business Loan (SBL)</option>
                <option value="SME">SME Loan</option>
                <option value="AGRO">Agricultural Loan</option>
                <option value="CLEAN_ENERGY">Clean Energy Loan</option>
                <option value="HOUSING_EDU">Housing / Education Loan</option>
                <option value="ASSET">Asset Loan</option>
              </Select>
            </Field>
            <Field label="Client status">
              <Select name="clientStatus" defaultValue="NEW">
                <option value="NEW">New</option>
                <option value="RETURNING">Returning</option>
              </Select>
            </Field>
            <Field label="Requested amount (₦)">
              <Input name="requestedNaira" required placeholder="5,000,000" className="num" />
            </Field>
            <Field label="Proposed tenor (months)">
              <Input name="proposedTenorMonths" required placeholder="12" className="num" inputMode="numeric" />
            </Field>
            <Field label="Repayment frequency">
              <Select name="repaymentFrequency" defaultValue="MONTHLY">
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="BULLET">Bullet</option>
              </Select>
            </Field>
            <Field label="Existing exposure (₦, if any)">
              <Input name="existingExposureNaira" placeholder="0" className="num" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Loan purpose">
                <Input name="loanPurpose" required placeholder="e.g. Restock inventory ahead of festive season" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Repayment source">
                <Input name="repaymentSource" required placeholder="e.g. Daily shop sales" />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Button type="submit">Create assessment → Stage 2</Button>
      </form>
    </AppShell>
  );
}
