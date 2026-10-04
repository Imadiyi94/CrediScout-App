"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "better-auth/crypto";
import { createCredentialUser } from "@/lib/users";
import { adminCreateUserSchema, adminResetPasswordSchema, userUpdateSchema } from "@/lib/validators";

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

export async function createUser(formData: FormData) {
  const session = await requireAdmin();
  const parsed = adminCreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect(`/admin/users?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid user details")}`);
  }
  const v = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email: v.email.toLowerCase() } });
  if (exists) redirect("/admin/users?error=That+email+is+already+registered");

  try {
    await createCredentialUser({ name: v.name, email: v.email, password: v.password, role: v.role });
  } catch {
    redirect("/admin/users?error=Could+not+create+account");
  }
  const created = await prisma.user.findUniqueOrThrow({ where: { email: v.email.toLowerCase() } });
  await logAudit({
    actorId: session.user.id,
    action: "USER_CREATE",
    entityType: "User",
    entityId: created.id,
    after: { email: created.email, role: v.role },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?ok=Account+created+-+share+the+email+and+password+with+the+person");
}

export async function resetUserPassword(formData: FormData) {
  const session = await requireAdmin();
  const parsed = adminResetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) redirect("/admin/users?error=Password+must+be+8%2B+characters");
  if (parsed.data.userId === session.user.id) {
    redirect("/admin/users?error=Use+your+own+profile+to+change+your+password");
  }
  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) redirect("/admin/users?error=User+not+found");
  await prisma.account.updateMany({
    where: { userId: target.id, providerId: "credential" },
    data: { password: await hashPassword(parsed.data.newPassword) },
  });
  await logAudit({
    actorId: session.user.id,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: target.id,
  });
  revalidatePath("/admin/users");
  redirect(`/admin/users?ok=Password+reset+for+${encodeURIComponent(target.email)}`);
}
