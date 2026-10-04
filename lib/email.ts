// Outbound email. Resend for testing now; Amazon SES at go-live.
// Provider switch: EMAIL_PROVIDER=resend (default) or ses.

export type EmailProvider = "resend" | "ses";

export function emailProvider(): EmailProvider {
  return process.env.EMAIL_PROVIDER === "ses" ? "ses" : "resend";
}

function resendKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set. Add it to local .env and restart.");
  return key;
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || "CrediScout <onboarding@resend.dev>";
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
}

// Returns the provider's message id. Throws on failure.
export async function sendEmail(args: SendEmailArgs): Promise<{ id: string }> {
  if (emailProvider() === "ses") {
    throw new Error("Amazon SES is not wired until go-live. Set EMAIL_PROVIDER=resend for testing.");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: emailFrom(), to: [args.to], subject: args.subject, text: args.text }),
  });
  const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok) {
    throw new Error(`Resend failed: ${data?.message ?? res.statusText} (testing note: free tier sends only to your signup email)`);
  }
  return { id: data?.id ?? "" };
}

// Emails every active admin. Used for rate-override approvals (Phase 7.4).
// Failures never throw — notifications must not break the workflow that raised them.
export async function notifyAdminsRateOverride(args: {
  borrowerName: string;
  assessmentId: string;
  oldRate: string;
  newRate: string;
  reason: string;
  analystEmail: string;
}): Promise<{ sent: number; skipped: number }> {
  const { prisma } = await import("./db");
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { email: true },
  });
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3005";
  let sent = 0;
  let skipped = 0;
  for (const a of admins) {
    try {
      await sendEmail({
        to: a.email,
        subject: `Rate approval needed: ${args.borrowerName}`,
        text:
          `${args.analystEmail} proposed changing the lending rate for ${args.borrowerName} ` +
          `from ${args.oldRate} to ${args.newRate}.\n\nReason: ${args.reason || "(none given)"}\n\n` +
          `Review it here: ${base}/admin/overrides\n\nThis is an automated CrediScout alert.`,
      });
      sent++;
    } catch {
      skipped++;
    }
  }
  return { sent, skipped };
}
