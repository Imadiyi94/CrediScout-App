"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { thresholdSchema } from "@/lib/validators";

export async function updateThreshold(formData: FormData) {
  const session = await requireAdmin();
  const parsed = thresholdSchema.safeParse({
    id: formData.get("id"),
    value: formData.get("value"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    redirect(`/admin/thresholds?error=${encodeURIComponent("Invalid threshold value")}`);
  }
  const before = await prisma.policyThreshold.findUnique({ where: { id: parsed.data.id } });
  if (!before) redirect("/admin/thresholds?error=Threshold+not+found");
  const after = await prisma.policyThreshold.update({
    where: { id: parsed.data.id },
    data: { value: parsed.data.value, note: parsed.data.note || null },
  });
  await logAudit({
    actorId: session.user.id,
    action: "THRESHOLD_UPDATE",
    entityType: "PolicyThreshold",
    entityId: after.id,
    before,
    after,
  });
  revalidatePath("/admin/thresholds");
}
