import type { NextConfig } from "next";

// Standalone output only for Docker (STANDALONE_OUTPUT=1).
// Netlify uses its own Next.js runtime — leave output unset there.
const nextConfig: NextConfig = {
  ...(process.env.STANDALONE_OUTPUT === "1" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  // Keep the PDF engine out of the bundle so pdfkit resolves its own font
  // assets at runtime (fixes MODULE_NOT_FOUND on serverless handlers).
  serverExternalPackages: ["@react-pdf/renderer", "pdfkit"],
};

export default nextConfig;
