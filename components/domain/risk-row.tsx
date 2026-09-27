import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const severityTone = { HIGH: "red", MEDIUM: "amber", LOW: "green" } as const;

export function RiskRow({
  title,
  severity,
  why,
  mitigation,
}: {
  title: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  why: string;
  mitigation: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 border-l-4 bg-white px-4 py-3.5",
        severity === "HIGH" && "border-l-red-700",
        severity === "MEDIUM" && "border-l-amber-600",
        severity === "LOW" && "border-l-green-700",
      )}
    >
      <p className="font-semibold text-ink">
        {title} <Badge tone={severityTone[severity]}>{severity}</Badge>
      </p>
      <p className="mt-1 text-[13.5px]">
        <span className="font-semibold text-ink">Why it matters: </span>
        {why}
      </p>
      <p className="mt-1 text-[13px] text-green-800">
        <span className="font-semibold">✓ Mitigation: </span>
        {mitigation}
      </p>
    </div>
  );
}
