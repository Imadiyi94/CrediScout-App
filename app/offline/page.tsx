import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <AppShell section="Assessments">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>You are offline</CardTitle>
            <CardDescription>
              CrediScout needs a connection for assessments — your data lives safely on the server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Reconnect and pick up where you left off. Nothing you saved was lost.
            </p>
            <a
              href="/dashboard"
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              Retry dashboard
            </a>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
