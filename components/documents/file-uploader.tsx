"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { DOC_KINDS, DOC_KIND_LABELS, CRITICAL_KINDS, type DocKind } from "@/lib/documents";

export function FileUploader({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<string>("bank-statement");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file first");
      return;
    }
    setError(null);
    setDone(null);
    setProgress(0);
    const form = new FormData();
    form.append("assessmentId", assessmentId);
    form.append("kind", kind);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 201) {
          setDone(`${data.name} uploaded (${data.storageMode})`);
          setFile(null);
          const input = document.getElementById(`file-input-${assessmentId}`) as HTMLInputElement | null;
          if (input) input.value = "";
          router.refresh();
        } else {
          setError(data.error ?? `Upload failed (${xhr.status})`);
        }
      } catch {
        setError(`Upload failed (${xhr.status})`);
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Network error during upload");
    };
    xhr.send(form);
  }

  return (
    <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
      <Field label="Document kind">
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          {DOC_KINDS.map((k) => (
            <option key={k} value={k}>
              {DOC_KIND_LABELS[k as DocKind]}
              {(CRITICAL_KINDS as string[]).includes(k) ? " ★" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="File (PDF, images, CSV/Excel — max 10 MB)">
        <Input
          id={`file-input-${assessmentId}`}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Button type="submit" disabled={progress !== null}>
        {progress !== null ? `Uploading ${progress}%…` : "Upload"}
      </Button>
      {progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 sm:col-span-3">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="text-[13px] text-red-700 sm:col-span-3">{error}</p>}
      {done && <p className="text-[13px] text-green-800 sm:col-span-3">✓ {done}</p>}
    </form>
  );
}
