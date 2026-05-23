import { readFileSync } from "fs";
import { join } from "path";

let cachedBuildVersion: string | null = null;

export function getBuildVersion() {
  if (cachedBuildVersion) return cachedBuildVersion;

  const explicitVersion = process.env.NEXT_PUBLIC_APP_VERSION || process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA;
  if (explicitVersion) {
    cachedBuildVersion = explicitVersion;
    return cachedBuildVersion;
  }

  try {
    cachedBuildVersion = readFileSync(join(process.cwd(), "public", "version.json"), "utf8");
    cachedBuildVersion = JSON.parse(cachedBuildVersion).version;
    if (cachedBuildVersion) return cachedBuildVersion;
  } catch {
    // Fall through to Next BUILD_ID.
  }

  try {
    cachedBuildVersion = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
    return cachedBuildVersion;
  } catch {
    cachedBuildVersion = "2026-05-17-chunk-refresh-v1";
    return cachedBuildVersion;
  }
}
