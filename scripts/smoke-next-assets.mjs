const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const routes = (process.env.SMOKE_ROUTES || "/login,/admin").split(",").map((route) => route.trim()).filter(Boolean);

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString();
}

function unique(values) {
  return Array.from(new Set(values));
}

function extractNextScripts(html) {
  const scripts = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']*\/_next\/static\/[^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html))) scripts.push(match[1]);
  return unique(scripts);
}

async function fetchWithStatus(url, options = {}) {
  const response = await fetch(url, options);
  return response;
}

let failed = false;

for (const route of routes) {
  const routeUrl = absoluteUrl(route);
  const htmlResponse = await fetchWithStatus(routeUrl, {
    headers: {
      Accept: "text/html"
    }
  });

  const cacheControl = htmlResponse.headers.get("cache-control") || "";
  if (!htmlResponse.ok && ![301, 302, 303, 307, 308].includes(htmlResponse.status)) {
    failed = true;
    console.error(`[next-assets] HTML ${routeUrl} returned ${htmlResponse.status}`);
    continue;
  }

  if (!/no-store/i.test(cacheControl)) {
    failed = true;
    console.error(`[next-assets] HTML ${routeUrl} is cacheable: ${cacheControl || "(missing)"}`);
  }

  const html = await htmlResponse.text();
  const scripts = extractNextScripts(html);
  console.info(`[next-assets] ${routeUrl} -> ${htmlResponse.url}: ${scripts.length} Next script(s)`);

  for (const script of scripts) {
    const scriptUrl = absoluteUrl(script);
    const scriptResponse = await fetchWithStatus(scriptUrl, { method: "HEAD" });
    if (scriptResponse.status !== 200) {
      failed = true;
      console.error(`[next-assets] ${scriptUrl} returned ${scriptResponse.status}`);
    }
  }
}

if (failed) process.exit(1);
console.info("[next-assets] all referenced Next scripts returned HTTP 200");
