import { AppShell } from "@/components/layout/app-shell";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertBanner } from "@/components/domain/alert-banner";
import { requireUser, sessionRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUser();
  const role = sessionRole(session);
  const params = await searchParams;
  const [borrowers, assessments, pendingAlerts] = await Promise.all([
    prisma.borrower.count(),
    prisma.assessment.count(),
    prisma.alert.count({ where: { resolvedAt: null } }),
  ]);

  return (
    <AppShell section="Assessments">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Signed in as {session.user.email}{" "}
            <Badge tone={role === "ADMIN" ? "navy" : "gray"}>{role}</Badge>
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {role === "ADMIN" && (
            <a
              href="/admin"
              className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-white"
            >
              Admin console
            </a>
          )}
          <SignOutButton />
        </div>
      </div>

      {params.error === "forbidden" && (
        <AlertBanner
          title="Admins only."
          message="That area requires the Admin role."
          tone="danger"
        />
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Borrowers</CardTitle>
            <CardDescription>Profiles on file</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="num text-3xl font-extrabold text-ink">{borrowers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assessments</CardTitle>
            <CardDescription>Across all stages</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="num text-3xl font-extrabold text-ink">{assessments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open alerts</CardTitle>
            <CardDescription>Needing analyst attention</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="num text-3xl font-extrabold text-ink">{pendingAlerts}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessment workflow</CardTitle>
          <CardDescription>Stages 1–3 arrive in Phase 3. Design reference lives at /design.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/design" className="text-sm font-semibold text-primary">
            Open the design system →
          </a>
        </CardContent>
      </Card>
    </AppShell>
  );
}
