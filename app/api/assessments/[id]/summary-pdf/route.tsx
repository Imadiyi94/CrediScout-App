import { renderToBuffer } from "@react-pdf/renderer";
import { getSession, sessionRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getSummaryData } from "@/lib/summary-data";
import { SummaryPdf } from "@/lib/summary-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: { analystId: true, borrower: { select: { displayName: true } } },
  });
  if (!assessment) return Response.json({ error: "Not found" }, { status: 404 });
  if (sessionRole(session) !== "ADMIN" && assessment.analystId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getSummaryData(id);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderToBuffer(<SummaryPdf d={data} />);
  const filename = `CrediScout-${assessment.borrower.displayName.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40)}-${id.slice(0, 8)}.pdf`;
  const body = new Uint8Array(buffer);
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(body.byteLength),
    },
  });
}
