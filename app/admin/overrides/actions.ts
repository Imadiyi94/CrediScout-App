"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export async function decideRateOverride(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const approve = String(formData.get("approve") ?? "") === "yes";

  const ov = await prisma.recommendationOverride.findUnique({
    where: { id },
    include: { recommendation: true },
  });
  if (!ov || ov.field !== "RATE" || ov.status !== "PENDING") {
    redirect("/admin/overrides?error=Override+not+found+or+already+decided");
  }

  const match = /^([0-9]+(\.[0-9]{1,3})?)%/.exec(ov.newValue ?? "");
  if (approve && !match) redirect("/admin/overrides?error=Unparseable+rate+value");

  if (approve) {
    const updated = await prisma.recommendation.update({
      where: { id: ov.recommendationId },
      data: { ratePctMonthly: match![1], rateBasis: `${ov.recommendation.rateBasis} · admin-approved ${match![1]}%` },
    });
    // Rebuild the schedule at the approved rate.
    const { rbSchedule, flatSchedule, scheduleEAR } = await import("@engine/index");
    const build = updated.rateType === "RB" ? rbSchedule : flatSchedule;
    const schedule = build({
      principalKobo: updated.recommendedAmountKobo,
      monthlyRatePct: Number(match![1]),
      tenorMonths: updated.recommendedTenorMonths,
      frequency: "MONTHLY",
    });
    await prisma.recommendation.update({
      where: { id: ov.recommendationId },
      data: {
        installmentKobo: schedule.instalmentKobo,
        totalInterestKobo: schedule.totalInterestKobo,
        effectiveAnnualRatePct: (Math.round(scheduleEAR(schedule) * 100) / 100).toFixed(4),
      },
    });
    await prisma.financialSnapshot.update({
      where: { assessmentId: updated.assessmentId },
      data: { proposedDebtServiceKobo: schedule.instalmentKobo },
    });
  }

  const after = await prisma.recommendationOverride.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", approvedByAdmin: session.user.id },
  });
  await logAudit({
    actorId: session.user.id,
    action: approve ? "RATE_OVERRIDE_APPROVE" : "RATE_OVERRIDE_REJECT",
    entityType: "RecommendationOverride",
    entityId: id,
    before: { status: "PENDING" },
    after,
  });
  revalidatePath("/admin/overrides");
}
