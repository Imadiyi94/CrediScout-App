"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink"
    >
      Print this page
    </button>
  );
}
