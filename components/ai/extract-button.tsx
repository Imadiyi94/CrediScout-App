"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ExtractButton({ documentId }: { documentId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ model: string; fields: unknown; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/extract-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setResult({ model: data.model, fields: data.fields, note: data.note });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <Button type="button" variant="secondary" size="sm" onClick={run} disabled={busy}>
        {busy ? "Reading document…" : result ? "Re-run AI Extract" : "AI Extract"}
      </Button>
      {error && <p className="mt-1 text-[13px] text-red-700">{error}</p>}
      {result && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[13px]">
          <p className="font-semibold text-ink">AI draft ({String(result.model)}) — verify before use.</p>
          <pre className="num mt-1 overflow-x-auto whitespace-pre-wrap text-slate-700">
            {JSON.stringify(result.fields, null, 2)}
          </pre>
          <p className="mt-1 text-slate-500">{result.note}</p>
        </div>
      )}
    </div>
  );
}
