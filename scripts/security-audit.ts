// RBAC + security integration checks. Requires dev server + DB + seed.
// Usage: npx tsx scripts/security-audit.ts [baseUrl]
// Exits non-zero on any failure. Creates and deletes its own scratch data.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { resolveRate } from "../lib/pricing";

const BASE = process.argv[2] ?? "http://127.0.0.1:3005";
const prisma = new PrismaClient();
let failures = 0;

function check(name: string, cond: boolean) {
  console.log(cond ? `PASS: ${name}` : `FAIL: ${name}`);
  if (!cond) failures++;
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, cookie: cookies.map((c) => c.split(";")[0]).join("; ") };
}

async function get(path: string, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: BASE },
    redirect: "manual",
  });
}

async function main() {
  // 1-2. Anonymous users are bounced to login.
  check("anon /dashboard → redirect", (await get("/dashboard")).status === 307);
  check("anon /admin/rates → redirect", (await get("/admin/rates")).status === 307);
  check("anon /api/documents/x → 401", (await get("/api/documents/doesnotexist")).status === 401);

  // 3. Wrong password rejected.
  check("wrong password → 401", (await signIn("analyst@crediscout.local", "Wrong123!")).status === 401);

  // 4. Seeded analyst can sign in.
  const a1 = await signIn("analyst@crediscout.local", "Analyst123!");
  check("analyst sign-in → 200", a1.status === 200 && a1.cookie.length > 0);

  // 5. Analyst is forbidden from admin console.
  const forbidden = await get("/admin/rates", a1.cookie);
  check(
    "analyst /admin/rates → forbidden redirect",
    forbidden.status === 307 && (forbidden.headers.get("location") ?? "").includes("dashboard?error=forbidden"),
  );

  // 6. Cross-analyst isolation.
  const pw = await hashPassword("Temp1234!");
  const analyst2 = await prisma.user.create({
    data: { name: "Audit Temp", email: "audit-temp@crediscout.local", emailVerified: true, role: "ANALYST" },
  });
  await prisma.account.create({
    data: { userId: analyst2.id, accountId: analyst2.id, providerId: "credential", password: pw },
  });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "analyst@crediscout.local" } });
  const borrower = await prisma.borrower.create({
    data: { type: "BUSINESS", displayName: "Audit Isolation Ltd", clientStatus: "NEW" },
  });
  const assessment = await prisma.assessment.create({
    data: {
      borrowerId: borrower.id, analystId: owner.id, product: "SBL",
      requestedAmountKobo: 100000000n, proposedTenorMonths: 6,
      loanPurpose: "isolation probe", repaymentSource: "isolation probe",
    },
  });
  const doc = await prisma.document.create({
    data: { assessmentId: assessment.id, kind: "other", fileKey: "audit/probe.txt", originalName: "probe.txt" },
  });
  const a2 = await signIn("audit-temp@crediscout.local", "Temp1234!");
  check("second analyst sign-in → 200", a2.status === 200);
  check("analyst2 page on analyst1 file → 404", (await get(`/assessments/${assessment.id}`, a2.cookie)).status === 404);
  check("analyst2 download of analyst1 doc → 403", (await get(`/api/documents/${doc.id}`, a2.cookie)).status === 403);
  check("owner reads own file → 200", (await get(`/assessments/${assessment.id}`, a1.cookie)).status === 200);

  // 7. Rate versioning: expiry is respected; recommendations snapshot their rate.
  await prisma.rateTable.create({
    data: { product: "ASSET", clientStatus: null, minAmountKobo: 0n, maxAmountKobo: null, ratePctMonthly: "7.500", rateType: "RB", note: "audit scratch" },
  });
  const live = await resolveRate({ product: "ASSET", amountKobo: 100000000n, clientStatus: "NEW" });
  check("scratch ASSET row resolves", live !== null && Number(live.ratePctMonthly) === 7.5);
  await prisma.rateTable.updateMany({ where: { product: "ASSET", note: "audit scratch" }, data: { active: false, effectiveTo: new Date() } });
  check("expired row no longer resolves", (await resolveRate({ product: "ASSET", amountKobo: 100000000n, clientStatus: "NEW" })) === null);
  const recs = await prisma.recommendation.findMany({ select: { ratePctMonthly: true } });
  check("recommendations carry own rate snapshot", recs.length > 0 && recs.every((r) => r.ratePctMonthly !== null));

  // Cleanup scratch data.
  await prisma.alert.deleteMany({ where: { assessmentId: assessment.id } });
  await prisma.document.deleteMany({ where: { assessmentId: assessment.id } });
  await prisma.assessment.delete({ where: { id: assessment.id } });
  await prisma.borrower.delete({ where: { id: borrower.id } });
  await prisma.account.deleteMany({ where: { userId: analyst2.id } });
  await prisma.session.deleteMany({ where: { userId: analyst2.id } });
  await prisma.user.delete({ where: { id: analyst2.id } });
  await prisma.rateTable.deleteMany({ where: { product: "ASSET", note: "audit scratch" } });

  await prisma.$disconnect();
  console.log(failures === 0 ? "ALL SECURITY CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
