import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { disburseLoan } from "@/lib/disbursements";

const disburseSchema = z.object({
  assessmentId: z.string().min(1),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
  bankCode: z.string().min(2, "Bank is required").max(10),
});

// Admin-only. Pays the RECOMMENDED amount and only for APPROVE / REDUCED.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (sessionRole(session) !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can disburse loans" }, { status: 403 });
  }

  let parsed: z.infer<typeof disburseSchema>;
  try {
    parsed = disburseSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Send assessmentId, a 10-digit accountNumber, and bankCode" },
      { status: 400 },
    );
  }

  const out = await disburseLoan({ ...parsed, adminId: session.user.id });
  if (!out.ok) {
    return NextResponse.json(
      out.reference ? { error: out.error, reference: out.reference } : { error: out.error },
      { status: out.status },
    );
  }
  return NextResponse.json({
    reference: out.reference,
    transferCode: out.transferCode,
    status: out.status,
    amountKobo: out.amountKobo.toString(),
    accountName: out.accountName,
  });
}
