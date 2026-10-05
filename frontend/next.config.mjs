import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pin the workspace root so a stray lockfile in a parent folder is not picked up
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  // document parsing / embedding on the first upload can take longer than the 30 s default
  experimental: { proxyTimeout: 120_000 },
  async rewrites() {
    const api = process.env.PATHSYNC_API || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};
export default nextConfig;
