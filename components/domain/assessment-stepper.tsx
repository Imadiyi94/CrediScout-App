import { STAGES, type StageStatus } from "@/lib/stages";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<StageStatus, string> = {
  complete: "✓ complete",
  active: "● in progress",
  todo: "not started",
  attention: "⚠ needs attention",
};

export function AssessmentStepper({ states }: { states: StageStatus[] }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STAGES.map((s, i) => {
        const st = states[i] ?? "todo";
        return (
          <li
            key={s.key}
            className={cn(
              "min-w-[118px] flex-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs",
              st === "complete" && "border-l-4 border-l-green-700 bg-white",
              st === "active" && "border-l-4 border-l-primary bg-primary-soft",
              st === "attention" && "border-l-4 border-l-amber-600 bg-amber-50",
            )}
          >
            <span className="block text-[12.5px] font-bold text-ink">
              {s.index} · {s.title}
            </span>
            <span className="text-[11px] text-slate-500">{STATUS_LABEL[st]}</span>
          </li>
        );
      })}
    </ol>
  );
}
