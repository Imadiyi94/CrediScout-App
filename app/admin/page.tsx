import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CARDS = [
  { href: "/admin/rates", title: "Lending rates", desc: "PRD §17 tables: SBL/SME tiers by amount × New/Returning, fixed rates for Agro/Clean Energy/Housing-Edu, Admin-configured Asset rates." },
  { href: "/admin/thresholds", title: "Policy thresholds", desc: "DSCR_MIN, DTI_MAX, per-product LTV caps. New assessments read these live." },
  { href: "/admin/users", title: "Users", desc: "Two roles only: ANALYST and ADMIN. Designers and managers operate as scoped Admins." },
  { href: "/admin/audit", title: "Audit log", desc: "Append-only trail of rate changes, overrides, and user edits." },
];

export default function AdminHome() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {CARDS.map((c) => (
        <a key={c.href} href={c.href}>
          <Card>
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
              <CardDescription>{c.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm font-semibold text-primary">Open →</span>
            </CardContent>
          </Card>
        </a>
      ))}
    </div>
  );
}
