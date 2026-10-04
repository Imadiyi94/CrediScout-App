import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { prisma } from "@/lib/db";
import { createUser, resetUserPassword, updateUser } from "./actions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const params = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create login for analyst or admin</CardTitle>
          <CardDescription>Issue an email + temporary password, then share them privately with the person (they sign in at /login).</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error && <AlertBanner title="Could not save." message={params.error} tone="danger" />}
          {params.ok && <AlertBanner title="Done." message={params.ok} tone="info" />}
          <form action={createUser} className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <Input name="name" required placeholder="e.g. Bola Adeyemi" />
            </Field>
            <Field label="Email (login)">
              <Input name="email" required type="email" placeholder="bola@example.com" />
            </Field>
            <Field label="Temporary password (min 8)">
              <Input name="password" required placeholder="e.g. Welcome123!" />
            </Field>
            <Field label="Role">
              <Select name="role" defaultValue="ANALYST">
                <option value="ANALYST">ANALYST</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Create account</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Two roles only. Designers and managers operate as scoped Admins.</CardDescription>
        </CardHeader>
      <CardContent className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="space-y-2">
          <form
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
          <form action={resetUserPassword} className="flex items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3">
            <input type="hidden" name="userId" value={u.id} />
            <div className="flex-1">
              <Field label={`Reset password for ${u.email}`}>
                <Input name="newPassword" placeholder="New temporary password (min 8)" />
              </Field>
            </div>
            <Button type="submit" variant="dangerGhost" size="sm">
              Reset password
            </Button>
          </form>
        </div>
        ))}
      </CardContent>
    </Card>
    </div>
  );
}
