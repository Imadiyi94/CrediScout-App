import type { NextConfig } from "next";

// Standalone output only for Docker (STANDALONE_OUTPUT=1).
// Netlify uses its own Next.js runtime — leave output unset there.
const nextConfig: NextConfig = {
  ...(process.env.STANDALONE_OUTPUT === "1" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
};

export default nextConfig;
