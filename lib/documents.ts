export const DOC_KINDS = [
  "bank-statement",
  "financial-statement",
  "payslip",
  "business-record",
  "loan-schedule",
  "tax-document",
  "property-document",
  "asset-document",
  "agricultural-record",
  "valuation-report",
  "identity",
  "other",
] as const;

export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_KIND_LABELS: Record<DocKind, string> = {
  "bank-statement": "Bank statement",
  "financial-statement": "Financial statement",
  payslip: "Payslip",
  "business-record": "Business record",
  "loan-schedule": "Existing loan schedule",
  "tax-document": "Tax / business document",
  "property-document": "Property document",
  "asset-document": "Asset document",
  "agricultural-record": "Agricultural record",
  "valuation-report": "Valuation report",
  identity: "Identity document",
  other: "Other supporting document",
};

// Kinds that must be verified before a recommendation can be priced.
export const CRITICAL_KINDS: DocKind[] = ["bank-statement", "financial-statement", "identity"];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument",
];
