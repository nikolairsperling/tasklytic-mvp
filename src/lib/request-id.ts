export function createRequestId(prefix = "req") {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function getRequestIdFromHeaders(headers: Headers) {
  return headers.get("x-request-id") || createRequestId();
}
