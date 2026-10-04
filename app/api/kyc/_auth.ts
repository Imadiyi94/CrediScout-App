import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";

// Shared: loads the assessment's borrower after owner/admin check.
export async function resolveBorrower(assessmentId: string) {
  const session = await getSession();
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, analystId: true, borrowerId: true },
  });
  if (!assessment) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (sessionRole(session) !== "ADMIN" && assessment.analystId !== session.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const borrower = await prisma.borrower.findUniqueOrThrow({ where: { id: assessment.borrowerId } });
  return { session, assessment, borrower };
}
