"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const chunkReloadKey = "tasklytic_chunk_reload_used";
const appVersionStorageKey = "tasklytic-app-version";
const cacheVersionStorageKey = "tasklytic-cache-version";

export function AppVersionClient() {
  return <ServiceWorkerCleanupClient />;
}

export function ServiceWorkerCleanupClient() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    void reconcileAppVersion();
  }, []);

  return null;
}

export function AppUpdateCheckButton({ label = "Nach Aktualisierung suchen" }: { label?: string }) {
  const [status, setStatus] = useState<"idle" | "checking" | "updating">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function checkForUpdate() {
    setStatus("checking");
    setMessage(null);
    try {
      await repairTasklyticCache({ redirect: false });
      setMessage("Service Worker deaktiviert und Tasklytic-Caches geloescht.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cache-Bereinigung fehlgeschlagen.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void checkForUpdate()}
        disabled={status !== "idle"}
        className="btn-secondary inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${status === "checking" ? "animate-spin" : ""}`} aria-hidden="true" />
        <span>{status === "checking" ? "Bereinigt..." : label}</span>
      </button>

      {message ? (
        <div role="status" className="fixed right-3 top-[calc(5rem+env(safe-area-inset-top))] z-[210] max-w-sm rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 shadow-panel">
          {message}
        </div>
      ) : null}
    </>
  );
}

export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : String(error || "");
  const name = error instanceof Error ? error.name : "";
  return /Loading chunk|ChunkLoadError|failed to fetch dynamically imported module|Importing a module script failed/i.test(`${name} ${message}`);
}

export function isRecoverableStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : String(error || "");
  const name = error instanceof Error ? error.name : "";
  return isChunkLoadError(error) || /TypeError|Loading CSS chunk/i.test(`${name} ${message}`);
}

export async function recoverFromChunkLoadError() {
  if (typeof window === "undefined") return;
  const alreadyReloaded = window.sessionStorage.getItem(chunkReloadKey) === "1";
  if (alreadyReloaded) return;
  window.sessionStorage.setItem(chunkReloadKey, "1");
  logAssetStatus("recover-chunk-error");
  await unregisterServiceWorkers();
  await clearTasklyticCaches();
  window.location.href = "/login?fresh=" + Date.now();
}

async function clearTasklyticCaches() {
  if (typeof window === "undefined") return;
  if (!("caches" in window)) return;
  const keys = await window.caches.keys().catch(() => []);
  console.info("[tasklytic:cache]", { keys, deleting: keys });
  await Promise.all(keys.map((key) => window.caches.delete(key).catch(() => false)));
}

async function unregisterServiceWorkers() {
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  console.info("[tasklytic:service-worker]", { registrations: registrations.length });
  await Promise.all(registrations.map(async (registration) => {
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    await registration.unregister().catch(() => false);
  }));
}

export async function repairTasklyticCache(options: { redirect?: boolean } = {}) {
  if (typeof window === "undefined") return;
  logAssetStatus("manual-cache-repair");
  await unregisterServiceWorkers();
  await clearTasklyticCaches();
  if (options.redirect !== false) window.location.href = "/login?fresh=" + Date.now();
}

async function reconcileAppVersion() {
  if (typeof window === "undefined") return;
  try {
    const response = await fetch("/app-version.json?ts=" + Date.now(), { cache: "no-store" });
    if (!response.ok) {
      logAssetStatus("version-fetch-failed", { status: response.status });
      return;
    }
    const body = await response.json() as { version?: string; buildId?: string };
    const version = body.version || body.buildId;
    if (!version) return;
    const previous = window.localStorage.getItem(appVersionStorageKey);
    console.info("[tasklytic:version]", { previous, current: version });
    if (previous && previous !== version) {
      window.localStorage.setItem(appVersionStorageKey, version);
      window.localStorage.setItem(cacheVersionStorageKey, version);
      await unregisterServiceWorkers();
      await clearTasklyticCaches();
      return;
    }
    window.localStorage.setItem(appVersionStorageKey, version);
    window.localStorage.setItem(cacheVersionStorageKey, version);
    await unregisterServiceWorkers();
  } catch (error) {
    logAssetStatus("version-check-error", { message: error instanceof Error ? error.message : String(error) });
  }
}

function logAssetStatus(reason: string, extra?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const stylesheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="/_next/static/css/"]'));
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="/_next/static/"]'));
  const cssStatus = stylesheets.some((link) => link.dataset.tasklyticFailed === "1") ? "failed" : stylesheets.length ? "present" : "missing";
  const jsStatus = scripts.some((script) => script.dataset.tasklyticFailed === "1") ? "failed" : scripts.length ? "present" : "missing";
  console.info("[tasklytic:asset-status]", {
    reason,
    cssStatus,
    jsStatus,
    chunkStatus: window.sessionStorage.getItem(chunkReloadKey) === "1" ? "reload-used" : "ok",
    serviceWorkerVersion: "unregistered-mode",
    cacheVersion: window.localStorage.getItem(cacheVersionStorageKey),
    ...extra
  });
}
