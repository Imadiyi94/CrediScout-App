import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { sendEmail } from "./email";

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
  plugins: [
    admin(),
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "sign-in" || type === "email-verification") {
          await sendEmail({
            to: email,
            subject: "Your CrediScout sign-in code",
            text: `Your CrediScout sign-in code is ${otp}. It expires in 10 minutes. If you did not request it, ignore this email.`,
          });
        }
      },
    }),
    nextCookies(),
  ],
  trustedOrigins: [
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    // Local dev servers (never in production).
    ...(process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://localhost:3005", "http://127.0.0.1:3005"]),
  ],
});

export type Session = typeof auth.$Infer.Session;
