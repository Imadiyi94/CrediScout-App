import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrediScout — Credit Analysis & Lending Decisions",
  description: "Structured, evidence-based credit assessment for analysts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
