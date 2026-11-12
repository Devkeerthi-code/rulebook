import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js (inside unpdf) and pdf-lib must stay plain Node modules rather than being bundled.
  serverExternalPackages: ["unpdf", "pdf-lib"],
  poweredByHeader: false,
  // Pin the workspace root so a stray lockfile in a parent folder can't confuse Turbopack.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default nextConfig;
