import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { bureauMode, getCreditBureauReport } from "@/lib/creditBureau";

const bodySchema = z.object({
  assessmentId: z.string().min(1),
  bvn: z.string().optional(),
});

// Pulls the bureau report (MOCK or LIVE per CREDIT_BUREAU_MODE) and saves it
// as a new CreditReport row. Works identically on localhost and Netlify.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Send assessmentId and optional bvn" }, { status: 400 });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: body.assessmentId },
    include: { borrower: true },
  });
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sessionRole(session) !== "ADMIN" && assessment.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bvn = (body.bvn ?? assessment.borrower.bvnNumber ?? "").replace(/\D/g, "");
  if (bvn.length !== 11) {
    return NextResponse.json(
      { error: "No 11-digit BVN available — verify the borrower's BVN in Stage 2 first" },
      { status: 422 },
    );
  }

  let report: Awaited<ReturnType<typeof getCreditBureauReport>>;
  try {
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const host = req.headers.get("host") ?? "localhost:3005";
    report = await getCreditBureauReport(bvn, { baseUrl: `${proto}://${host}` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bureau pull failed" },
      { status: 502 },
    );
  }

  const row = await prisma.creditReport.create({
    data: {
      assessmentId: assessment.id,
      bvn,
      provider: report.providers.join("+"),
      firstCentralScore: Math.round(report.firstCentralScore),
      crcScore: Math.round(report.crcScore),
      averageScore: report.averageScore.toFixed(2),
      fullResponseJson: report.raw as never,
    },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId: assessment.id,
    action: "CREDIT_BUREAU_PULL",
    entityType: "CreditReport",
    entityId: row.id,
    after: { mode: report.mode, averageScore: report.averageScore },
  });

  return NextResponse.json({
    mode: report.mode,
    providers: report.providers,
    firstCentralScore: report.firstCentralScore,
    crcScore: report.crcScore,
    averageScore: report.averageScore,
    checkedAt: row.checkedAt,
  });
}
