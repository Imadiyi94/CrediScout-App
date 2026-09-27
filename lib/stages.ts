export type StageStatus = "complete" | "active" | "todo" | "attention";

export interface StageDef {
  index: number;
  key: string;
  title: string;
}

export const STAGES: StageDef[] = [
  { index: 1, key: "intake", title: "Intake" },
  { index: 2, key: "profile", title: "Profile" },
  { index: 3, key: "documents", title: "Documents" },
  { index: 4, key: "financials", title: "Financials" },
  { index: 5, key: "credit-risk", title: "Credit & Risk" },
  { index: 6, key: "business", title: "Business" },
  { index: 7, key: "collateral", title: "Collateral" },
  { index: 8, key: "product", title: "Product" },
  { index: 9, key: "risk-summary", title: "Risk summary" },
  { index: 10, key: "amount", title: "Amount" },
  { index: 11, key: "decision", title: "Decision" },
];
