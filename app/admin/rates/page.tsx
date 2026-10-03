import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { prisma } from "@/lib/db";
import { formatKobo } from "@/lib/format";
import { createRate, expireRate } from "./actions";
import { RateDryRun } from "./dry-run";

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const rows = await prisma.rateTable.findMany({
    orderBy: [{ product: "asc" }, { clientStatus: "asc" }, { minAmountKobo: "asc" }],
  });

  return (
    <div className="space-y-6">
      {params.error && (
        <AlertBanner title="Could not save." message={params.error} tone="danger" />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rate dry-run</CardTitle>
          <CardDescription>Preview the resolved rate before recommending — same logic as assessments use.</CardDescription>
        </CardHeader>
        <CardContent>
          <RateDryRun />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active &amp; historical rows</CardTitle>
          <CardDescription>Expiring never deletes — old recommendations keep their historical rate.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="num w-full text-[13px]">
              <thead>
                <tr className="bg-slate-100 text-left text-xs uppercase text-ink">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2 text-right">Min</th>
                  <th className="px-3 py-2 text-right">Max</th>
                  <th className="px-3 py-2 text-right">Rate/mo</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-semibold">{r.product}</td>
                    <td className="px-3 py-2">{r.clientStatus ?? "All"}</td>
                    <td className="px-3 py-2 text-right">{formatKobo(r.minAmountKobo)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.maxAmountKobo === null ? "∞" : formatKobo(r.maxAmountKobo)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{String(r.ratePctMonthly)}%</td>
                    <td className="px-3 py-2">{r.rateType}</td>
                    <td className="px-3 py-2">
                      <Badge tone={r.active ? "green" : "gray"}>
                        {r.active ? "ACTIVE" : "EXPIRED"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.note ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.active && (
                        <form action={expireRate}>
                          <input type="hidden" name="id" value={r.id} />
                          <Button type="submit" variant="dangerGhost" size="sm">
                            Expire
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New rate row</CardTitle>
          <CardDescription>Takes effect immediately. Leave client blank for all-client fixed rates; leave max blank for the open-ended top band.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createRate} className="grid gap-3 sm:grid-cols-2">
            <Field label="Product">
              <Select name="product" defaultValue="SBL">
                <option value="SBL">SBL</option>
                <option value="SME">SME</option>
                <option value="AGRO">Agro</option>
                <option value="CLEAN_ENERGY">Clean Energy</option>
                <option value="HOUSING_EDU">Housing / Edu</option>
                <option value="ASSET">Asset</option>
              </Select>
            </Field>
            <Field label="Client status (blank = all)">
              <Select name="clientStatus" defaultValue="">
                <option value="">All clients</option>
                <option value="NEW">New</option>
                <option value="RETURNING">Returning</option>
              </Select>
            </Field>
            <Field label="Min amount (₦, inclusive)">
              <Input name="minNaira" required placeholder="5,000,000" className="num" />
            </Field>
            <Field label="Max amount (₦, exclusive — blank = ∞)">
              <Input name="maxNaira" placeholder="10,000,000" className="num" />
            </Field>
            <Field label="Rate % per month">
              <Input name="ratePct" required placeholder="4.60" className="num" />
            </Field>
            <Field label="Rate type">
              <Select name="rateType" defaultValue="RB">
                <option value="RB">RB (reducing balance)</option>
                <option value="FLAT">FLAT</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note">
                <Input name="note" placeholder="e.g. PRD §17.1 revision, effective Jan 2027" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Add rate row</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
