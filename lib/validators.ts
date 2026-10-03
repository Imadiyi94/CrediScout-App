import { z } from "zod";

export const productSchema = z.enum(["SBL", "SME", "AGRO", "CLEAN_ENERGY", "HOUSING_EDU", "ASSET"]);
export const clientStatusSchema = z.enum(["NEW", "RETURNING"]);
export const rateTypeSchema = z.enum(["RB", "FLAT"]);

export const rateRowSchema = z.object({
  product: productSchema,
  // empty string = all clients (fixed-rate products)
  clientStatus: z.string().refine((v) => v === "" || v === "NEW" || v === "RETURNING", "Invalid client status"),
  minNaira: z.string().regex(/^[0-9, ]+$/, "Enter a valid minimum amount"),
  // empty string = open-ended top band
  maxNaira: z.string().refine((v) => v.trim() === "" || /^[0-9, ]+$/.test(v), "Enter a valid maximum amount"),
  ratePct: z.string().regex(/^[0-9]+(\.[0-9]{1,3})?$/, "Rate like 4.60"),
  rateType: rateTypeSchema,
  note: z.string().max(280).optional().default(""),
});

export const thresholdSchema = z.object({
  id: z.string().min(1),
  value: z.string().regex(/^[0-9]+(\.[0-9]{1,4})?$/, "Value like 1.2000"),
  note: z.string().max(280).optional().default(""),
});

export const userUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ANALYST", "ADMIN"]),
  active: z.enum(["true", "false"]),
  scopes: z.string().max(500).default(""),
});

export const dryRunSchema = z.object({
  product: productSchema,
  clientStatus: clientStatusSchema,
  amountNaira: z.string().regex(/^[0-9, ]+$/, "Enter a valid amount"),
});

export const borrowerSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]),
  displayName: z.string().trim().min(2, "Name is too short").max(160),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(160).default(""),
  address: z.string().trim().max(500).default(""),
});

export const assessmentCreateSchema = z.object({
  // empty = create a new borrower from borrowerSchema fields
  borrowerId: z.string().default(""),
  product: productSchema,
  requestedNaira: z.string().regex(/^[0-9, ]+$/, "Enter a valid requested amount"),
  proposedTenorMonths: z.coerce.number().int().min(1).max(120),
  loanPurpose: z.string().trim().min(3, "Describe the loan purpose").max(1000),
  repaymentSource: z.string().trim().min(3, "State the repayment source").max(1000),
  repaymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "BULLET"]),
  existingExposureNaira: z
    .string()
    .regex(/^[0-9, ]*$/, "Enter a valid amount")
    .default(""),
  clientStatus: clientStatusSchema,
});

export const profileUpdateSchema = borrowerSchema.extend({
  businessType: z.string().trim().max(120).default(""),
  businessAgeMonths: z.string().regex(/^[0-9]*$/).default(""),
  industry: z.string().trim().max(120).default(""),
  experience: z.string().trim().max(1000).default(""),
});

export const clientStatusVerifySchema = z.object({
  evidence: z.string().trim().min(10, "Describe the verification evidence").max(2000),
});

export const financialsSchema = z.object({
  revenueNaira: z.string().regex(/^[0-9, ]+$/, "Enter a valid revenue figure"),
  opexNaira: z.string().regex(/^[0-9, ]*$/, "Enter a valid expense figure").default(""),
  cashFlowNaira: z.string().regex(/^[0-9, ]*$/, "Enter a valid cash-flow figure").default(""),
  existingServiceNaira: z.string().regex(/^[0-9, ]*$/, "Enter a valid amount").default(""),
  notes: z.string().trim().max(2000).default(""),
});

export const creditRiskSchema = z.object({
  repaymentGrade: z.enum(["A", "B", "C", "D", "NONE"]),
  priorDelinquencies: z.coerce.number().int().min(0).max(999),
  priorDefaults: z.coerce.number().int().min(0).max(999),
  arrearsNow: z.enum(["yes", "no"]).default("no"),
  totalExposureNaira: z.string().regex(/^[0-9, ]*$/, "Enter a valid exposure figure").default(""),
  monthlyIncomeNaira: z.string().regex(/^[0-9, ]*$/, "Enter a valid income figure").default(""),
  openFacilities: z.coerce.number().int().min(0).max(999),
  maxUtilizationPct: z.string().regex(/^([0-9]{1,2}|100)?$/, "0–100").default(""),
  guarantorNaira: z.string().regex(/^[0-9, ]*$/, "Enter a valid amount").default(""),
  multipleLenders: z.enum(["yes", "no"]).default("no"),
});

const ratingField = z.coerce.number().int().min(1, "Rate 1–5").max(5, "Rate 1–5");

export const qualitativeSchema = z.object({
  history: ratingField,
  industry: ratingField,
  management: ratingField,
  stability: ratingField,
  concentration: ratingField,
  seasonality: ratingField,
  purpose: ratingField,
  repayment: ratingField,
  notes: z.string().trim().max(2000).default(""),
});

export const collateralSchema = z.object({
  type: z.string().trim().min(2, "Describe the security").max(160),
  ownership: z.string().trim().max(200).default(""),
  estimatedNaira: z.string().regex(/^[0-9, ]+$/, "Enter a valid estimated value"),
  verifiedNaira: z.string().regex(/^[0-9, ]*$/, "Enter a valid verified value").default(""),
  marketability: z.enum(["High", "Medium", "Low"]),
  encumbrancesNaira: z.string().regex(/^[0-9, ]*$/, "Enter a valid amount").default(""),
  documentationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
});
