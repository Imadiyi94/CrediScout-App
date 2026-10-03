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
