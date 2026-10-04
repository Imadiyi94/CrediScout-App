import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/domain/alert-banner";
import { ExtractButton } from "@/components/ai/extract-button";
import { requireUser } from "@/lib/auth-helpers";
import { getAssessmentForUser } from "@/lib/assessments";
import { DOC_KINDS, DOC_KIND_LABELS, CRITICAL_KINDS, type DocKind } from "@/lib/documents";
import { setDocumentStatus, uploadDocument } from "../../actions";

function statusTone(s: string): "green" | "amber" | "red" | "gray" {
  if (s === "VERIFIED") return "green";
  if (s === "REJECTED") return "red";
  return "amber";
}

function formatSize(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const assessment = await getAssessmentForUser(id, session);
  if (!assessment) notFound();

  const kycOpen = !assessment.borrower.ninVerified || !assessment.borrower.bvnVerified;
  if (kycOpen) {
    return (
      <AppShell section="Assessments">
        <div>
          <p className="text-sm text-slate-500">
            <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Documents
          </p>
          <h1 className="text-2xl font-extrabold text-ink">Stage 3 — Information &amp; Documents</h1>
        </div>
        <AlertBanner
          title="Stage 3 is locked."
          message={`NIN ${assessment.borrower.ninVerified ? "verified ✓" : "NOT verified"} · BVN ${assessment.borrower.bvnVerified ? "verified ✓" : "NOT verified"}. Identity must be confirmed before any document counts.`}
          actionLabel="Go to Stage 2 → verify NIN and BVN, then return here."
          tone="danger"
        />
        <a href={`/assessments/${id}/profile`} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
          Open Stage 2 verification
        </a>
      </AppShell>
    );
  }

  const verifiedCritical = assessment.documents.filter(
    (d) => (CRITICAL_KINDS as string[]).includes(d.kind) && d.verificationStatus === "VERIFIED",
  ).length;

  return (
    <AppShell section="Assessments">
      <div>
        <p className="text-sm text-slate-500">
          <a href={`/assessments/${id}`} className="font-semibold text-primary">{assessment.borrower.displayName}</a> / Documents
        </p>
        <h1 className="text-2xl font-extrabold text-ink">Stage 3 — Information &amp; Documents</h1>
        <p className="mt-1 text-sm text-slate-500">
          Critical verification:{" "}
          <span className="num font-bold text-ink">
            {verifiedCritical} / {CRITICAL_KINDS.length}
          </span>{" "}
          (bank statement · financial statement · identity). Nothing is auto-accepted — every file needs analyst review.
        </p>
      </div>

      {query.error && <AlertBanner title="Upload failed." message={query.error} tone="danger" />}

      <Card>
        <CardHeader>
          <CardTitle>Upload supporting document</CardTitle>
          <CardDescription>PDF, images, CSV/Excel up to 10 MB. Stored in S3-compatible storage.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={uploadDocument.bind(null, id)} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <Field label="Document kind">
              <Select name="kind" defaultValue="bank-statement">
                {DOC_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {DOC_KIND_LABELS[k as DocKind]}
                    {(CRITICAL_KINDS as string[]).includes(k) ? " ★" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="File">
              <Input name="file" type="file" required />
            </Field>
            <Button type="submit">Upload</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submitted documents</CardTitle>
          <CardDescription>Verify or reject each file. ★ = critical for recommendation.</CardDescription>
        </CardHeader>
        <CardContent>
          {assessment.documents.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No documents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs uppercase text-ink">
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2 text-right">Size</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assessment.documents.map((d) => (
                    <tr key={d.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <a href={`/api/documents/${d.id}`} className="font-semibold text-primary">
                          {d.originalName}
                        </a>
                        <ExtractButton documentId={d.id} />
                      </td>
                      <td className="px-3 py-2">
                        {DOC_KIND_LABELS[d.kind as DocKind] ?? d.kind}
                        {(CRITICAL_KINDS as string[]).includes(d.kind) ? " ★" : ""}
                      </td>
                      <td className="px-3 py-2 text-right">{formatSize(d.sizeBytes)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={statusTone(d.verificationStatus)}>{d.verificationStatus}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {d.verificationStatus !== "VERIFIED" && (
                            <form action={setDocumentStatus.bind(null, id)}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="status" value="VERIFIED" />
                              <Button type="submit" variant="success" size="sm">Verify</Button>
                            </form>
                          )}
                          {d.verificationStatus !== "REJECTED" && (
                            <form action={setDocumentStatus.bind(null, id)}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="status" value="REJECTED" />
                              <Button type="submit" variant="dangerGhost" size="sm">Reject</Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
