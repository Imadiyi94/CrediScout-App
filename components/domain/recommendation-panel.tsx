import { formatKobo } from "@/lib/format";

export function RecommendationPanel({
  decisionLabel,
  requestedKobo,
  recommendedKobo,
  tenorMonths,
  ratePct,
  rateType,
  rateBasis,
  instalmentKobo,
  totalInterestKobo,
  basis,
  conditions,
}: {
  decisionLabel: string;
  requestedKobo: number;
  recommendedKobo: number;
  tenorMonths: number;
  ratePct: string;
  rateType: "RB" | "FLAT";
  rateBasis: string;
  instalmentKobo: number;
  totalInterestKobo: number;
  basis: string;
  conditions: string;
}) {
  return (
    <div className="rounded-xl bg-ink p-6 text-slate-200 shadow">
      <span className="inline-block rounded-full bg-gold px-3.5 py-1 text-[13px] font-extrabold tracking-wide text-ink">
        {decisionLabel}
      </span>
      <h3 className="num mt-3 text-2xl font-extrabold text-white">
        {formatKobo(recommendedKobo)} · {tenorMonths} months · {ratePct}% {rateType} / month
      </h3>
      <dl className="num mt-4 grid grid-cols-[180px_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-slate-400">Requested</dt>
        <dd className="font-semibold text-white">{formatKobo(requestedKobo)}</dd>
        <dt className="text-slate-400">Monthly instalment</dt>
        <dd className="font-semibold text-white">{formatKobo(instalmentKobo)}</dd>
        <dt className="text-slate-400">Total interest</dt>
        <dd className="font-semibold text-white">{formatKobo(totalInterestKobo)}</dd>
        <dt className="text-slate-400">Rate basis</dt>
        <dd className="font-semibold text-white">{rateBasis}</dd>
      </dl>
      <p className="mt-4 text-[13.5px]">
        <span className="font-bold text-gold">Basis: </span>
        {basis}
        <br />
        <span className="font-bold text-gold">Conditions: </span>
        {conditions}
      </p>
    </div>
  );
}
