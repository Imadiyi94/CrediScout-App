import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "ANALYST", input: false },
      scopes: { type: "string[]", defaultValue: [], input: false },
      active: { type: "boolean", defaultValue: true, input: false },
    },
  },
  plugins: [admin()],
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : undefined,
});

export type Session = typeof auth.$Infer.Session;
