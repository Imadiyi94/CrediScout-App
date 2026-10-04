import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { verifyFace } from "@/lib/dojah";
import { resolveBorrower } from "../_auth";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function toBase64(file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name || "Image"} must be a non-empty file under 4 MB`);
  }
  if (!file.type.startsWith("image/")) throw new Error(`${file.name || "File"} is not an image`);
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString("base64");
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const assessmentId = String(form?.get("assessmentId") ?? "");
  if (!assessmentId) return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });

  const ctx = await resolveBorrower(assessmentId);
  if ("error" in ctx) return ctx.error;

  const selfie = form?.get("selfie");
  const idPhoto = form?.get("idPhoto");
  if (!(selfie instanceof File) || !(idPhoto instanceof File)) {
    return NextResponse.json({ error: "Upload both a selfie and an ID photo" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof verifyFace>>;
  try {
    result = await verifyFace({
      selfieBase64: await toBase64(selfie),
      idPhotoBase64: await toBase64(idPhoto),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Face check failed" },
      { status: 502 },
    );
  }

  const borrower = await prisma.borrower.update({
    where: { id: ctx.borrower.id },
    data: { faceScore: result.confidence === null ? null : result.confidence.toFixed(2), faceMatch: result.match, kycVerifiedAt: new Date() },
  });
  await logAudit({
    actorId: ctx.session.user.id,
    assessmentId,
    action: "KYC_VERIFY_FACE",
    entityType: "Borrower",
    entityId: borrower.id,
    after: { faceMatch: result.match, faceScore: result.confidence },
  });

  return NextResponse.json({
    match: result.match,
    confidence: result.confidence,
    mode: "sandbox",
    note: result.match ? "Faces match." : "Faces do not match — review manually before proceeding.",
  });
}
