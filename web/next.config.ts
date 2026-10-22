import type { NextConfig } from "next";
// Production: static export. `next build` writes plain HTML/JS to out/, which the Express server (../server.js)
// serves next to its /api routes: one process, one origin, no CORS, dashboard keys never cross domains.
// Dev (`next dev`): API calls are proxied to Express on API_URL (default http://localhost:3000).
const dev = process.env.NODE_ENV !== "production";
const API = process.env.API_URL || "http://localhost:3000";
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  reactStrictMode: true, images: { unoptimized: true },
  ...(dev ? { async rewrites() { return ["/api/:p*", "/auth/:p*", "/billing/:p*"].map((source) => ({ source, destination: `${API}${source.replace("/:p*", "")}/:p*` })); } } : { output: "export" as const }),
};
export default config;
