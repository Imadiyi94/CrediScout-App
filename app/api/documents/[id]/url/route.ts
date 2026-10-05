import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { getFileUrl } from "@/lib/storage";

// Short-lived (15 min) direct download link. Prefer the ownership-checked
// streaming route for in-app downloads; use this for sharing/export flows.
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

  try {
    const url = await getFileUrl(doc.fileKey, 900);
    return NextResponse.json({ url, expiresInSeconds: 900, name: doc.originalName });
  } catch {
    return NextResponse.json({ error: "Could not sign download link" }, { status: 502 });
  }
}
