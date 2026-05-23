const CACHE_PREFIXES = ["tasklytic-"];

async function clearTasklyticCaches() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .map((key) => caches.delete(key).catch(() => false))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(clearTasklyticCaches().finally(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    clearTasklyticCaches()
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

self.addEventListener("fetch", () => undefined);

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_OLD_CACHES" || event.data?.type === "UNREGISTER_SW" || event.data?.type === "SKIP_WAITING") {
    event.waitUntil(clearTasklyticCaches().finally(() => self.registration.unregister()));
  }
});
