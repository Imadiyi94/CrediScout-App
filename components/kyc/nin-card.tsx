"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function maskId(v: string | null): string {
  if (!v || v.length < 3) return "—";
  return `*** *** ${v.slice(-3)}`;
}

export function NinCard({
  assessmentId,
  verified,
  number,
  name,
}: {
  assessmentId: string;
  verified: boolean;
  number: string | null;
  name: string | null;
}) {
  const router = useRouter();
  const [nin, setNin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!/^\d{11}$/.test(nin)) {
      setError("NIN must be 11 digits");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/verify-nin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, nin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "NIN check failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "NIN check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <p className="font-bold text-ink">NIN</p>
        <Badge tone={verified ? "green" : "red"}>{verified ? "VERIFIED" : "NOT VERIFIED"}</Badge>
      </div>
      {verified ? (
        <p className="mt-1 text-sm text-slate-600">
          {maskId(number)}{name ? ` · ${name}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-slate-500">Check the 11-digit NIN against NIMC.</p>
      )}
      <div className="mt-2 flex gap-2">
        <div className="flex-1">
          <Field label={verified ? "Re-check a different NIN" : "NIN (11 digits)"}>
            <Input value={nin} onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="70123456789" className="num" inputMode="numeric" />
          </Field>
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={run} disabled={busy}>
            {busy ? "Checking…" : "Verify NIN"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-1 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
