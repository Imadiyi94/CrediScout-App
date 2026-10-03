"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { dryRunRate } from "./actions";

const initial = { message: "" };

export function RateDryRun() {
  const [state, action, pending] = useActionState(dryRunRate, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
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
        <Field label="Client status">
          <Select name="clientStatus" defaultValue="RETURNING">
            <option value="NEW">New</option>
            <option value="RETURNING">Returning</option>
          </Select>
        </Field>
        <Field label="Recommended amount (₦)">
          <Input name="amountNaira" defaultValue="3,200,000" className="num" />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Resolving…" : "Preview rate"}
      </Button>
      {state.message && <p className="text-sm font-semibold text-ink">{state.message}</p>}
    </form>
  );
}
