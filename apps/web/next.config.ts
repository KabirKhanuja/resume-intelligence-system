import type { NextConfig } from "next";

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = dirname(fileURLToPath(import.meta.url));
const turbopackRoot = dirname(dirname(webDir));

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  } as any,
  async rewrites() {
    const apiBase = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
