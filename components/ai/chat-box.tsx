"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Why was this loan approved, reduced, or declined?",
  "What is the biggest risk in this assessment?",
  "Can the borrower afford a larger amount?",
];

export function ChatBox({ assessmentId }: { assessmentId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setDraft("");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          question: q,
          history: next.slice(-10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      setMessages([...next, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-ink hover:border-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-white"
                  : "mr-8 rounded-lg bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
              }
            >
              {m.content}
            </div>
          ))}
          {busy && <p className="text-[13px] text-slate-500">CrediScout AI is thinking…</p>}
        </div>
      )}
      {error && <p className="text-[13px] text-red-700">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex gap-2"
      >
        <div className="flex-1">
          <Field label="Ask CrediScout AI">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder='e.g. Why was this loan declined?'
            />
          </Field>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy || !draft.trim()}>
            Ask
          </Button>
        </div>
      </form>
      <p className="text-xs text-slate-500">Answers come only from this assessment&apos;s facts and figures.</p>
    </div>
  );
}
