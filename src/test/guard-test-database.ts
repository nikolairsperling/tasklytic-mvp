import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function readDotEnvValue(name: string) {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return undefined;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || match[1] !== name) continue;
    const value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }

  return undefined;
}

function databaseName(databaseUrl: string) {
  if (databaseUrl.startsWith("file:")) return databaseUrl.replace(/^file:/, "");
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

function mask(databaseUrl: string) {
  if (databaseUrl.startsWith("file:")) return databaseUrl;
  try {
    const url = new URL(databaseUrl);
    if (url.username) url.username = "***";
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "<ungueltige DATABASE_URL>";
  }
}

const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? readDotEnvValue("DATABASE_URL");
const allowNonTestDatabase = process.env.ALLOW_NON_TEST_DATABASE === "1";
const name = databaseUrl ? databaseName(databaseUrl) : "";
const isTestDatabase = /test|tests|ci|vitest/i.test(name);

if (!databaseUrl) {
  throw new Error("Tests wurden gestoppt: DATABASE_URL fehlt.");
}

if (!allowNonTestDatabase && !isTestDatabase) {
  throw new Error(
    [
      "Tests wurden gestoppt, weil DATABASE_URL nicht wie eine Test-Datenbank aussieht.",
      `Aktuelle Datenbank: ${mask(databaseUrl)}`,
      "Viele Tests loeschen Tabellen mit deleteMany. Setze DATABASE_URL auf z. B. tasklytic_test oder nutze ALLOW_NON_TEST_DATABASE=1 nur bewusst lokal."
    ].join("\n")
  );
}

