import { formatKobo } from "@/lib/format";

export interface ScheduleRow {
  period: number | string;
  openingKobo: number | null;
  instalmentKobo: number;
  principalKobo: number;
  interestKobo: number;
  closingKobo: number | null;
  total?: boolean;
}

export function RepaymentScheduleTable({
  rows,
  earNote,
}: {
  rows: ScheduleRow[];
  earNote?: string;
}) {
  const cell = (v: number | null) => (v === null ? "—" : formatKobo(v));
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="num w-full bg-white text-[13.5px]">
        <thead>
          <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-ink">
            <th className="px-3 py-2.5">Period</th>
            <th className="px-3 py-2.5 text-right">Opening</th>
            <th className="px-3 py-2.5 text-right">Instalment</th>
            <th className="px-3 py-2.5 text-right">Principal</th>
            <th className="px-3 py-2.5 text-right">Interest</th>
            <th className="px-3 py-2.5 text-right">Closing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={r.total ? "bg-primary-soft font-bold text-ink" : "border-t border-slate-200"}
            >
              <td className="px-3 py-2.5">{r.period}</td>
              <td className="px-3 py-2.5 text-right">{cell(r.openingKobo)}</td>
              <td className="px-3 py-2.5 text-right">{cell(r.instalmentKobo)}</td>
              <td className="px-3 py-2.5 text-right">{cell(r.principalKobo)}</td>
              <td className="px-3 py-2.5 text-right">{cell(r.interestKobo)}</td>
              <td className="px-3 py-2.5 text-right">{cell(r.closingKobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {earNote && <p className="bg-white px-3 py-2 text-xs text-slate-500">{earNote}</p>}
    </div>
  );
}
