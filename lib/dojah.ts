// Dojah identity verification: NIN, BVN, and selfie-vs-ID face match.
// Sandbox (https://sandbox.dojah.io) by default — free mock data.
// Production only with DOJAH_ALLOW_LIVE=true + DOJAH_BASE_URL=https://api.dojah.io.

const SANDBOX_BASE = "https://sandbox.dojah.io";
const PROD_BASE = "https://api.dojah.io";

function base(): string {
  const override = process.env.DOJAH_BASE_URL;
  const url = override || SANDBOX_BASE;
  if (url === PROD_BASE && process.env.DOJAH_ALLOW_LIVE !== "true") {
    throw new Error(
      "Refusing production Dojah calls. Confirm go-live first, then set DOJAH_ALLOW_LIVE=true.",
    );
  }
  return url;
}

function config(): { appId: string; secret: string } {
  const appId = process.env.DOJAH_APP_ID;
  const secret = process.env.DOJAH_SECRET_KEY;
  if (!appId || !secret) {
    throw new Error(
      "DOJAH_APP_ID / DOJAH_SECRET_KEY are not set. Add sandbox keys to local .env and restart.",
    );
  }
  return { appId, secret };
}

export function dojahMode(): "sandbox" | "live" {
  return base() === PROD_BASE ? "live" : "sandbox";
}

async function dojahFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { appId, secret } = config();
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { AppId: appId, Authorization: secret, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as {
    entity?: T;
    data?: T;
    message?: string;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(`Dojah ${path} failed (${res.status}): ${data?.message ?? data?.error ?? res.statusText}`);
  }
  return (data?.entity ?? data?.data ?? data) as T;
}

function digitsOnly(v: string, len: number, label: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length !== len) throw new Error(`${label} must be ${len} digits`);
  return d;
}

export interface NinResult {
  verified: boolean;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  photoBase64: string | null;
}

// Basic NIN lookup (sandbox test value: 70123456789).
export async function verifyNin(nin: string): Promise<NinResult> {
  const clean = digitsOnly(nin, 11, "NIN");
  const e = await dojahFetch<Record<string, unknown>>(`/api/v1/kyc/nin?nin=${clean}`);
  const first = (e.first_name ?? null) as string | null;
  const last = (e.last_name ?? null) as string | null;
  const middle = (e.middle_name ?? null) as string | null;
  const full = [first, middle, last].filter(Boolean).join(" ") || null;
  return {
    verified: true,
    fullName: full,
    firstName: first,
    lastName: last,
    dateOfBirth: (e.date_of_birth ?? null) as string | null,
    phone: (e.phone_number ?? null) as string | null,
    photoBase64: (e.photo ?? null) as string | null,
  };
}

export interface BvnResult {
  verified: boolean;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  enrollmentBank: string | null;
  photoBase64: string | null;
}

// BVN full lookup (sandbox test value: 22222222222).
export async function verifyBvn(bvn: string): Promise<BvnResult> {
  const clean = digitsOnly(bvn, 11, "BVN");
  const e = await dojahFetch<Record<string, unknown>>(`/api/v1/kyc/bvn/full?bvn=${clean}`);
  const first = (e.first_name ?? null) as string | null;
  const last = (e.last_name ?? null) as string | null;
  const middle = (e.middle_name ?? null) as string | null;
  const full = [first, middle, last].filter(Boolean).join(" ") || null;
  return {
    verified: true,
    fullName: full,
    firstName: first,
    lastName: last,
    dateOfBirth: (e.date_of_birth ?? null) as string | null,
    phone: ((e.phone_number1 ?? e.phone_number2 ?? null) as string | null),
    enrollmentBank: (e.enrollment_bank ?? null) as string | null,
    photoBase64: (e.image ?? null) as string | null,
  };
}

export interface FaceResult {
  match: boolean;
  confidence: number | null;
  cardType: string | null;
}

// Selfie vs government photo ID (passport, NIN, voter's card, driver's licence).
// Both images base64 WITHOUT the data:... prefix. Match counts at 60+, strong at 90+.
export async function verifyFace(args: {
  selfieBase64: string;
  idPhotoBase64: string;
  firstName?: string;
  lastName?: string;
}): Promise<FaceResult> {
  if (!args.selfieBase64 || !args.idPhotoBase64) throw new Error("Both selfie and ID photo are required");
  const e = await dojahFetch<{ selfie?: Record<string, unknown> }>("/api/v1/kyc/photoid/verify", {
    method: "POST",
    body: JSON.stringify({
      photoid_image: args.idPhotoBase64,
      selfie_image: args.selfieBase64,
      ...(args.firstName ? { first_name: args.firstName } : {}),
      ...(args.lastName ? { last_name: args.lastName } : {}),
    }),
  });
  const s = (e.selfie ?? {}) as Record<string, unknown>;
  const confidence = typeof s.confidence_value === "number" ? (s.confidence_value as number) : null;
  const match = typeof s.match === "boolean" ? (s.match as boolean) : confidence !== null && confidence >= 60;
  return { match, confidence, cardType: (s.card_type ?? null) as string | null };
}
