import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { MetricCard } from "@/components/domain/metric-card";
import { RiskRow } from "@/components/domain/risk-row";
import { RateBadge } from "@/components/domain/rate-badge";
import { AssessmentStepper } from "@/components/domain/assessment-stepper";
import { AlertBanner } from "@/components/domain/alert-banner";
import { RepaymentScheduleTable } from "@/components/domain/repayment-schedule-table";
import { RecommendationPanel } from "@/components/domain/recommendation-panel";
import { ExecutiveSummaryCard } from "@/components/domain/executive-summary-card";
import { demoSchedule, demoStageStates } from "@/lib/fixtures";
import { formatKobo } from "@/lib/format";

const SWATCHES: { name: string; hex: string; text?: boolean }[] = [
  { name: "Ink / headings", hex: "#0F1E33" },
  { name: "Primary navy", hex: "#0B3D91" },
  { name: "Primary soft", hex: "#E4ECFB", text: true },
  { name: "Decision gold", hex: "#E9B44C", text: true },
  { name: "Success", hex: "#15803D" },
  { name: "Success bg", hex: "#DCFCE7", text: true },
  { name: "Warning", hex: "#B45309" },
  { name: "Warning bg", hex: "#FEF3C7", text: true },
  { name: "Danger", hex: "#B91C1C" },
  { name: "Danger bg", hex: "#FEE2E2", text: true },
  { name: "Muted text", hex: "#64748B" },
  { name: "App background", hex: "#F4F6FA", text: true },
];

export default function DesignPage() {
  return (
    <AppShell section="Assessments">
      <div>
        <h1 className="text-3xl font-extrabold text-ink">Design System</h1>
        <p className="mt-1 text-[15px] text-slate-500">
          Live component library — every screen in the analyst workflow is composed from these.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>Trust navy leads; gold is reserved for the recommendation moment.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {SWATCHES.map((s) => (
              <div key={s.name} className="overflow-hidden rounded-lg border border-slate-200">
                <div className="h-14" style={{ background: s.hex }} />
                <div className="px-2.5 py-1.5 text-xs">
                  <p className="font-bold text-ink">{s.name}</p>
                  <code className="font-mono text-slate-500">{s.hex}</code>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Buttons, badges, rate pills, and form fields.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Approve recommendation</Button>
            <Button variant="secondary">Save draft</Button>
            <Button variant="success">Verify document</Button>
            <Button variant="dangerGhost">Decline</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">APPROVE</Badge>
            <Badge tone="amber">REDUCED AMOUNT</Badge>
            <Badge tone="red">DECLINE</Badge>
            <Badge tone="blue">REFERRED</Badge>
            <Badge tone="navy">RETURNING CLIENT</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <RateBadge ratePct="5.00" rateType="RB" basis="Returning · SBL ≤ ₦5m" />
            <RateBadge ratePct="3.00" rateType="FLAT" basis="Clean Energy · all amounts" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Requested amount (₦)">
              <Input defaultValue="5,000,000" className="num" />
            </Field>
            <Field label="Loan product">
              <Select defaultValue="sbl">
                <option value="sbl">Small Business Loan (SBL)</option>
                <option value="sme">SME Loan</option>
                <option value="agro">Agricultural Loan</option>
              </Select>
            </Field>
            <Field label="Client status">
              <Select defaultValue="returning">
                <option value="returning">Returning — verified</option>
                <option value="new">New</option>
              </Select>
            </Field>
          </div>
          <p className="num text-sm text-ink">
            Money formatting: {formatKobo(500000000)} · {formatKobo(320000000)} · {formatKobo(36103700)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessment stepper</CardTitle>
          <CardDescription>11 stages with amber flags where attention is needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <AssessmentStepper states={demoStageStates} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metric cards</CardTitle>
          <CardDescription>Metric → Value → Meaning → Interpretation. No unexplained numbers.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <MetricCard
            title="Debt Service Coverage Ratio"
            value="1.45×"
            meaning="whether assessed cash flow covers debt-service obligations."
            interpretation="1.45× the requirement — above the 1.20× policy minimum. Adequate cover."
            tone="good"
          />
          <MetricCard
            title="Loan-to-Value (collateral)"
            value="68%"
            meaning="proposed exposure relative to verified security value."
            interpretation="Below the 75% SBL cap. Collateral supports — but never overrides — repayment capacity."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk rows</CardTitle>
          <CardDescription>Risk → Why it matters → Mitigation. Never a bare red badge.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <RiskRow
            title="High existing debt exposure"
            severity="HIGH"
            why="existing obligations consume 41% of verified cash flow, leaving a thin buffer for the new facility."
            mitigation="supportable-amount haircut applied (₦5.0m → ₦3.2m); condition: settle Facility B before disbursement."
          />
          <RiskRow
            title="Revenue concentration — 1 buyer ≈ 55% of sales"
            severity="MEDIUM"
            why="loss of the anchor buyer would cut cash flow below the DSCR floor within one quarter."
            mitigation="24-month supply contract verified; covenant: report buyer-share quarterly."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendation</CardTitle>
          <CardDescription>The explicit decision moment.</CardDescription>
        </CardHeader>
        <CardContent>
          <RecommendationPanel
            decisionLabel="RECOMMENDATION · APPROVE AT REDUCED AMOUNT"
            requestedKobo={500000000}
            recommendedKobo={320000000}
            tenorMonths={12}
            ratePct="5.00"
            rateType="RB"
            rateBasis="Returning client · SBL tier ≤ ₦5m"
            instalmentKobo={36103700}
            totalInterestKobo={113244400}
            basis="assessed repayment capacity supports a lower exposure than requested. Existing obligations and cash-flow variability limit the supportable facility."
            conditions="satisfactory verification of financials and security documentation."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repayment schedule</CardTitle>
          <CardDescription>Reducing-balance preview with principal/interest split.</CardDescription>
        </CardHeader>
        <CardContent>
          <RepaymentScheduleTable rows={demoSchedule.rows} earNote={demoSchedule.earNote} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <ExecutiveSummaryCard
          borrower="Adaeze Okafor Trading Co."
          product="Small Business Loan (SBL)"
          requestedKobo={500000000}
          recommendedKobo={320000000}
          decision="Approve at reduced amount"
          rateLine="5.00% RB / month · Returning · SBL ≤ ₦5m"
          reasons="adequate repayment capacity, acceptable exposure, satisfactory cash flow."
          conditions="verify financials and security documentation."
        />
        <div className="space-y-3">
          <AlertBanner
            title="⚠ Client status unverified."
            message="Rate resolution needs a verified New/Returning flag — confirm prior-facility history before pricing."
            actionLabel="Go to Stage 2 → Profile"
          />
          <AlertBanner
            title="ⓘ Collateral below threshold."
            message="Coverage is adequate at 68% LTV against the 75% cap."
            tone="info"
          />
        </div>
      </div>
    </AppShell>
  );
}
