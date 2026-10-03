"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { userUpdateSchema } from "@/lib/validators";

export async function updateUser(formData: FormData) {
  const session = await requireAdmin();
  const parsed = userUpdateSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    active: formData.get("active"),
    scopes: formData.get("scopes") ?? "",
  });
  if (!parsed.success) redirect("/admin/users?error=Invalid+user+update");

  const v = parsed.data;
  if (v.userId === session.user.id && (v.role !== "ADMIN" || v.active !== "true")) {
    redirect("/admin/users?error=You+cannot+demote+or+deactivate+yourself");
  }
  const before = await prisma.user.findUnique({ where: { id: v.userId } });
  if (!before) redirect("/admin/users?error=User+not+found");

  const scopes = v.scopes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const after = await prisma.user.update({
    where: { id: v.userId },
    data: {
      role: v.role as "ANALYST" | "ADMIN",
      active: v.active === "true",
      scopes,
    },
  });
  await logAudit({
    actorId: session.user.id,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: after.id,
    before,
    after,
  });
  revalidatePath("/admin/users");
}
