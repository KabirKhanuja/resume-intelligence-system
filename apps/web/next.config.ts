import type { NextConfig } from "next";

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = dirname(fileURLToPath(import.meta.url));
const turbopackRoot = dirname(dirname(webDir));

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  } as any,
};

export default nextConfig;
