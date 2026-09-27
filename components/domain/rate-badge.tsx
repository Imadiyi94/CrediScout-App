export function RateBadge({
  ratePct,
  rateType,
  basis,
}: {
  ratePct: string;
  rateType: "RB" | "FLAT";
  basis: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-[13.5px] font-bold text-white">
      <span className="text-gold">
        {ratePct}% {rateType}
      </span>
      <span className="font-normal">/ month</span>
      <span className="text-xs font-normal text-slate-300">· {basis}</span>
    </span>
  );
}
