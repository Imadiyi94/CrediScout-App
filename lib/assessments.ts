import { prisma } from "./db";
import { sessionRole, type getSession } from "./auth-helpers";
import type { StageStatus } from "./stages";

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

// Owner (analyst) or any admin. Returns null when access is denied.
export async function getAssessmentForUser(id: string, session: Session) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      borrower: true,
      documents: { orderBy: { createdAt: "desc" } },
      alerts: { where: { resolvedAt: null } },
      recommendation: true,
    },
  });
  if (!assessment) return null;
  if (sessionRole(session) === "ADMIN") return assessment;
  if (assessment.analystId !== session.user.id) return null;
  return assessment;
}

export type AccessibleAssessment = NonNullable<Awaited<ReturnType<typeof getAssessmentForUser>>>;

// Stepper states derived from currentStage; docs attention when critical docs unverified.
export function stageStatesFor(
  currentStage: number,
  verifiedCritical: number,
  totalCritical: number,
): StageStatus[] {
  return Array.from({ length: 11 }, (_, i) => {
    const stage = i + 1;
    if (stage < currentStage) return "complete";
    if (stage === currentStage) {
      if (stage === 3 && totalCritical > 0 && verifiedCritical < totalCritical) return "attention";
      return "active";
    }
    return "todo";
  });
}
