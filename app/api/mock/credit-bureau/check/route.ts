import { NextResponse } from "next/server";
import { z } from "zod";
import { mockCreditCheck } from "@engine/index";

// Internal self-call target for the MOCK bureau path (no session travels
// server-to-server, so a shared internal key guards it instead).
// Set INTERNAL_API_KEY in .env locally and in Netlify env at deploy.
const bodySchema = z.object({ bvn: z.string().min(1) });

export async function POST(req: Request) {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) {
    return NextResponse.json({ error: "INTERNAL_API_KEY is not configured" }, { status: 500 });
  }
  if (req.headers.get("x-internal-key") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let bvn = "";
  try {
    bvn = bodySchema.parse(await req.json()).bvn;
  } catch {
    return NextResponse.json({ error: "Send bvn" }, { status: 400 });
  }

  try {
    const report = mockCreditCheck(bvn);
    return NextResponse.json({
      report: {
        ...report,
        providers: [report.firstCentral.provider, report.crc.provider],
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mock check failed" },
      { status: 422 },
    );
  }
}
