import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { getSummaryData } from "@/lib/summary-data";
import { GROQ_MODEL, groqChat } from "@/lib/groq";

const chatSchema = z.object({
  assessmentId: z.string().min(1),
  question: z.string().trim().min(2, "Ask a question").max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(10)
    .default([]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof chatSchema>;
  try {
    parsed = chatSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Send assessmentId, question, and optional history" }, { status: 400 });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: parsed.assessmentId },
    select: { analystId: true },
  });
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sessionRole(session) !== "ADMIN" && assessment.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const d = await getSummaryData(parsed.assessmentId);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const facts = [
    `Borrower: ${d.borrowerName} (${d.borrowerType}, ${d.clientStatus}${d.clientVerified ? ", verified" : ", UNVERIFIED"}); product: ${d.product}; status: ${d.status}.`,
    d.financials
      ? `Monthly: revenue ${d.financials.revenue}, opex ${d.financials.opex}, net ${d.financials.net}, cash flow ${d.financials.cashFlow}, existing service ${d.financials.existingService}, proposed service ${d.financials.proposedService}, DTI ${d.financials.dti ?? "n/a"} (cap 50%), DSCR ${d.financials.dscr ?? "n/a"} (floor 1.20×).`
      : "No financial snapshot.",
    d.credit
      ? `Credit grade ${d.credit.grade ?? "n/a"}, exposure ${d.credit.exposure}, flags: ${d.credit.flags.map((f) => `[${f.severity}] ${f.title}: ${f.why}`).join("; ") || "none"}.`
      : "No credit profile.",
    d.qualitative
      ? `Qualitative ${d.qualitative.score ?? "n/a"}${d.qualitative.band ? ` (${d.qualitative.band})` : ""}; watch: ${d.qualitative.weakest.join("; ") || "none"}.`
      : "No scorecard.",
    d.collaterals.length > 0
      ? `Coverage ${d.coveragePct ?? "n/a"}: ${d.collaterals.map((c) => `${c.type} ${c.value}, LTV ${c.ltv ?? "n/a"}`).join("; ")}.`
      : "No security.",
    d.recommendation
      ? `Decision: ${d.recommendation.decision} ${d.recommendation.amount} × ${d.recommendation.tenor}mo at ${d.recommendation.rate} (${d.recommendation.rateBasis}); instalment ${d.recommendation.instalment}; EAR ${d.recommendation.ear ?? "n/a"}%. Basis: ${d.recommendation.reasons} Conditions: ${d.recommendation.conditions ?? "none"}.`
      : "No recommendation confirmed yet.",
  ].join("\n");

  const historyText = parsed.history
    .map((t) => `${t.role === "user" ? "Analyst" : "CrediScout AI"}: ${t.content}`)
    .join("\n");

  let answer: string;
  try {
    answer = await groqChat({
      system:
        "You are CrediScout AI, answering a credit analyst's questions about ONE specific loan assessment. " +
        "Answer ONLY from the assessment facts below, citing figures. " +
        "If the facts do not contain the answer, say so plainly — never invent. " +
        "Keep answers under 150 words unless detail is requested. " +
        "If asked about anything unrelated to this assessment, decline in one sentence.",
      user:
        `ASSESSMENT FACTS:\n${facts}\n\n` +
        (historyText ? `CONVERSATION SO FAR:\n${historyText}\n\n` : "") +
        `ANALYST'S QUESTION: ${parsed.question}`,
      maxTokens: 600,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI chat failed";
    return NextResponse.json({ error: `AI chat failed: ${message}` }, { status: 502 });
  }

  await logAudit({
    actorId: session.user.id,
    assessmentId: parsed.assessmentId,
    action: "AI_CHAT",
    entityType: "Assessment",
    entityId: parsed.assessmentId,
    after: { question: parsed.question.slice(0, 280) },
  });

  return NextResponse.json({ assessmentId: parsed.assessmentId, model: GROQ_MODEL, answer });
}
