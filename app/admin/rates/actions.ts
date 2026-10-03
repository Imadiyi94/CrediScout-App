"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { parseNairaToKobo } from "@/lib/format";
import { dryRunSchema, rateRowSchema } from "@/lib/validators";
import { resolveRate } from "@/lib/pricing";

function fail(to: string, message: string): never {
  redirect(`${to}?error=${encodeURIComponent(message)}`);
}

export async function createRate(formData: FormData) {
  const session = await requireAdmin();
  const parsed = rateRowSchema.safeParse({
    product: formData.get("product"),
    clientStatus: formData.get("clientStatus"),
    minNaira: formData.get("minNaira"),
    maxNaira: formData.get("maxNaira"),
    ratePct: formData.get("ratePct"),
    rateType: formData.get("rateType"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) fail("/admin/rates", parsed.error.issues[0]?.message ?? "Invalid rate row");

  const v = parsed.data;
  let minKobo: bigint;
  let maxKobo: bigint | null = null;
  try {
    minKobo = parseNairaToKobo(v.minNaira);
    if (v.maxNaira.trim() !== "") maxKobo = parseNairaToKobo(v.maxNaira);
  } catch {
    fail("/admin/rates", "Amounts must be numbers in naira");
  }
  if (maxKobo !== null && maxKobo <= minKobo!) fail("/admin/rates", "Maximum must exceed minimum");

  const row = await prisma.rateTable.create({
    data: {
      product: v.product,
      clientStatus: v.clientStatus === "" ? null : (v.clientStatus as "NEW" | "RETURNING"),
      minAmountKobo: minKobo!,
      maxAmountKobo: maxKobo,
      ratePctMonthly: v.ratePct,
      rateType: v.rateType,
      note: v.note || null,
    },
  });
  await logAudit({
    actorId: session.user.id,
    action: "RATE_CREATE",
    entityType: "RateTable",
    entityId: row.id,
    after: row,
  });
  revalidatePath("/admin/rates");
}

export async function expireRate(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.rateTable.findUnique({ where: { id } });
  if (!row) fail("/admin/rates", "Rate row not found");
  const updated = await prisma.rateTable.update({
    where: { id },
    data: { active: false, effectiveTo: new Date() },
  });
  await logAudit({
    actorId: session.user.id,
    action: "RATE_EXPIRE",
    entityType: "RateTable",
    entityId: id,
    before: row,
    after: updated,
    reason: String(formData.get("reason") ?? ""),
  });
  revalidatePath("/admin/rates");
}

export async function dryRunRate(_prev: { message: string } | null, formData: FormData) {
  const parsed = dryRunSchema.safeParse({
    product: formData.get("product"),
    clientStatus: formData.get("clientStatus"),
    amountNaira: formData.get("amountNaira"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Invalid input" };
  let amountKobo: bigint;
  try {
    amountKobo = parseNairaToKobo(parsed.data.amountNaira);
  } catch {
    return { message: "Amount must be a number in naira" };
  }
  const row = await resolveRate({
    product: parsed.data.product,
    amountKobo,
    clientStatus: parsed.data.clientStatus,
  });
  if (!row) return { message: "No active rate row covers that amount — check the tables." };
  const client = row.clientStatus ?? "all clients";
  return {
    message: `Result: ${String(row.ratePctMonthly)}% ${row.rateType} / month (${row.product}, ${client}).`,
  };
}
