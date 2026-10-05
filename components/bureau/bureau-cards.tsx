"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/domain/metric-card";

export interface BureauSnapshot {
  firstCentralScore: number;
  crcScore: number;
  averageScore: number;
  mode: string;
  providers: string[];
  checkedAt: string;
  bvnMasked: string;
}

function grade(score: number): string {
  if (score >= 700) return "Excellent";
  if (score >= 600) return "Good";
  if (score >= 500) return "Fair";
  return "Poor";
}

export function BureauCards({
  assessmentId,
  initial,
  hasBvn,
}: {
  assessmentId: string;
  initial: BureauSnapshot | null;
  hasBvn: boolean;
}) {
  const router = useRouter();
  const [report, setReport] = useState<BureauSnapshot | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pull() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/credit-bureau/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bureau pull failed");
      setReport({
        firstCentralScore: data.firstCentralScore,
        crcScore: data.crcScore,
        averageScore: data.averageScore,
        mode: data.mode,
        providers: data.providers,
        checkedAt: data.checkedAt,
        bvnMasked: report?.bvnMasked ?? "***",
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bureau pull failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button type="button" onClick={pull} disabled={busy || !hasBvn}>
          {busy ? "Pulling report…" : report ? "Re-pull bureau report" : "Pull bureau report"}
        </Button>
        {report && (
          <Badge tone={report.mode === "MOCK" ? "amber" : "green"}>
            {report.mode === "MOCK" ? "MOCK MODE" : "LIVE"}
          </Badge>
        )}
        {!hasBvn && (
          <span className="text-[13px] text-slate-500">Verify the borrower&apos;s BVN in Stage 2 first.</span>
        )}
      </div>
      {error && <p className="text-[13px] text-red-700">{error}</p>}
      {report && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              title="FirstCentral Score"
              value={String(report.firstCentralScore)}
              meaning="bureau credit score, 300–850 scale."
              interpretation={`${grade(report.firstCentralScore)} band. Provider: ${report.providers[0] ?? "MOCK-FirstCentral"}.`}
            />
            <MetricCard
              title="CRC Score"
              value={String(report.crcScore)}
              meaning="bureau credit score, 300–850 scale."
              interpretation={`${grade(report.crcScore)} band. Provider: ${report.providers[1] ?? "MOCK-CRC"}.`}
            />
            <MetricCard
              title="Average Score"
              value={String(report.averageScore)}
              meaning="mean of both bureau scores — the figure underwriting references."
              interpretation={`${grade(report.averageScore)} band overall. Checked ${new Date(report.checkedAt).toLocaleString("en-NG")}.`}
              tone={report.averageScore >= 600 ? "good" : report.averageScore >= 500 ? "neutral" : "bad"}
            />
          </div>
          <p className="text-xs text-slate-500">
            BVN {report.bvnMasked} · Mock data for testing — no bureau was contacted.
          </p>
        </>
      )}
    </div>
  );
}
