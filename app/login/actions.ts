"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=Enter+email+and+password");
  try {
    await auth.api.signInEmail({ body: { email, password } });
  } catch {
    redirect("/login?error=Invalid+email+or+password");
  }
  redirect("/dashboard");
}

export async function signOutAction() {
  const { headers } = await import("next/headers");
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Already signed out — still land on login.
  }
  redirect("/login");
}
