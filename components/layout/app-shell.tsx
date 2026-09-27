export function AppShell({
  children,
  section = "Assessments",
}: {
  children: React.ReactNode;
  section?: string;
}) {
  const items = ["Assessments", "Borrowers", "Documents", "Admin"];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-extrabold">
            ◈
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">CrediScout</p>
            <p className="text-[11px] tracking-wide text-slate-300">
              CREDIT ANALYSIS &amp; LENDING DECISIONS
            </p>
          </div>
          <nav className="ml-auto flex gap-1 text-sm">
            {items.map((i) => (
              <span
                key={i}
                className={
                  i === section
                    ? "rounded-lg bg-white/10 px-3 py-1.5 text-white"
                    : "rounded-lg px-3 py-1.5 text-slate-300"
                }
              >
                {i}
              </span>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">{children}</main>
    </div>
  );
}
