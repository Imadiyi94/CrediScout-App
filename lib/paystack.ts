// Paystack transfers for loan disbursement. Amounts are ALWAYS kobo (bigint)
// because Paystack's API takes the lowest denomination — never naira here.

const BASE = "https://api.paystack.co";

function getKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Add your test key to local .env (see docs/runbook.md) and restart.",
    );
  }
  if (key.startsWith("sk_live_")) {
    throw new Error(
      "Refusing to run with a LIVE Paystack key in this build. Disbursement is test-mode only until the explicit go-live step.",
    );
  }
  return key;
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${getKey()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || data.status !== true) {
    throw new Error(`Paystack ${path} failed: ${data.message ?? res.statusText}`);
  }
  return data.data;
}

export interface Bank { name: string; code: string }

let bankCache: { at: number; banks: Bank[] } | null = null;

// Nigerian bank list for the recipient form (cached 24h).
export async function listBanks(): Promise<Bank[]> {
  if (bankCache && Date.now() - bankCache.at < 24 * 3600 * 1000) return bankCache.banks;
  const data = await paystackFetch<{ name: string; code: string }[]>("/bank?country=nigeria&perPage=100");
  bankCache = { at: Date.now(), banks: data.map((b) => ({ name: b.name, code: b.code })) };
  return bankCache.banks;
}

// Confirm an account number belongs to the borrower BEFORE creating a recipient.
export async function resolveAccountNumber(args: {
  accountNumber: string;
  bankCode: string;
}): Promise<{ accountNumber: string; accountName: string }> {
  if (!/^\d{10}$/.test(args.accountNumber)) throw new Error("Account number must be 10 digits");
  return paystackFetch<{ account_number: string; account_name: string }>(
    `/bank/resolve?account_number=${args.accountNumber}&bank_code=${args.bankCode}`,
  ).then((d) => ({ accountNumber: d.account_number, accountName: d.account_name }));
}

// One recipient per borrower bank account. Returns the reusable recipient code.
export async function createRecipient(args: {
  accountNumber: string;
  bankCode: string;
  name: string;
}): Promise<{ recipientCode: string; accountName: string }> {
  const data = await paystackFetch<{ recipient_code: string; details: { account_name: string } }>(
    "/transferrecipient",
    {
      method: "POST",
      body: JSON.stringify({
        type: "nuban",
        name: args.name,
        account_number: args.accountNumber,
        bank_code: args.bankCode,
        currency: "NGN",
      }),
    },
  );
  return { recipientCode: data.recipient_code, accountName: data.details.account_name };
}

export interface TransferResult {
  transferCode: string;
  reference: string;
  status: string;
}

// amountKobo: integer kobo (e.g. ₦2,400,000 = 240000000n). reference must be unique.
export async function initiateTransfer(args: {
  amountKobo: bigint;
  recipientCode: string;
  reason: string;
  reference: string;
}): Promise<TransferResult> {
  if (args.amountKobo <= 0n) throw new Error("Transfer amount must be above zero kobo");
  if (!args.reference.trim()) throw new Error("Transfer reference is required");
  const data = await paystackFetch<{ transfer_code: string; reference: string; status: string }>(
    "/transfer",
    {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: Number(args.amountKobo),
        recipient: args.recipientCode,
        reason: args.reason.slice(0, 100),
        reference: args.reference,
      }),
    },
  );
  return { transferCode: data.transfer_code, reference: data.reference, status: data.status };
}

// Poll/confirm a transfer's latest status by our reference.
export async function verifyTransfer(reference: string): Promise<{ status: string; transferCode: string }> {
  const data = await paystackFetch<{ status: string; transfer_code: string }>(
    `/transfer/${encodeURIComponent(reference)}`,
  );
  return { status: data.status, transferCode: data.transfer_code };
}

// Unique reference per disbursement attempt: CS-<assessment8>-<timestamp>-<rand>.
export function generateReference(assessmentId: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CS-${assessmentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}${rand}`;
}
