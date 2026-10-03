import { prisma } from "./db";

export async function logAudit(a: {
  actorId: string;
  assessmentId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}) {
  await prisma.auditEvent.create({
    data: {
      actorId: a.actorId,
      assessmentId: a.assessmentId,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      beforeJson: (a.before ?? null) as never,
      afterJson: (a.after ?? null) as never,
      reason: a.reason,
    },
  });
}
