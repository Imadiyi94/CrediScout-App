import { cn } from "@/lib/utils";

export function AlertBanner({
  title,
  message,
  actionLabel,
  tone = "warning",
}: {
  title: string;
  message: string;
  actionLabel?: string;
  tone?: "warning" | "danger" | "info";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3.5 text-[13.5px]",
        tone === "warning" && "border-amber-300 bg-amber-50",
        tone === "danger" && "border-red-300 bg-red-50",
        tone === "info" && "border-blue-300 bg-blue-50",
      )}
    >
      <p
        className={cn(
          "font-bold",
          tone === "warning" && "text-amber-800",
          tone === "danger" && "text-red-800",
          tone === "info" && "text-blue-800",
        )}
      >
        {title}
      </p>
      <p className="mt-0.5 text-slate-700">
        {message}{" "}
        {actionLabel && <span className="font-semibold text-ink">{actionLabel}</span>}
      </p>
    </div>
  );
}
