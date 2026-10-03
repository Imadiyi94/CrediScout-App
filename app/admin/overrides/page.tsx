import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/domain/alert-banner";
import { prisma } from "@/lib/db";
import { decideRateOverride } from "./actions";

export default async function OverridesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const pending = await prisma.recommendationOverride.findMany({
    where: { field: "RATE", status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      recommendation: {
        include: { assessment: { include: { borrower: true } } },
      },
    },
  });
  const decided = await prisma.recommendationOverride.findMany({
    where: { field: "RATE", status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      recommendation: {
        include: { assessment: { include: { borrower: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      {params.error && <AlertBanner title="Could not decide." message={params.error} tone="danger" />}

      <Card>
        <CardHeader>
          <CardTitle>Pending rate overrides</CardTitle>
          <CardDescription>Analyst-proposed rates differing from the resolved table rate. Approval rebuilds the schedule.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 && (
            <p className="py-2 text-center text-sm text-slate-500">No pending rate overrides.</p>
          )}
          {pending.map((o) => (
            <div key={o.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-bold text-ink">
                {o.recommendation.assessment.borrower.displayName} ·{" "}
                <span className="num">{o.oldValue} → {o.newValue}</span>
              </p>
              <p className="mt-1 text-slate-600">Reason: {o.reason}</p>
              <div className="mt-2 flex gap-2">
                <form action={decideRateOverride}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="approve" value="yes" />
                  <Button type="submit" variant="success" size="sm">Approve &amp; reprice</Button>
                </form>
                <form action={decideRateOverride}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="approve" value="no" />
                  <Button type="submit" variant="dangerGhost" size="sm">Reject</Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently decided</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {decided.map((o) => (
            <p key={o.id}>
              <Badge tone={o.status === "APPROVED" ? "green" : "red"}>{o.status}</Badge>{" "}
              {o.recommendation.assessment.borrower.displayName} ·{" "}
              <span className="num">{o.oldValue} → {o.newValue}</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
