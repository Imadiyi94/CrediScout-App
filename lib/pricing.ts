import { prisma } from "./db";

// Boundary rule (matches PRD §17 labels exactly):
// - First band (min == 0): amount <= max — honours "≤ ₦5,000,000".
// - Other bands: amount >= min AND (max null OR amount < max) — honours
//   "> ₦5m", "≥ ₦10m/₦20m/₦30m", and the open-ended top band (≥ ₦50m).
// Seeded maxes equal the next band's min, so there are no gaps/overlaps —
// except exactly ₦5,000,000, which matches bands 1 and 2 and resolves to
// band 1 (ascending-min preference). Prefers exact clientStatus over null.
export async function resolveRate(args: {
  product: "SBL" | "SME" | "AGRO" | "CLEAN_ENERGY" | "HOUSING_EDU" | "ASSET";
  amountKobo: bigint;
  clientStatus: "NEW" | "RETURNING";
  at?: Date;
}) {
  const at = args.at ?? new Date();
  const rows = await prisma.rateTable.findMany({
    where: {
      product: args.product,
      active: true,
      effectiveFrom: { lte: at },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
        {
          OR: [
            // First band: inclusive cap ("≤ ₦5,000,000")
            { minAmountKobo: 0, maxAmountKobo: { gte: args.amountKobo } },
            // Open-ended all-amounts row (fixed-rate products)
            { minAmountKobo: 0, maxAmountKobo: null },
            // Middle bands: min-inclusive, max-exclusive (no gaps/overlaps)
            {
              minAmountKobo: { gt: 0, lte: args.amountKobo },
              maxAmountKobo: { gt: args.amountKobo },
            },
            // Open-ended top band: min-inclusive
            { minAmountKobo: { gt: 0, lte: args.amountKobo }, maxAmountKobo: null },
          ],
        },
      ],
    },
  });
  const exact = rows.filter((r) => r.clientStatus === args.clientStatus);
  const pool = exact.length > 0 ? exact : rows.filter((r) => r.clientStatus === null);
  if (pool.length === 0) return null;
  pool.sort((a, b) => (a.minAmountKobo < b.minAmountKobo ? -1 : 1));
  return pool[0];
}
