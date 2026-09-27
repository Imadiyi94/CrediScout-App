export type ProductKey = "SBL" | "SME" | "AGRO" | "CLEAN_ENERGY" | "HOUSING_EDU" | "ASSET";

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  SBL: "Small Business Loan",
  SME: "SME Loan",
  AGRO: "Agricultural Loan",
  CLEAN_ENERGY: "Clean Energy Loan",
  HOUSING_EDU: "Housing / Education Loan",
  ASSET: "Asset Loan",
};

export const PRODUCT_RATE_HINTS: Record<ProductKey, string> = {
  SBL: "Tiered RB by amount × New/Returning",
  SME: "Tiered RB by amount × New/Returning",
  AGRO: "5.5% RB · all amounts",
  CLEAN_ENERGY: "3.0% Flat · all amounts",
  HOUSING_EDU: "3.0% Flat · all amounts",
  ASSET: "Admin-configured rate",
};
