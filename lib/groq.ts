import Groq from "groq-sdk";

// Single model for all CrediScout AI features (extraction, narrative, chat).
export const GROQ_MODEL = "llama-3.3-70b-versatile";

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
