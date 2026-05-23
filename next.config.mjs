import { readFileSync } from "node:fs";

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb"
    },
    middlewareClientMaxBodySize: "250mb"
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      },
      {
        source: "/app-recovery.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      },
      {
        source: "/:path(version|app-version).json",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      },
      {
        source: "/api/app-version",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" }
        ]
      },
      {
        source: "/uploads/videos/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Accept-Ranges", value: "bytes" }
        ]
      },
      {
        source: "/uploads/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      }
    ];
  },
  generateBuildId() {
    try {
      return readFileSync(".tasklytic-build-version", "utf8").trim();
    } catch {
      return `tasklytic-${Date.now()}`;
    }
  }
};

export default nextConfig;
