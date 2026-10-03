import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session;
}

export type AppRole = "ANALYST" | "ADMIN";

export function sessionRole(session: Awaited<ReturnType<typeof getSession>>): AppRole {
  return ((session?.user as unknown as { role?: AppRole })?.role ?? "ANALYST");
}

export async function requireAdmin() {
  const session = await requireUser();
  if (sessionRole(session) !== "ADMIN") redirect("/dashboard?error=forbidden");
  return session;
}
