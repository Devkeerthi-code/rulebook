import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js (inside unpdf) must stay a plain Node module rather than being bundled.
  serverExternalPackages: ["unpdf", "pdf-lib"],
  poweredByHeader: false,
  experimental: {
    // PDF uploads go through a route handler, but keep server actions small and explicit.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
