import Link from "next/link";

export default function Home() {
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
          <nav className="ml-auto flex gap-1 text-sm">
            <span className="rounded-lg bg-white/10 px-3 py-1.5">Assessments</span>
            <span className="rounded-lg px-3 py-1.5 text-slate-300">Borrowers</span>
            <span className="rounded-lg px-3 py-1.5 text-slate-300">Admin</span>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-extrabold text-ink">
          Phase 0 scaffold is live
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Foundations are in place: Next.js + TypeScript + Tailwind, Prisma +
          PostgreSQL 16, Better Auth, R2-compatible file storage, Docker
          Compose, and CI. Phase 1 (design system) and Phase 2 (data/auth/admin)
          build on this.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/api/health"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Check API health
          </Link>
          <Link
            href="https://github.com/Imadiyi94/CrediScout-PRD"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink"
          >
            Read the PRD
          </Link>
        </div>
      </div>
    </main>
  );
}
