import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createRequestId } from "@/lib/request-id";

export type ErrorArea =
  | "dashboard"
  | "prospects"
  | "lead"
  | "enrichment"
  | "landingpage"
  | "campaign"
  | "email-template"
  | "ai"
  | "inbox"
  | "smtp-imap"
  | "assets"
  | "clickup"
  | "impact"
  | "theme"
  | "update"
  | "static-assets"
  | "system";

export type SystemErrorInput = {
  requestId?: string;
  area: ErrorArea | string;
  action: string;
  apiRoute?: string;
  method?: string;
  httpStatus?: number;
  errorCode?: string;
  userMessage?: string;
  technicalDetail?: string;
  responseBody?: string;
  durationMs?: number;
  affectedType?: string;
  affectedId?: string;
  source?: "client" | "server" | "smoke-test";
};

export function classifyError(error: unknown, fallback = "Die Funktion konnte nicht abgeschlossen werden.") {
  const raw = getRawErrorDetail(error);
  if (/ChunkLoadError|Loading chunk|CSS_CHUNK_LOAD_FAILED|_next\/static/i.test(raw)) {
    return { code: "CHUNK_LOAD_FAILED", message: "Chunk konnte nicht geladen werden." };
  }
  if (/AbortError|timeout|timed out|ETIMEDOUT/i.test(raw)) {
    return { code: "TIMEOUT", message: "Timeout beim Abrufen der Website." };
  }
  if (/401|403|unauthorized|forbidden|permission|Nicht angemeldet|Berechtigung/i.test(raw)) {
    return { code: "PERMISSION_DENIED", message: "Berechtigung fehlt." };
  }
  if (/Prisma|database|Datenbank|P20\d\d|constraint|relation/i.test(raw)) {
    return { code: "DATABASE_ERROR", message: "Datenbankfehler." };
  }
  if (/fetch failed|Load failed|Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|DNS/i.test(raw)) {
    return { code: "API_UNREACHABLE", message: "API nicht erreichbar." };
  }
  if (/invalid json|Unexpected token|Antwortformat|schema|Zod/i.test(raw)) {
    return { code: "INVALID_RESPONSE", message: "Antwortformat ungültig." };
  }
  if (/OpenAI|ClickUp|Slack|SMTP|IMAP|mailbox|external|service/i.test(raw)) {
    return { code: "EXTERNAL_SERVICE_UNREACHABLE", message: "Externer Dienst nicht erreichbar." };
  }
  return { code: "UNKNOWN_ERROR", message: fallback };
}

export function getRawErrorDetail(error: unknown) {
  if (error instanceof Error) return [error.name, error.message, error.stack].filter(Boolean).join("\n");
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function logSystemError(input: SystemErrorInput) {
  const classified = input.errorCode && input.userMessage
    ? { code: input.errorCode, message: input.userMessage }
    : classifyError(input.technicalDetail || input.responseBody || input.userMessage);
  const requestId = input.requestId || createRequestId("err");
  await prisma.systemErrorLog.upsert({
    where: { requestId },
    create: {
      requestId,
      area: input.area,
      action: input.action,
      apiRoute: input.apiRoute,
      method: input.method,
      httpStatus: input.httpStatus,
      errorCode: classified.code,
      userMessage: classified.message,
      technicalDetail: truncate(input.technicalDetail, 4000),
      responseBody: truncate(input.responseBody, 4000),
      durationMs: input.durationMs,
      affectedType: input.affectedType,
      affectedId: input.affectedId,
      source: input.source ?? "server"
    },
    update: {
      area: input.area,
      action: input.action,
      apiRoute: input.apiRoute,
      method: input.method,
      httpStatus: input.httpStatus,
      errorCode: classified.code,
      userMessage: classified.message,
      technicalDetail: truncate(input.technicalDetail, 4000),
      responseBody: truncate(input.responseBody, 4000),
      durationMs: input.durationMs,
      affectedType: input.affectedType,
      affectedId: input.affectedId,
      source: input.source ?? "server"
    }
  }).catch(() => undefined);
  return { requestId, errorCode: classified.code, userMessage: classified.message };
}

export function serializeSystemErrorLog(entry: Prisma.SystemErrorLogGetPayload<object>) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString()
  };
}

function truncate(value: string | undefined, max: number) {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
