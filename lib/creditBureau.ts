import type { MockCreditReport } from "@engine/index";

// Bureau mode: MOCK everywhere (laptop + Netlify) until an explicit go-live.
// LIVE only runs from an allow-listed host with real keys (see Step 1 notes).
export type BureauMode = "MOCK" | "LIVE";

export function bureauMode(): BureauMode {
  return process.env.CREDIT_BUREAU_MODE === "LIVE" ? "LIVE" : "MOCK";
}

// Absolute base for internal self-calls (server-to-self needs a full URL,
// which is also why MOCK works unchanged on Netlify).
function appBaseUrl(explicit?: string): string {
  const base =
    explicit ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3005";
  return base.replace(/\/$/, "");
}

export interface BureauReport {
  bvn: string;
  mode: BureauMode;
  firstCentralScore: number;
  crcScore: number;
  averageScore: number;
  providers: string[];
  raw: unknown;
}

// LIVE path (go-live only): real bureau calls + average.
// Endpoint shapes are pinned when live keys/docs arrive — see go-live checklist.
async function fetchLiveReport(bvn: string): Promise<BureauReport> {
  const fcKey = process.env.FIRSTCENTRAL_API_KEY;
  const crcKey = process.env.CRC_API_KEY;
  if (!fcKey || !crcKey) {
    throw new Error(
      "LIVE bureau mode needs FIRSTCENTRAL_API_KEY and CRC_API_KEY. Add them at go-live (env dashboard, never chat).",
    );
  }
  // TODO(go-live): replace with the bureaus' real endpoints + response mapping.
  // Keeping the throw (not guesses) so a misconfigured LIVE can never silently
  // return wrong scores.
  void bvn;
  throw new Error(
    "LIVE bureau endpoints are not pinned yet — complete the go-live checklist first.",
  );
}

// MOCK path: internal self-call, so laptop and Netlify behave identically
// (no external IP whitelisting involved).
async function fetchMockReport(bvn: string, baseUrl?: string): Promise<BureauReport> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) throw new Error("INTERNAL_API_KEY is not configured");
  const res = await fetch(`${appBaseUrl(baseUrl)}/api/mock/credit-bureau/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
    body: JSON.stringify({ bvn }),
  });
  const data = (await res.json().catch(() => null)) as {
    error?: string;
    report?: MockCreditReport & { providers?: string[] };
    firstCentralScore?: number;
    crcScore?: number;
    averageScore?: number;
    providers?: string[];
  } | null;
  if (!res.ok || !data || data.error) {
    throw new Error(`Mock bureau failed: ${data?.error ?? res.statusText}`);
  }
  const report = data.report ?? data;
  const fc = (report as MockCreditReport).firstCentral?.score ?? (report as { firstCentralScore?: number }).firstCentralScore;
  const crc = (report as MockCreditReport).crc?.score ?? (report as { crcScore?: number }).crcScore;
  const avg =
    (report as MockCreditReport).averageScore ?? (report as { averageScore?: number }).averageScore;
  if (typeof fc !== "number" || typeof crc !== "number" || typeof avg !== "number") {
    throw new Error("Mock bureau returned an unexpected shape");
  }
  return {
    bvn,
    mode: "MOCK",
    firstCentralScore: fc,
    crcScore: crc,
    averageScore: avg,
    providers: ["MOCK-FirstCentral", "MOCK-CRC"],
    raw: report,
  };
}

export async function getCreditBureauReport(bvn: string, opts?: { baseUrl?: string }): Promise<BureauReport> {
  const digits = bvn.replace(/\D/g, "");
  if (digits.length !== 11) throw new Error("BVN must be 11 digits");
  if (bureauMode() === "LIVE") return fetchLiveReport(digits);
  return fetchMockReport(digits, opts?.baseUrl);
}
