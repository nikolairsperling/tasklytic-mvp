import fs from "node:fs";
import {
  getDatabaseUrl,
  maskDatabaseUrl,
  parseDatabaseUrl
} from "./env-database-utils.mjs";

const databaseUrl = getDatabaseUrl();
const parsed = parseDatabaseUrl(databaseUrl);
const maskedUrl = maskDatabaseUrl(databaseUrl);
const errors = [];
const warnings = [];

if (!databaseUrl || parsed.type === "missing") {
  errors.push("DATABASE_URL fehlt. Produktive Daten koennen so nicht serverseitig gespeichert werden.");
}

if (parsed.type === "invalid") {
  errors.push("DATABASE_URL ist ungueltig.");
}

if (parsed.type === "sqlite") {
  const databasePath = parsed.database ?? "";
  if (!databasePath.startsWith("/data/")) {
    errors.push("SQLite ist nur erlaubt, wenn die Datei in einem persistenten Volume liegt, z. B. /data/app.db.");
  }
}

if (
  parsed.type &&
  !["postgresql", "postgres", "sqlite", "missing", "invalid"].includes(parsed.type)
) {
  errors.push(`Nicht unterstuetzter Datenbanktyp: ${parsed.type}. Erwartet wird PostgreSQL oder persistentes SQLite.`);
}

if (
  process.env.NODE_ENV === "production" &&
  fs.existsSync("/.dockerenv") &&
  ["localhost", "127.0.0.1"].includes(parsed.host ?? "")
) {
  errors.push("DATABASE_URL zeigt im Container auf localhost. Fuer Docker Compose muss die App den Postgres-Service-Host verwenden, z. B. postgres:5432.");
}

if (parsed.type === "postgresql" || parsed.type === "postgres") {
  if (!parsed.database) {
    errors.push("DATABASE_URL enthaelt keinen Datenbanknamen.");
  }
  if ((parsed.database ?? "").match(/tmp|temp|memory/i)) {
    errors.push("DATABASE_URL wirkt temporaer. Produktive Daten duerfen nicht in einer temporaeren Datenbank liegen.");
  }
}

if (!fs.existsSync("docker-compose.yml")) {
  warnings.push("docker-compose.yml nicht gefunden. Persistente Docker-Volumes konnten nicht geprueft werden.");
} else {
  const compose = fs.readFileSync("docker-compose.yml", "utf8");
  if (!compose.includes("postgres_data:/var/lib/postgresql/data")) {
    warnings.push("In docker-compose.yml wurde kein postgres_data Volume fuer /var/lib/postgresql/data gefunden.");
  }
}

console.log(`Persistence check: ${maskedUrl}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log("Persistence check passed.");
