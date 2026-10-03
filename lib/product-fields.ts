import type { ProductKey } from "./products";

export interface ProductField {
  name: string;
  label: string;
  kind: "text" | "naira" | "select";
  options?: string[];
  placeholder?: string;
}

// Per-product Stage 8 fields (PRD §12). Selects required; text/naira optional.
export const PRODUCT_FIELDS: Record<ProductKey, ProductField[]> = {
  SBL: [
    { name: "cashflowStability", label: "Cash-flow stability", kind: "select", options: ["Stable", "Variable", "Declining"] },
    { name: "revenueTrend", label: "Revenue trend", kind: "select", options: ["Growing", "Flat", "Declining"] },
    { name: "debtBurdenNote", label: "Debt-burden note", kind: "text", placeholder: "e.g. Two facilities, both current" },
    { name: "businessRiskNote", label: "Key business risk", kind: "text", placeholder: "e.g. Single-supplier dependence" },
  ],
  SME: [
    { name: "statementsQuality", label: "Financial-statement quality", kind: "select", options: ["Audited", "Management accounts", "Informal"] },
    { name: "workingCapital", label: "Working-capital position", kind: "select", options: ["Strong", "Adequate", "Stretched"] },
    { name: "industryRiskNote", label: "Industry risk note", kind: "text" },
    { name: "managementNote", label: "Management note", kind: "text" },
  ],
  AGRO: [
    { name: "farmType", label: "Farm / agribusiness type", kind: "text", placeholder: "e.g. Poultry, 2,000 birds" },
    { name: "productionCycle", label: "Production cycle", kind: "select", options: ["Short (< 4 mo)", "Medium (4–8 mo)", "Long (> 8 mo)"] },
    { name: "expectedRevenueNaira", label: "Expected revenue per cycle (₦)", kind: "naira" },
    { name: "inputCostsNaira", label: "Input costs per cycle (₦)", kind: "naira" },
  ],
  CLEAN_ENERGY: [
    { name: "projectType", label: "Project type", kind: "select", options: ["Solar home system", "Solar + battery", "Energy efficiency", "Other"] },
    { name: "savingsNote", label: "Expected savings / revenue", kind: "text", placeholder: "e.g. Replaces ₦45,000/mo generator fuel" },
    { name: "feasibility", label: "Technical feasibility", kind: "select", options: ["Verified", "Plausible", "Unverified"] },
    { name: "installerNote", label: "Installer / maintenance note", kind: "text" },
  ],
  HOUSING_EDU: [
    { name: "paymentType", label: "Payment type", kind: "select", options: ["Housing", "Education fees"] },
    { name: "affordabilityNote", label: "Affordability note", kind: "text", placeholder: "e.g. Payment is 28% of household income" },
    { name: "propertyValueNaira", label: "Property value (₦, housing only)", kind: "naira" },
    { name: "employmentStability", label: "Employment / income stability", kind: "select", options: ["Stable", "Variable", "Unstable"] },
  ],
  ASSET: [
    { name: "assetType", label: "Asset type", kind: "text", placeholder: "e.g. Delivery van, 2021" },
    { name: "assetValueNaira", label: "Asset value (₦)", kind: "naira" },
    { name: "assetCondition", label: "Asset condition", kind: "select", options: ["New", "Good", "Fair", "Poor"] },
    { name: "ownershipNote", label: "Ownership / documentation", kind: "text", placeholder: "e.g. Receipt + registration in borrower name" },
  ],
};
