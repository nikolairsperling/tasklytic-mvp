"use client";

import { useEffect } from "react";

export function FetchDiagnostics() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentFetch = window.fetch;
    if ((currentFetch as typeof currentFetch & { __tasklyticPatched?: boolean }).__tasklyticPatched) return;

    const patchedFetch: typeof window.fetch = async (input, init) => {
      const startedAt = Date.now();
      const requestId = `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const headers = new Headers(init?.headers);
      headers.set("x-request-id", requestId);
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");

      try {
        const response = await currentFetch(input, { ...init, headers });
        if (!response.ok && url.includes("/api/") && !url.includes("/api/system/errors")) {
          const body = await response.clone().text().catch(() => "");
          await logClientError({
            requestId: response.headers.get("x-request-id") || requestId,
            area: inferArea(url),
            action: "fetch",
            apiRoute: url,
            method,
            httpStatus: response.status,
            responseBody: body,
            durationMs: Date.now() - startedAt
          });
        }
        return response;
      } catch (error) {
        if (url.includes("/api/") && !url.includes("/api/system/errors")) {
          await logClientError({
            requestId,
            area: inferArea(url),
            action: "fetch",
            apiRoute: url,
            method,
            responseBody: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startedAt
          });
        }
        throw error;
      }
    };
    (patchedFetch as typeof patchedFetch & { __tasklyticPatched?: boolean }).__tasklyticPatched = true;
    window.fetch = patchedFetch;

    const onError = (event: ErrorEvent) => {
      const message = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
      void logClientError({
        requestId: `err_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        area: /chunk|_next|css/i.test(message) ? "static-assets" : "system",
        action: "client-error",
        responseBody: message,
        durationMs: 0
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason);
      void logClientError({
        requestId: `err_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        area: /chunk|_next|css/i.test(message) ? "static-assets" : "system",
        action: "unhandled-rejection",
        responseBody: message,
        durationMs: 0
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

async function logClientError(payload: Record<string, unknown>) {
  await fetch("/api/system/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, source: "client" })
  }).catch(() => undefined);
}

function inferArea(url: string) {
  if (url.includes("clickup")) return "clickup";
  if (url.includes("campaign")) return "campaign";
  if (url.includes("prospects")) return "prospects";
  if (url.includes("landingpage")) return "landingpage";
  if (url.includes("inbox")) return "inbox";
  if (url.includes("assets")) return "assets";
  if (url.includes("impact")) return "impact";
  if (url.includes("settings")) return "system";
  return "system";
}
