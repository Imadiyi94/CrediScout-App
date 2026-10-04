import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { verifyBvn } from "@/lib/dojah";
import { resolveBorrower } from "../_auth";

const bodySchema = z.object({
  assessmentId: z.string().min(1),
  bvn: z.string().regex(/^\d{11}$/, "BVN must be 11 digits"),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Send assessmentId and an 11-digit bvn" }, { status: 400 });
  }

  const ctx = await resolveBorrower(body.assessmentId);
  if ("error" in ctx) return ctx.error;

  let result: Awaited<ReturnType<typeof verifyBvn>>;
  try {
    result = await verifyBvn(body.bvn);
  } catch (e) {
    const message = e instanceof Error ? e.message : "BVN check failed";
    const status = /404|no record/i.test(message) ? 422 : 502;
    return NextResponse.json({ error: status === 422 ? "No record found for this BVN" : `BVN check failed: ${message}` }, { status });
  }

  const borrower = await prisma.borrower.update({
    where: { id: ctx.borrower.id },
    data: {
      bvnNumber: body.bvn,
      bvnVerified: true,
      bvnName: result.fullName,
      kycVerifiedAt: new Date(),
    },
  });
  await logAudit({
    actorId: ctx.session.user.id,
    assessmentId: body.assessmentId,
    action: "KYC_VERIFY_BVN",
    entityType: "Borrower",
    entityId: borrower.id,
    after: { bvnVerified: true, bvnName: result.fullName },
  });

  return NextResponse.json({
    verified: true,
    bvn: body.bvn,
    name: result.fullName,
    enrollmentBank: result.enrollmentBank,
    mode: "sandbox",
  });
}
