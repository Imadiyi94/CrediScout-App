import { prisma } from "./db";
import { hashPassword } from "better-auth/crypto";

// Direct credential-account creation. (Better Auth's signUpEmail injects
// role:"user", which our ANALYST|ADMIN enum rejects — so admins provision
// accounts explicitly instead.)
export async function createCredentialUser(args: {
  name: string;
  email: string;
  password: string;
  role: "ANALYST" | "ADMIN";
}) {
  const email = args.email.toLowerCase();
  const user = await prisma.user.create({
    data: { name: args.name, email, emailVerified: true, role: args.role },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(args.password),
    },
  });
  return user;
}
