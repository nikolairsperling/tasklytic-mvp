import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

function shortCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "local";
  }
}

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const buildId = `${stamp}-${shortCommit()}`;
const payload = {
  version: buildId,
  buildId
};

writeFileSync("public/version.json", `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync("public/app-version.json", `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(".tasklytic-build-version", `${buildId}\n`);

console.info(`[build] Tasklytic buildId ${buildId}`);
