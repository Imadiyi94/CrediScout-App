import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { prisma } from "@/lib/db";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string }>;
}) {
  const params = await searchParams;
  const actionFilter = params.action?.trim() ?? "";
  const actorFilter = params.actor?.trim() ?? "";

  const actors = await prisma.user.findMany({ select: { id: true, email: true }, orderBy: { email: "asc" } });
  const actionList = await prisma.auditEvent.findMany({
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
  });

  const events = await prisma.auditEvent.findMany({
    where: {
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(actorFilter ? { actorId: actorFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true } } },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Append-only. Latest 100 events matching the filters.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form method="GET" action="/admin/audit" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Action">
            <Select name="action" defaultValue={actionFilter}>
              <option value="">All actions</option>
              {actionList.map((a) => (
                <option key={a.action} value={a.action}>{a.action}</option>
              ))}
            </Select>
          </Field>
          <Field label="Actor">
            <Select name="actor" defaultValue={actorFilter}>
              <option value="">All actors</option>
              {actors.map((u) => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">Filter</Button>
          </div>
        </form>
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
                    No events match these filters.
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
                    <Badge tone="gray">{e.action}</Badge>
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
