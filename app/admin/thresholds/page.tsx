import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { prisma } from "@/lib/db";
import { updateThreshold } from "./actions";

export default async function ThresholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const rows = await prisma.policyThreshold.findMany({ orderBy: [{ key: "asc" }] });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy thresholds</CardTitle>
        <CardDescription>Live values read by new assessments. Every edit is audit-logged.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {params.error && <AlertBanner title="Could not save." message={params.error} tone="danger" />}
        {rows.map((t) => (
          <form
            key={t.id}
            action={updateThreshold}
            className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
          >
            <input type="hidden" name="id" value={t.id} />
            <div>
              <p className="text-xs font-bold text-slate-500">KEY</p>
              <p className="font-mono text-sm font-bold text-ink">
                {t.key}
                {t.product ? ` · ${t.product}` : ""}
              </p>
            </div>
            <Field label="Value">
              <Input name="value" defaultValue={String(t.value)} className="num font-mono" />
            </Field>
            <Field label="Note">
              <Input name="note" defaultValue={t.note ?? ""} />
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
