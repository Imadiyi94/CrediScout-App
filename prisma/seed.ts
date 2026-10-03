// Seed: roles, policy thresholds, and PRD §17 rate tables.
// Amounts in kobo. Bands are lower-inclusive / upper-exclusive (top band open-ended).
// Run: npm run db:seed

import { PrismaClient, Product, ClientStatus, RateType } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();
const M = 100_000_000; // ₦1m in kobo (1 naira = 100 kobo)

type Band = { minM: number; maxM: number | null; rate: string };

const SBL_NEW: Band[] = [
  { minM: 0, maxM: 5, rate: "5.00" },
  { minM: 5, maxM: 10, rate: "4.65" },
  { minM: 10, maxM: 20, rate: "4.60" },
  { minM: 20, maxM: 30, rate: "4.50" },
  { minM: 30, maxM: 50, rate: "4.25" },
  { minM: 50, maxM: null, rate: "4.00" },
];

const SBL_RETURNING: Band[] = [
  { minM: 0, maxM: 5, rate: "5.00" },
  { minM: 5, maxM: 10, rate: "4.60" },
  { minM: 10, maxM: 20, rate: "4.50" },
  { minM: 20, maxM: 30, rate: "4.40" },
  { minM: 30, maxM: 50, rate: "4.20" },
  { minM: 50, maxM: null, rate: "3.50" },
];

async function seedRateTable(
  product: Product,
  clientStatus: ClientStatus | null,
  bands: Band[],
  rateType: RateType,
  note: string,
) {
  for (const b of bands) {
    const minAmountKobo = BigInt(Math.round(b.minM * M));
    const maxAmountKobo = b.maxM === null ? null : BigInt(Math.round(b.maxM * M));
    // findFirst: unique upsert can't match NULL clientStatus (fixed-rate rows).
    const existing = await prisma.rateTable.findFirst({
      where: { product, clientStatus, minAmountKobo },
    });
    if (existing) {
      await prisma.rateTable.update({
        where: { id: existing.id },
        data: { maxAmountKobo, ratePctMonthly: b.rate, rateType, active: true, note },
      });
    } else {
      await prisma.rateTable.create({
        data: { product, clientStatus, minAmountKobo, maxAmountKobo, ratePctMonthly: b.rate, rateType, active: true, note },
      });
    }
  }
}

async function main() {
  // Policy thresholds
  const thresholds: { key: string; product: Product | null; value: string; note: string }[] = [
    { key: "DSCR_MIN", product: null, value: "1.2000", note: "Global minimum debt-service cover" },
    { key: "DTI_MAX", product: null, value: "0.5000", note: "Global maximum debt-to-income" },
    { key: "LTV_MAX", product: Product.SBL, value: "0.7500", note: "SBL collateral cap" },
    { key: "LTV_MAX", product: Product.SME, value: "0.7500", note: "SME collateral cap" },
    { key: "LTV_MAX", product: Product.HOUSING_EDU, value: "0.8000", note: "Housing collateral cap" },
    { key: "LTV_MAX", product: Product.ASSET, value: "0.7000", note: "Asset-loan collateral cap" },
  ];
  for (const t of thresholds) {
    const existing = await prisma.policyThreshold.findFirst({
      where: { key: t.key, product: t.product },
    });
    if (existing) {
      await prisma.policyThreshold.update({
        where: { id: existing.id },
        data: { value: t.value, note: t.note },
      });
    } else {
      await prisma.policyThreshold.create({
        data: { key: t.key, product: t.product, value: t.value, note: t.note },
      });
    }
  }

  // SBL / SME tiered RB tables (same bands for both products)
  for (const p of [Product.SBL, Product.SME] as const) {
    await seedRateTable(p, ClientStatus.NEW, SBL_NEW, RateType.RB, `PRD §17.1 ${p} new-client tiers`);
    await seedRateTable(p, ClientStatus.RETURNING, SBL_RETURNING, RateType.RB, `PRD §17.1 ${p} returning-client tiers`);
  }

  // Fixed-rate products: single open-ended row, clientStatus null = all clients
  await seedRateTable(Product.AGRO, null, [{ minM: 0, maxM: null, rate: "5.500" }], RateType.RB, "PRD §17.2 Agro 5.5% RB all amounts");
  await seedRateTable(Product.CLEAN_ENERGY, null, [{ minM: 0, maxM: null, rate: "3.000" }], RateType.FLAT, "PRD §17.2 Clean Energy 3.0% Flat all amounts");
  await seedRateTable(Product.HOUSING_EDU, null, [{ minM: 0, maxM: null, rate: "3.000" }], RateType.FLAT, "PRD §17.2 Housing/Edu 3.0% Flat all amounts");

  // Demo users (dev only — change passwords immediately)
  for (const [email, name, role, scopes, password] of [
    ["admin@crediscout.local", "Admin", "ADMIN", ["rates:write", "users:write", "audit:read"], "Admin123!"],
    ["analyst@crediscout.local", "Analyst", "ANALYST", [], "Analyst123!"],
  ] as const) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, emailVerified: true, role: role as "ADMIN" | "ANALYST", scopes: [...scopes] },
    });
    // Better Auth credential accounts key accountId = user.id (not email).
    await prisma.account.upsert({
      where: { id: `seed-${email}` },
      update: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(password) },
      create: { id: `seed-${email}`, userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(password) },
    });
  }

  console.log("Seed complete: thresholds, §17 rate tables, demo users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
