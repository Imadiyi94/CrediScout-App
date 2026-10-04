import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { verifyNin } from "@/lib/dojah";
import { resolveBorrower } from "../_auth";

const bodySchema = z.object({
  assessmentId: z.string().min(1),
  nin: z.string().regex(/^\d{11}$/, "NIN must be 11 digits"),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Send assessmentId and an 11-digit nin" }, { status: 400 });
  }

  const ctx = await resolveBorrower(body.assessmentId);
  if ("error" in ctx) return ctx.error;

  let result: Awaited<ReturnType<typeof verifyNin>>;
  try {
    result = await verifyNin(body.nin);
  } catch (e) {
    const message = e instanceof Error ? e.message : "NIN check failed";
    const status = /404|no record/i.test(message) ? 422 : 502;
    return NextResponse.json({ error: status === 422 ? "No NIMC record found for this NIN" : `NIN check failed: ${message}` }, { status });
  }

  const borrower = await prisma.borrower.update({
    where: { id: ctx.borrower.id },
    data: {
      ninNumber: body.nin,
      ninVerified: true,
      ninName: result.fullName,
      kycVerifiedAt: new Date(),
    },
  });
  await logAudit({
    actorId: ctx.session.user.id,
    assessmentId: body.assessmentId,
    action: "KYC_VERIFY_NIN",
    entityType: "Borrower",
    entityId: borrower.id,
    after: { ninVerified: true, ninName: result.fullName },
  });

  return NextResponse.json({
    verified: true,
    nin: body.nin,
    name: result.fullName,
    dateOfBirth: result.dateOfBirth,
    mode: "sandbox",
  });
}
