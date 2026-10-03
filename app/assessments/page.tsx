import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser, sessionRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { formatKobo } from "@/lib/format";
import { PRODUCT_LABELS, type ProductKey } from "@/lib/products";

export default async function AssessmentsPage() {
  const session = await requireUser();
  const role = sessionRole(session);
  const assessments = await prisma.assessment.findMany({
    where: role === "ADMIN" ? {} : { analystId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { borrower: { select: { displayName: true } } },
  });

  return (
    <AppShell section="Assessments">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Assessments</h1>
          <p className="text-sm text-slate-500">
            {role === "ADMIN" ? "All analysts' assessments" : "Your assessment pipeline"}
          </p>
        </div>
        <a href="/assessments/new" className="ml-auto">
          <Button>New assessment</Button>
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
          <CardDescription>Draft → In review → Recommended → Decided.</CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No assessments yet. Start one with “New assessment”.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="num w-full text-[13.5px]">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs uppercase text-ink">
                    <th className="px-3 py-2">Borrower</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Requested</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <a href={`/assessments/${a.id}`} className="font-semibold text-primary">
                          {a.borrower.displayName}
                        </a>
                      </td>
                      <td className="px-3 py-2">{PRODUCT_LABELS[a.product as ProductKey]}</td>
                      <td className="px-3 py-2 text-right">{formatKobo(a.requestedAmountKobo)}</td>
                      <td className="px-3 py-2">Stage {a.currentStage} / 11</td>
                      <td className="px-3 py-2">
                        <Badge tone="blue">{a.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-3 py-2">{a.updatedAt.toLocaleDateString("en-NG")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
