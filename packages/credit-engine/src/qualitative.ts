// Qualitative borrower/business scoring. Ratings 1 (weak) – 5 (strong) per dimension.

export interface QualitativeAnswers {
  history: number;
  industry: number;
  management: number;
  stability: number;
  concentration: number;
  seasonality: number;
  purpose: number;
  repayment: number;
}

export type QualityBand = "Strong" | "Adequate" | "Fragile" | "Critical";

export const QUALITY_DIMENSIONS: { key: keyof QualitativeAnswers; label: string; guidance: string }[] = [
  { key: "history", label: "Operating history", guidance: "Longer, continuous operation scores higher." },
  { key: "industry", label: "Industry / sector", guidance: "Stable, growing sectors score higher than volatile ones." },
  { key: "management", label: "Management quality", guidance: "Experience, record-keeping, and succession score higher." },
  { key: "stability", label: "Business stability", guidance: "Steady revenues and customer base score higher." },
  { key: "concentration", label: "Customer / supplier spread", guidance: "Diversified counterparties score higher; single-buyer dependence scores low." },
  { key: "seasonality", label: "Seasonality handling", guidance: "Scores higher when seasonal swings are planned for and funded." },
  { key: "purpose", label: "Purpose fit", guidance: "Productive, revenue-linked purposes score higher than consumption." },
  { key: "repayment", label: "Repayment source fit", guidance: "Scores higher when the source is verified, stable, and matched to tenor." },
];

export function validateRating(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

export function scoreQualitative(a: QualitativeAnswers): {
  average: number;
  band: QualityBand;
  weakest: string[];
} {
  const entries = QUALITY_DIMENSIONS.map((d) => ({ ...d, rating: a[d.key] }));
  for (const e of entries) {
    if (!validateRating(e.rating)) throw new Error(`Rating for ${e.key} must be 1–5`);
  }
  const sum = entries.reduce((s, e) => s + e.rating, 0);
  const average = Math.round((sum / entries.length) * 100) / 100;
  const band: QualityBand = average >= 4 ? "Strong" : average >= 3 ? "Adequate" : average >= 2 ? "Fragile" : "Critical";
  const weakest = entries.filter((e) => e.rating <= 2).map((e) => e.label);
  return { average, band, weakest };
}
