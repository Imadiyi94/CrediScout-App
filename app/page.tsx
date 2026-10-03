import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";

export default async function Home() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="min-h-screen">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-extrabold">
            ◈
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">CrediScout</p>
            <p className="text-xs tracking-wide text-slate-300">
              CREDIT ANALYSIS &amp; LENDING DECISIONS
            </p>
          </div>
          <nav className="ml-auto">
            <a
              href="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-ink">
          Turn borrower information into explicit, evidence-based lending recommendations.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Structured financial and risk analysis across 11 stages — capacity, credit,
          collateral, product-specific risks, supportable amount, correct lending rate,
          and a decision you can explain.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a
            href="/login"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Sign in to start
          </a>
          <a
            href="/design"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-ink"
          >
            View design system
          </a>
        </div>
        <div className="num mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-2xl font-extrabold text-ink">11</p>
            <p className="text-sm text-slate-500">stages from intake to explicit decision</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-2xl font-extrabold text-ink">6</p>
            <p className="text-sm text-slate-500">loan products with automatic rate resolution</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-2xl font-extrabold text-ink">57</p>
            <p className="text-sm text-slate-500">engine tests guarding every calculation</p>
          </div>
        </div>
      </div>
    </main>
  );
}
