import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, verifySessionTokenEdge } from "@/lib/auth-edge";

const publicPrefixes = ["/setup/admin", "/p/", "/legal/", "/api/auth/login", "/api/setup/admin", "/api/track/", "/api/events/track", "/api/landingpages/", "/api/videos/mock/"];
const publicFiles = ["/favicon.ico", "/icon.png", "/apple-touch-icon.png", "/tasklytic-icon.svg", "/manifest.webmanifest", "/sw.js", "/app-recovery.js", "/robots.txt"];
const noStorePublicFiles = new Set(["/sw.js", "/app-recovery.js", "/version.json", "/app-version.json"]);
const staticPrefixes = ["/_next/static/", "/uploads/"];

function isHtmlRequest(request: NextRequest) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function applyNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") || `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const nextWithRequestId = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);
    if (noStorePublicFiles.has(pathname) || isHtmlRequest(request)) applyNoStore(response);
    return response;
  };

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    const response = NextResponse.redirect(url);
    response.headers.set("x-request-id", requestId);
    applyNoStore(response);
    return response;
  }

  if (pathname === "/login") {
    const valid = await verifySessionTokenEdge(request.cookies.get(sessionCookieName)?.value, process.env.SESSION_SECRET);
    if (!valid) return nextWithRequestId();

    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    const response = NextResponse.redirect(url);
    response.headers.set("x-request-id", requestId);
    applyNoStore(response);
    return response;
  }

  if (staticPrefixes.some((prefix) => pathname.startsWith(prefix)) || publicFiles.includes(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return nextWithRequestId();
  }

  const protectsAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const protectsMutationApi = pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (!protectsAdmin && !protectsMutationApi) return nextWithRequestId();

  const valid = await verifySessionTokenEdge(request.cookies.get(sessionCookieName)?.value, process.env.SESSION_SECRET);
  if (valid) return nextWithRequestId();

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json({ error: "Berechtigung fehlt.", requestId }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  const response = NextResponse.redirect(url);
  response.headers.set("x-request-id", requestId);
  applyNoStore(response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|uploads|favicon.ico|icons|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$).*)"]
};
