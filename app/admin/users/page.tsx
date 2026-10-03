import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { prisma } from "@/lib/db";
import { updateUser } from "./actions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Two roles only. Designers and managers operate as scoped Admins.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {params.error && <AlertBanner title="Could not save." message={params.error} tone="danger" />}
        {users.map((u) => (
          <form
            key={u.id}
            action={updateUser}
            className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1.4fr_1fr_1fr_1.4fr_auto]"
          >
            <input type="hidden" name="userId" value={u.id} />
            <div>
              <p className="font-semibold text-ink">{u.name}</p>
              <p className="text-[13px] text-slate-500">{u.email}</p>
              {!u.active && <Badge tone="red">INACTIVE</Badge>}
            </div>
            <Field label="Role">
              <Select name="role" defaultValue={u.role}>
                <option value="ANALYST">ANALYST</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="active" defaultValue={u.active ? "true" : "false"}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </Field>
            <Field label="Scopes (comma-separated)">
              <Input name="scopes" defaultValue={u.scopes.join(", ")} placeholder="rates:write, audit:read" />
            </Field>
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}
