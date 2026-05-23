import { warnOrFailForSessionSecret } from "@/lib/env";
import { logSystemError } from "@/lib/error-diagnostics";
import { createRequestId } from "@/lib/request-id";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    warnOrFailForSessionSecret();
    installServerFetchDiagnostics();
  }
}

function installServerFetchDiagnostics() {
  const currentFetch = globalThis.fetch;
  if ((currentFetch as typeof currentFetch & { __tasklyticPatched?: boolean }).__tasklyticPatched) return;

  const patchedFetch: typeof globalThis.fetch = async (input, init) => {
    const startedAt = Date.now();
    const requestId = createRequestId("srv");
    const headers = new Headers(init?.headers);
    headers.set("x-request-id", headers.get("x-request-id") || requestId);
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");

    try {
      const response = await currentFetch(input, { ...init, headers });
      if (!response.ok && shouldLogServerFetch(url)) {
        const body = await response.clone().text().catch(() => "");
        void logSystemError({
          requestId: response.headers.get("x-request-id") || requestId,
          area: inferArea(url),
          action: "server-fetch",
          apiRoute: url,
          method,
          httpStatus: response.status,
          responseBody: body,
          durationMs: Date.now() - startedAt,
          source: "server"
        });
      }
      return response;
    } catch (error) {
      if (shouldLogServerFetch(url)) {
        void logSystemError({
          requestId,
          area: inferArea(url),
          action: "server-fetch",
          apiRoute: url,
          method,
          technicalDetail: error instanceof Error ? error.stack ?? error.message : String(error),
          durationMs: Date.now() - startedAt,
          source: "server"
        });
      }
      throw error;
    }
  };
  (patchedFetch as typeof patchedFetch & { __tasklyticPatched?: boolean }).__tasklyticPatched = true;
  globalThis.fetch = patchedFetch;
}

function shouldLogServerFetch(url: string) {
  return !url.includes("/api/system/errors");
}

function inferArea(url: string) {
  if (url.includes("clickup")) return "clickup";
  if (url.includes("openai")) return "ai";
  if (url.includes("smtp") || url.includes("imap")) return "smtp-imap";
  if (url.includes("_next/static")) return "static-assets";
  if (url.includes("landingpage")) return "landingpage";
  return "system";
}
