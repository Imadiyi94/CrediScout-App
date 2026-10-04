"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function FaceCard({
  assessmentId,
  match,
  score,
}: {
  assessmentId: string;
  match: boolean | null;
  score: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/verify-face", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Face check failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <p className="font-bold text-ink">Face match</p>
        {match === null ? (
          <Badge tone="gray">NOT CHECKED</Badge>
        ) : (
          <Badge tone={match ? "green" : "red"}>
            {match ? `MATCH${score !== null ? ` · ${score.toFixed(1)}` : ""}` : "NO MATCH"}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-[13px] text-slate-500">
        Selfie vs government photo ID. 60+ counts as a match, 90+ is strong.
      </p>
      <form onSubmit={run} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <Field label="Selfie photo">
          <Input name="selfie" type="file" accept="image/*" required />
        </Field>
        <Field label="ID photo">
          <Input name="idPhoto" type="file" accept="image/*" required />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Matching…" : "Verify Face"}
          </Button>
        </div>
      </form>
      {error && <p className="mt-1 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
