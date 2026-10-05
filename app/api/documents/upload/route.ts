import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { storageInfo, uploadFile } from "@/lib/storage";
import { ALLOWED_MIME_PREFIXES, DOC_KINDS, MAX_UPLOAD_BYTES } from "@/lib/documents";

// Multipart upload: assessmentId, kind, file. Same rules as the Stage 3 form.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const assessmentId = String(form?.get("assessmentId") ?? "");
  const kind = String(form?.get("kind") ?? "");
  const file = form?.get("file");
  if (!assessmentId) return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  if (!(DOC_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Unknown document kind" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB" }, { status: 413 });
  }

  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sessionRole(session) !== "ADMIN" && assessment.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mime = file.type || "application/octet-stream";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const key = `assessments/${assessmentId}/${randomUUID()}-${safeName}`;
  await uploadFile(key, Buffer.from(await file.arrayBuffer()), mime);

  const info = storageInfo();
  const doc = await prisma.document.create({
    data: {
      assessmentId,
      kind,
      fileKey: key,
      originalName: file.name.slice(0, 200),
      mimeType: mime,
      sizeBytes: file.size,
      storageMode: info.mode,
      bucket: info.bucket,
    },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId,
    action: "DOCUMENT_UPLOAD",
    entityType: "Document",
    entityId: doc.id,
    after: { kind, originalName: doc.originalName, storageMode: info.mode },
  });

  return NextResponse.json(
    { id: doc.id, name: doc.originalName, size: doc.sizeBytes, storageMode: info.mode, bucket: info.bucket },
    { status: 201 },
  );
}
