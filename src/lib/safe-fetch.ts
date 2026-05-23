import { createRequestId } from "@/lib/request-id";

export type SafeFetchOptions = RequestInit & {
  area?: string;
  action?: string;
  affectedType?: string;
  affectedId?: string;
  timeoutMs?: number;
};

export class SafeFetchError extends Error {
  requestId: string;
  status?: number;
  code: string;
  details?: string;

  constructor(message: string, input: { requestId: string; status?: number; code?: string; details?: string }) {
    super(message);
    this.name = "SafeFetchError";
    this.requestId = input.requestId;
    this.status = input.status;
    this.code = input.code ?? "FETCH_FAILED";
    this.details = input.details;
  }
}

export async function safeFetch(input: string | URL | Request, options: SafeFetchOptions = {}) {
  const requestId = createRequestId("req");
  const startedAt = Date.now();
  const headers = new Headers(options.headers);
  headers.set("x-request-id", requestId);
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
  const method = options.method ?? (input instanceof Request ? input.method : "GET");
  const url = input instanceof Request ? input.url : String(input);

  try {
    const response = await fetch(input, { ...options, headers, signal: controller?.signal ?? options.signal });
    const responseRequestId = response.headers.get("x-request-id") || requestId;
    if (!response.ok) {
      const body = await response.clone().text().catch(() => "");
      await logClientFetchError({ requestId: responseRequestId, url, method, status: response.status, body, durationMs: Date.now() - startedAt, options });
      throw new SafeFetchError(messageForStatus(response.status), { requestId: responseRequestId, status: response.status, details: body });
    }
    return response;
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Timeout beim Abrufen der Website."
      : "API nicht erreichbar.";
    await logClientFetchError({ requestId, url, method, durationMs: Date.now() - startedAt, body: error instanceof Error ? error.message : String(error), options });
    throw new SafeFetchError(message, { requestId, code: "FETCH_FAILED", details: error instanceof Error ? error.message : String(error) });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function parseSafeJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch (error) {
    const requestId = response.headers.get("x-request-id") || createRequestId("req");
    throw new SafeFetchError("Antwortformat ungültig.", { requestId, status: response.status, code: "INVALID_RESPONSE", details: error instanceof Error ? error.message : String(error) });
  }
}

async function logClientFetchError(input: { requestId: string; url: string; method: string; status?: number; body?: string; durationMs: number; options: SafeFetchOptions }) {
  if (typeof window === "undefined") return;
  if (input.url.includes("/api/system/errors")) return;
  await fetch("/api/system/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": input.requestId },
    body: JSON.stringify({
      requestId: input.requestId,
      area: input.options.area ?? inferArea(input.url),
      action: input.options.action ?? "fetch",
      apiRoute: input.url,
      method: input.method,
      httpStatus: input.status,
      responseBody: input.body,
      durationMs: input.durationMs,
      affectedType: input.options.affectedType,
      affectedId: input.options.affectedId,
      source: "client"
    })
  }).catch(() => undefined);
}

function messageForStatus(status: number) {
  if (status === 401 || status === 403) return "Berechtigung fehlt.";
  if (status >= 500) return "API nicht erreichbar.";
  return "Antwortformat ungültig.";
}

function inferArea(url: string) {
  if (url.includes("clickup")) return "clickup";
  if (url.includes("campaign")) return "campaign";
  if (url.includes("prospects")) return "prospects";
  if (url.includes("landingpage")) return "landingpage";
  if (url.includes("inbox")) return "inbox";
  if (url.includes("assets")) return "assets";
  if (url.includes("settings")) return "system";
  return "system";
}
