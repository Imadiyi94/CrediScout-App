import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { getDocument } from "@/lib/storage";
import { GROQ_MODEL, GROQ_VISION_MODEL, extractJsonBlock, groqChat, groqVisionExtract } from "@/lib/groq";

const MAX_AI_BYTES = 4 * 1024 * 1024;

const KIND_INSTRUCTIONS: Record<string, string> = {
  "bank-statement":
    "Extract: accountName, accountNumber, bankName, statementPeriodStart, statementPeriodEnd, totalCredits, totalDebits, closingBalance, averageMonthlyCredit, transactionCount. Money as plain numbers in naira (no ₦, no commas). Dates as YYYY-MM-DD. Unknown fields must be null.",
  "financial-statement":
    "Extract: businessName, periodStart, periodEnd, revenue, operatingExpenses, netIncome, totalAssets, totalLiabilities. Money as plain numbers in naira (no ₦, no commas). Unknown fields must be null.",
  payslip:
    "Extract: employerName, employeeName, payDate (YYYY-MM-DD), grossPay, netPay, deductions. Money as plain numbers in naira. Unknown fields must be null.",
  identity:
    "Extract: fullName, idType (e.g. NIN slip, voter's card, driver's licence, international passport), idNumber, dateOfBirth (YYYY-MM-DD or null). Unknown fields must be null.",
};

const DEFAULT_INSTRUCTION =
  "Extract the key facts as flat key/value pairs (strings or numbers only, no nesting deeper than one level). Money as plain numbers in naira. Unknown fields must be null.";

function isTextish(mime: string) {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/csv" ||
    mime === "text/csv"
  );
}

function isImage(mime: string) {
  return mime.startsWith("image/");
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { documentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON with documentId" }, { status: 400 });
  }
  if (!body.documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({
    where: { id: body.documentId },
    include: { assessment: { select: { analystId: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sessionRole(session) !== "ADMIN" && doc.assessment.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = await getDocument(doc.fileKey);
  const chunks: Buffer[] = [];
  const reader = file.stream.getReader();
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += (value as Uint8Array).byteLength;
    if (size > MAX_AI_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 4 MB AI limit — upload a smaller photo or excerpt" },
        { status: 413 },
      );
    }
    chunks.push(Buffer.from(value as Uint8Array));
  }
  const buffer = Buffer.concat(chunks);
  const mime = doc.mimeType || file.contentType;

  const instruction = `${KIND_INSTRUCTIONS[doc.kind] ?? DEFAULT_INSTRUCTION} Return ONLY a single JSON object, no prose, no markdown fences.`;
  let fields: unknown;
  let model: string;
  try {
    if (isTextish(mime)) {
      model = GROQ_MODEL;
      const text = buffer.toString("utf-8").slice(0, 60_000);
      const out = await groqChat({
        system: "You extract document fields for a Nigerian credit analyst. Precision over guessing.",
        user: `${instruction}\n\nDOCUMENT (${doc.originalName}):\n${text}`,
        jsonMode: true,
      });
      fields = extractJsonBlock(out);
    } else if (isImage(mime)) {
      model = GROQ_VISION_MODEL;
      const out = await groqVisionExtract({
        mime,
        base64: buffer.toString("base64"),
        instruction: `You read a photographed document for a Nigerian credit analyst. ${instruction}`,
      });
      fields = extractJsonBlock(out);
    } else {
      return NextResponse.json(
        {
          error:
            "AI extraction supports photos (JPG/PNG) and text files (TXT/CSV/JSON) for now. For PDFs or Excel, upload a clear photo/screenshot of the key page instead.",
        },
        { status: 422 },
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI extraction failed";
    return NextResponse.json({ error: `AI extraction failed: ${message}` }, { status: 502 });
  }

  // Persist as UNVERIFIED extraction — the analyst must still Verify the document.
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { extractedJson: { aiModel: model, extractedAt: new Date().toISOString(), fields } as never },
  });
  await logAudit({
    actorId: session.user.id,
    assessmentId: doc.assessmentId,
    action: "DOCUMENT_AI_EXTRACT",
    entityType: "Document",
    entityId: doc.id,
    after: { model, kind: doc.kind },
  });

  return NextResponse.json({
    documentId: updated.id,
    kind: doc.kind,
    model,
    fields,
    verificationStatus: updated.verificationStatus,
    note: "AI output is a draft — verify the document before it counts in the assessment.",
  });
}
