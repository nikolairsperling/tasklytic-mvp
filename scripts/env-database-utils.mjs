import fs from "node:fs";
import path from "node:path";

export function readDotEnvValue(name, cwd = process.cwd()) {
  const envPath = path.join(cwd, ".env");
  if (!fs.existsSync(envPath)) return undefined;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || match[1] !== name) continue;

    const value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    return value;
  }

  return undefined;
}

export function getDatabaseUrl(cwd = process.cwd()) {
  return (
    process.env.DATABASE_URL ||
    process.env.TEST_DATABASE_URL ||
    process.env.PERSISTENCE_TEST_DATABASE_URL ||
    readDotEnvValue("DATABASE_URL", cwd)
  );
}

export function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return { type: "missing" };

  if (databaseUrl.startsWith("file:")) {
    return {
      type: "sqlite",
      protocol: "file:",
      database: databaseUrl.replace(/^file:/, "")
    };
  }

  try {
    const url = new URL(databaseUrl);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return {
      type: url.protocol.replace(/:$/, ""),
      protocol: url.protocol,
      host: url.hostname,
      port: url.port,
      database
    };
  } catch {
    return { type: "invalid" };
  }
}

export function maskDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return "<missing>";
  if (databaseUrl.startsWith("file:")) return databaseUrl;

  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = "***";
    if (url.username) url.username = "***";
    return url.toString();
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

export function isClearlyTestDatabase(databaseUrl) {
  const parsed = parseDatabaseUrl(databaseUrl);
  const database = parsed.database ?? "";
  return /test|tests|ci|vitest/i.test(database);
}

