import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";

const TONE: Record<string, "green" | "amber" | "red" | "blue" | "navy" | "gray"> = {
  RATE_CREATE: "navy",
  RATE_EXPIRE: "amber",
  THRESHOLD_UPDATE: "amber",
  USER_UPDATE: "blue",
};

export default async function AuditPage() {
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true } } },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Append-only. Latest 100 events.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase text-ink">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                    No events yet — rate, threshold, and user changes will appear here.
                  </td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.id} className="border-t border-slate-200">
                  <td className="num whitespace-nowrap px-3 py-2">
                    {e.createdAt.toLocaleString("en-NG")}
                  </td>
                  <td className="px-3 py-2">{e.actor.email}</td>
                  <td className="px-3 py-2">
                    <Badge tone={TONE[e.action] ?? "gray"}>{e.action}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.entityType} · {e.entityId.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2 text-slate-500">{e.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
