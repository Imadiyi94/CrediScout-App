import { AppShell } from "@/components/layout/app-shell";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { requireAdmin } from "@/lib/auth-helpers";

const NAV = [
  { href: "/admin/rates", title: "Lending rates", desc: "Tiered and fixed rate tables with effective dating" },
  { href: "/admin/thresholds", title: "Policy thresholds", desc: "DSCR minimums, DTI caps, LTV limits" },
  { href: "/admin/users", title: "Users", desc: "Analyst and admin accounts, roles, scopes" },
  { href: "/admin/overrides", title: "Rate overrides", desc: "Pending analyst-proposed rate changes" },
  { href: "/admin/audit", title: "Audit log", desc: "Every mutation, override, and rate change" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <AppShell section="Admin">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Admin console</h1>
          <p className="text-sm text-slate-500">Signed in as {session.user.email}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink"
          >
            Dashboard
          </a>
          <SignOutButton />
        </div>
      </div>
      <nav className="flex flex-wrap gap-2">
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink hover:border-primary"
          >
            {n.title}
          </a>
        ))}
      </nav>
      {children}
    </AppShell>
  );
}
