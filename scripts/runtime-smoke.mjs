const baseUrl = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const protectedPaths = ["/admin", "/admin/prospects", "/admin/import", "/admin/campaigns", "/admin/inbox", "/admin/assets", "/admin/settings"];
const publicPaths = ["/", "/login", "/sw.js", "/version.json", "/manifest.webmanifest"];

const failures = [];

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const contentType = response.headers.get("content-type") ?? "";
  const cacheControl = response.headers.get("cache-control") ?? "";
  const body = await response.text();
  return { path, response, contentType, cacheControl, body };
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function extractStaticRefs(html) {
  return Array.from(new Set([...html.matchAll(/["'](\/_next\/static\/[^"']+)["']/g)].map((match) => match[1])));
}

for (const path of publicPaths) {
  const result = await request(path);
  assert(result.response.status >= 200 && result.response.status < 400, `${path} returned ${result.response.status}`);
  if (path === "/login") {
    assert(result.contentType.includes("text/html"), "/login did not return HTML");
    assert(!/^<html[^>]*>\s*<head>\s*<\/head>/i.test(result.body), "/login looks like raw or unstyled HTML");
  }
  if (path === "/sw.js" || path === "/version.json") {
    assert(/no-store|no-cache|max-age=0/i.test(result.cacheControl), `${path} is cacheable: ${result.cacheControl}`);
  }
}

const login = await request("/login");
const refs = extractStaticRefs(login.body).filter((path) => /\.(?:js|css)(?:\?|$)/.test(path));
assert(refs.length > 0, "/login did not reference Next static CSS/JS assets");

for (const ref of refs.slice(0, 30)) {
  const result = await request(ref);
  assert(result.response.status === 200, `${ref} returned ${result.response.status}`);
  if (ref.includes(".css")) assert(result.contentType.includes("text/css"), `${ref} content-type is ${result.contentType}`);
  if (ref.includes(".js")) assert(/javascript|ecmascript/.test(result.contentType), `${ref} content-type is ${result.contentType}`);
  assert(!result.body.startsWith("<!DOCTYPE html>") && !result.body.startsWith("<html"), `${ref} returned HTML`);
}

for (const path of protectedPaths) {
  const result = await request(path);
  assert([200, 302, 303, 307, 308].includes(result.response.status), `${path} returned ${result.response.status}`);
  assert(!result.body.includes("ChunkLoadError"), `${path} exposes ChunkLoadError`);
  assert(!result.body.includes("Load failed"), `${path} exposes Load failed`);
}

if (failures.length > 0) {
  console.error("Runtime smoke failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.info("Runtime smoke passed", { baseUrl, checkedAssets: refs.length, publicPaths: publicPaths.length, protectedPaths: protectedPaths.length });
