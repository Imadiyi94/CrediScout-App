// Outbound SMS via Sendchamp. LIVE-KEY GUARDRAILS (see Step 1):
// sends go ONLY to SMS_TEST_NUMBER (your own phone) unless SMS_ALLOW_ANY=true.
// Set SMS_TEST_NUMBER in .env like 08031234567 or 2348031234567.

function smsConfig() {
  const apiKey = process.env.SENDCHAMP_API_KEY;
  if (!apiKey) throw new Error("SENDCHAMP_API_KEY is not set. Add it to local .env and restart.");
  const sender = process.env.SENDCHAMP_SENDER_ID || "Sendchamp";
  const testNumber = (process.env.SMS_TEST_NUMBER ?? "").replace(/\D/g, "");
  if (!testNumber) {
    throw new Error("SMS_TEST_NUMBER is not set. Put your own number in .env — test SMS go only to you.");
  }
  return { apiKey, sender, testNumber };
}

// 0803… → 234803… ; 234803… unchanged.
export function toInternational(msisdn: string): string {
  const d = msisdn.replace(/\D/g, "");
  if (/^234\d{10}$/.test(d)) return d;
  if (/^0\d{10}$/.test(d)) return `234${d.slice(1)}`;
  throw new Error("Phone number must look like 08031234567 or 2348031234567");
}

export interface SendSmsArgs {
  to: string;
  message: string;
}

// Returns Sendchamp's message id. Refuses non-allow-list numbers unless explicitly opened.
export async function sendSms(args: SendSmsArgs): Promise<{ id: string }> {
  const { apiKey, sender, testNumber } = smsConfig();
  const dest = toInternational(args.to);
  const allowed = process.env.SMS_ALLOW_ANY === "true" || dest === toInternational(testNumber);
  if (!allowed) {
    throw new Error(
      "SMS guard: this number is not the configured test number. Set SMS_ALLOW_ANY=true to open up (live billing applies).",
    );
  }
  if (!args.message.trim()) throw new Error("SMS message is empty");
  const res = await fetch("https://api.sendchamp.com/api/v1/sms/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender_name: sender,
      to: [dest],
      message: args.message.slice(0, 1000),
      route: "dnd",
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    message?: string;
    data?: { id?: string };
  } | null;
  if (!res.ok) {
    throw new Error(`Sendchamp failed: ${data?.message ?? res.statusText}`);
  }
  return { id: String(data?.data?.id ?? "") };
}
