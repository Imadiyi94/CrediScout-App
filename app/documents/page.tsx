import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser, sessionRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { DOC_KIND_LABELS, type DocKind } from "@/lib/documents";

export default async function DocumentsQueuePage() {
  const session = await requireUser();
  const role = sessionRole(session);
  const docs = await prisma.document.findMany({
    where: role === "ADMIN" ? {} : { assessment: { analystId: session.user.id } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      assessment: { select: { id: true, borrower: { select: { displayName: true } } } },
    },
  });

  return (
    <AppShell section="Documents">
      <h1 className="text-2xl font-extrabold text-ink">Documents queue</h1>
      <p className="text-sm text-slate-500">
        Latest 100 uploads{role === "ADMIN" ? " across all analysts" : " on your assessments"}. Open a file to review, then Verify/Reject it on its assessment page.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Uploads pending review</CardTitle>
          <CardDescription>Nothing counts until verified — see Stage 3 on each assessment.</CardDescription>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No documents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs uppercase text-ink">
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">Assessment</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <a href={`/api/documents/${d.id}`} className="font-semibold text-primary">
                          {d.originalName}
                        </a>
                      </td>
                      <td className="px-3 py-2">{DOC_KIND_LABELS[d.kind as DocKind] ?? d.kind}</td>
                      <td className="px-3 py-2">
                        <a href={`/assessments/${d.assessmentId}/documents`} className="font-semibold text-primary">
                          {d.assessment.borrower.displayName}
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={d.verificationStatus === "VERIFIED" ? "green" : d.verificationStatus === "REJECTED" ? "red" : "amber"}>
                          {d.verificationStatus}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{d.createdAt.toLocaleDateString("en-NG")}</td>
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
