import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { getDocument } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { assessment: { select: { analystId: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sessionRole(session) !== "ADMIN" && doc.assessment.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = await getDocument(doc.fileKey);
  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "Content-Disposition": `inline; filename="${doc.originalName.replace(/"/g, "")}"`,
  };
  if (file.size !== undefined) headers["Content-Length"] = String(file.size);
  return new Response(file.stream, { headers });
}
