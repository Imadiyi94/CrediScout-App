import Groq from "groq-sdk";

// Single model for all CrediScout AI reasoning (extraction, narrative, chat).
// (llama-3.3-70b-versatile was requested first but Groq decommissioned it;
// gpt-oss-120b is the most capable model on this account as of Oct 2026.)
export const GROQ_MODEL = "openai/gpt-oss-120b";
// Vision delegate for photos only — text models cannot see images.
// NOTE: no vision model is enabled on this account yet; photo extraction
// will fail cleanly until one is added. See Step 3 notes.
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

let client: Groq | null = null;

// Key comes from the GROQ_API_KEY environment variable only — never pasted,
// never logged, never committed (.env is gitignored).
export function getGroq(): Groq {
  if (client) return client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to your local .env (see docs/runbook.md) and restart the server.",
    );
  }
  client = new Groq({ apiKey });
  return client;
}

export async function groqChat(args: {
  system: string;
  user: string;
  jsonMode?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const res = await getGroq().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    ...(args.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    max_tokens: args.maxTokens ?? 1500,
    temperature: 0.2,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

// Photo → JSON fields. Vision reads the image; the prompt forces JSON-only output.
export async function groqVisionExtract(args: {
  mime: string;
  base64: string;
  instruction: string;
}): Promise<string> {
  const res = await getGroq().chat.completions.create({
    model: GROQ_VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: args.instruction },
          { type: "image_url", image_url: { url: `data:${args.mime};base64,${args.base64}` } },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.1,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

// Models don't always obey "JSON only" — pull the first {...} block.
export function extractJsonBlock(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}
