import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

export default async function BorrowersPage() {
  await requireUser();
  // Borrowers are shared reference data; assessments enforce ownership.
  const borrowers = await prisma.borrower.findMany({
    orderBy: { displayName: "asc" },
    include: { _count: { select: { assessments: true } } },
  });

  return (
    <AppShell section="Borrowers">
      <h1 className="text-2xl font-extrabold text-ink">Borrowers</h1>
      <p className="text-sm text-slate-500">Profiles on file. New ones are created from Stage 1.</p>

      <Card>
        <CardHeader>
          <CardTitle>All borrowers</CardTitle>
          <CardDescription>Client status must be verified per assessment before pricing.</CardDescription>
        </CardHeader>
        <CardContent>
          {borrowers.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No borrowers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs uppercase text-ink">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2 text-right">Assessments</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowers.map((b) => (
                    <tr key={b.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-semibold text-ink">{b.displayName}</td>
                      <td className="px-3 py-2">{b.type}</td>
                      <td className="px-3 py-2">
                        <Badge tone="navy">{b.clientStatus}</Badge>{" "}
                        <Badge tone={b.clientStatusVerified ? "green" : "amber"}>
                          {b.clientStatusVerified ? "VERIFIED" : "UNVERIFIED"}
                        </Badge>
                      </td>
                      <td className="num px-3 py-2 text-right">{b._count.assessments}</td>
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
