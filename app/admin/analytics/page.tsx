import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export default async function AnalyticsPage() {
  const [byStatus, byProduct, recommendations, overrides, pendingRates, openAlerts] = await Promise.all([
    prisma.assessment.groupBy({ by: ["status"], _count: true }),
    prisma.assessment.groupBy({ by: ["product"], _count: true }),
    prisma.recommendation.findMany({
      select: { decision: true, requestedAmountKobo: true, recommendedAmountKobo: true },
    }),
    prisma.recommendationOverride.count(),
    prisma.recommendationOverride.count({ where: { field: "RATE", status: "PENDING" } }),
    prisma.alert.count({ where: { resolvedAt: null } }),
  ]);

  const byDecision = new Map<string, number>();
  const haircuts: number[] = [];
  for (const r of recommendations) {
    byDecision.set(r.decision, (byDecision.get(r.decision) ?? 0) + 1);
    const req = Number(r.requestedAmountKobo);
    if (req > 0 && r.recommendedAmountKobo < r.requestedAmountKobo) {
      haircuts.push((req - Number(r.recommendedAmountKobo)) / req);
    }
  }
  const medHaircut = median(haircuts);
  const overrideRate = recommendations.length > 0 ? overrides / recommendations.length : null;

  const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className="num text-3xl font-extrabold text-ink">{value}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Recommendations" value={String(recommendations.length)} hint="confirmed decisions" />
        <Stat
          label="Override rate"
          value={overrideRate === null ? "—" : `${(overrideRate * 100).toFixed(1)}%`}
          hint="decision/rate overrides per recommendation"
        />
        <Stat
          label="Median haircut"
          value={medHaircut === null ? "—" : `${(medHaircut * 100).toFixed(1)}%`}
          hint="requested → recommended, reduced cases"
        />
        <Stat label="Open alerts" value={String(openAlerts)} hint="unresolved across pipeline" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by status</CardTitle>
          </CardHeader>
          <CardContent className="num space-y-1.5 text-sm">
            {byStatus.map((s) => (
              <p key={s.status}><span className="font-semibold text-ink">{s.status.replace("_", " ")}: </span>{s._count}</p>
            ))}
            {byStatus.length === 0 && <p className="text-slate-500">No assessments yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assessments by product</CardTitle>
          </CardHeader>
          <CardContent className="num space-y-1.5 text-sm">
            {byProduct.map((s) => (
              <p key={s.product}><span className="font-semibold text-ink">{s.product}: </span>{s._count}</p>
            ))}
            {byProduct.length === 0 && <p className="text-slate-500">No assessments yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Decisions &amp; pending rates</CardTitle>
          </CardHeader>
          <CardContent className="num space-y-1.5 text-sm">
            {[...byDecision.entries()].map(([d, n]) => (
              <p key={d}><span className="font-semibold text-ink">{d.replace("_", " ")}: </span>{n}</p>
            ))}
            {byDecision.size === 0 && <p className="text-slate-500">No decisions yet.</p>}
            <p><span className="font-semibold text-ink">Pending rate overrides: </span>{pendingRates}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
