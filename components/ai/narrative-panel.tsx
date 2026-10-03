"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function NarrativePanel({ assessmentId }: { assessmentId: string }) {
  const [busy, setBusy] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [model, setModel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setNarrative(data.narrative);
      setModel(data.model);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={run} disabled={busy}>
        {busy ? "Writing summary…" : narrative ? "Regenerate AI Summary" : "Generate AI Summary"}
      </Button>
      {error && <p className="text-[13px] text-red-700">{error}</p>}
      {narrative && (
        <div className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            AI draft ({model}) — you own the final wording
          </p>
          {narrative.split("\n\n").map((p, i) => (
            <p key={i} className="mb-3 text-slate-800">{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}
