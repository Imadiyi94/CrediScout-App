import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  meaning,
  interpretation,
  tone = "neutral",
}: {
  title: string;
  value: string;
  meaning: string;
  interpretation: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
        <p
          className={cn(
            "num mt-1 text-3xl font-extrabold",
            tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-700" : "text-ink",
          )}
        >
          {value}
        </p>
        <p className="mt-2 text-sm">
          <span className="font-semibold text-ink">What it measures: </span>
          {meaning}
        </p>
        <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] text-slate-600">
          <span className="font-semibold text-ink">Interpretation: </span>
          {interpretation}
        </p>
      </CardContent>
    </Card>
  );
}
