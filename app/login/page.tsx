import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { signInAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AppShell section="Assessments">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Analysts and admins use their CrediScout account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signInAction} className="space-y-3">
              {params.error && (
                <AlertBanner title="Sign-in failed." message={params.error} tone="danger" />
              )}
              <Field label="Email">
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="analyst@crediscout.local"
                />
              </Field>
              <Field label="Password">
                <Input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
              <p className="text-xs text-slate-500">
                Dev seeds: analyst@crediscout.local / Analyst123! · admin@crediscout.local / Admin123!
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
