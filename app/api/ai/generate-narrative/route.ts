import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { getSummaryData } from "@/lib/summary-data";
import { GROQ_MODEL, groqChat } from "@/lib/groq";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { assessmentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON with assessmentId" }, { status: 400 });
  }
  if (!body.assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: body.assessmentId },
    select: { analystId: true },
  });
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sessionRole(session) !== "ADMIN" && assessment.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const d = await getSummaryData(body.assessmentId);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const facts = [
    `Borrower: ${d.borrowerName} (${d.borrowerType}, ${d.clientStatus}${d.clientVerified ? ", verified" : ", UNVERIFIED"})`,
    `Product: ${d.product}; status: ${d.status}`,
    d.financials
      ? `Financials (monthly): revenue ${d.financials.revenue}, opex ${d.financials.opex}, net ${d.financials.net}, cash flow ${d.financials.cashFlow}, existing service ${d.financials.existingService}, proposed service ${d.financials.proposedService}, DTI ${d.financials.dti ?? "n/a"}, DSCR ${d.financials.dscr ?? "n/a"}. Policy: DTI ≤ 50%, DSCR ≥ 1.20×.`
      : "No financial snapshot on file.",
    d.credit
      ? `Credit: grade ${d.credit.grade ?? "n/a"}, exposure ${d.credit.exposure}, utilisation ${d.credit.utilization ?? "n/a"}, guarantor ${d.credit.guarantor}. Flags: ${d.credit.flags.map((f) => `[${f.severity}] ${f.title}`).join("; ") || "none"}.`
      : "No credit profile on file.",
    d.qualitative
      ? `Qualitative score ${d.qualitative.score ?? "n/a"}${d.qualitative.band ? ` (${d.qualitative.band})` : ""}; watch: ${d.qualitative.weakest.join("; ") || "none"}.`
      : "No qualitative scorecard on file.",
    d.collaterals.length > 0
      ? `Security coverage ${d.coveragePct ?? "n/a"}: ${d.collaterals.map((c) => `${c.type} ${c.value} (LTV ${c.ltv ?? "n/a"}, docs ${c.docs})`).join("; ")}.`
      : "No security on file.",
    d.recommendation
      ? `Current recommendation: ${d.recommendation.decision} ${d.recommendation.amount} × ${d.recommendation.tenor} months at ${d.recommendation.rate} (${d.recommendation.rateBasis}); instalment ${d.recommendation.instalment}; EAR ${d.recommendation.ear ?? "n/a"}%.`
      : "No recommendation confirmed yet.",
    `Strengths: ${d.strengths.join("; ") || "none recorded"}. Mitigations: ${d.mitigations.join("; ") || "none recorded"}.`,
  ].join("\n");

  let narrative: string;
  try {
    narrative = await groqChat({
      system:
        "You are a senior Nigerian credit analyst writing for a credit committee. " +
        "Factual, neutral tone. Never invent figures — use only the facts given. " +
        "Flag unverified items explicitly.",
      user:
        "Write EXACTLY three paragraphs (no headings, no bullet points):\n" +
        "Paragraph 1 — repayment capacity verdict from the financial facts.\n" +
        "Paragraph 2 — the key credit risks and what mitigates each.\n" +
        "Paragraph 3 — the lending direction the facts support (approve / reduce / decline / refer) and the conditions that must hold.\n\n" +
        `ASSESSMENT FACTS:\n${facts}`,
      maxTokens: 900,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI narrative failed";
    return NextResponse.json({ error: `AI narrative failed: ${message}` }, { status: 502 });
  }

  await logAudit({
    actorId: session.user.id,
    assessmentId: body.assessmentId,
    action: "AI_NARRATIVE",
    entityType: "Assessment",
    entityId: body.assessmentId,
  });

  return NextResponse.json({
    assessmentId: body.assessmentId,
    model: GROQ_MODEL,
    narrative,
    note: "AI draft — the analyst owns the final wording.",
  });
}
