import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR lets a second local build (e.g. one pointed at another backend port) live beside the default .next
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // pin the workspace root so a stray lockfile in a parent folder is not picked up
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  // document parsing / embedding on the first upload can take longer than the 30 s default
  experimental: { proxyTimeout: 120_000 },
  // the UI moved to English URLs; keep old links working
  async redirects() {
    // the UI moved to English URLs; keep old links working
    const moved = { dasbor: "dashboard", profil: "evidence", asesmen: "assessment", pakar: "experts" };
    const renamed = Object.entries(moved).flatMap(([from, to]) => [
      { source: `/${from}`, destination: `/${to}`, permanent: true },
      { source: `/${from}/:rest*`, destination: `/${to}/:rest*`, permanent: true },
    ]);
    // journey restructure (Home, 1 Skills, 2 Careers, 3 Learn): pages that became part of a stage.
    // Query strings pass through (e.g. /market?role=x -> /careers?role=x). Temporary until the structure settles.
    const stage = (source, destination, has) => ({ source, destination, permanent: false, ...(has ? { has } : {}) });
    return [
      ...renamed,
      stage("/market", "/careers"),
      stage("/pasar", "/careers"),
      stage("/prerequisites", "/learn?tab=map"),
      stage("/graf", "/learn?tab=map"),
      stage("/classroom", "/learn?tab=courses"),
      stage("/history", "/learn?tab=history"),
      stage("/riwayat", "/learn?tab=history"),
      stage("/skill-map", "/skills", [{ type: "query", key: "tab", value: "mine" }]),
      stage("/skill-map", "/learn?view=map", [{ type: "query", key: "tab", value: "connect" }]),
      stage("/skill-map", "/careers"),
    ];
  },

  async rewrites() {
    const api = process.env.PATHSYNC_API || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};
export default nextConfig;
