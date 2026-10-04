"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { maskId } from "./nin-card";

export function BvnCard({
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
  const [bvn, setBvn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!/^\d{11}$/.test(bvn)) {
      setError("BVN must be 11 digits");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/verify-bvn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, bvn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "BVN check failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "BVN check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <p className="font-bold text-ink">BVN</p>
        <Badge tone={verified ? "green" : "red"}>{verified ? "VERIFIED" : "NOT VERIFIED"}</Badge>
      </div>
      {verified ? (
        <p className="mt-1 text-sm text-slate-600">
          {maskId(number)}{name ? ` · ${name}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-slate-500">Check the 11-digit BVN against bank records.</p>
      )}
      <div className="mt-2 flex gap-2">
        <div className="flex-1">
          <Field label={verified ? "Re-check a different BVN" : "BVN (11 digits)"}>
            <Input value={bvn} onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="22222222222" className="num" inputMode="numeric" />
          </Field>
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={run} disabled={busy}>
            {busy ? "Checking…" : "Verify BVN"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-1 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
