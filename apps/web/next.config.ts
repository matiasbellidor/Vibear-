import path from "node:path";
import type { NextConfig } from "next";

// The browser only talks to this origin: /api/* is proxied to the FastAPI service.
// Rewrites are resolved at build time, so Docker passes API_URL as a build argument.
const apiUrl = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Docker builds a self-contained server; locally `next start` needs the regular output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  // Keeps the last visited routes mounted but hidden (React Activity), so switching between the
  // tabs (Inicio, Escanear, Guardados) shows the page again instead of rebuilding it.
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // A search (Google Lens + thumbnails + CLIP) can take 10-20 s on CPU.
    proxyTimeout: 60_000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
