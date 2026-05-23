export const dynamic = "force-dynamic";

export default function ResetAppPage() {
  const resetScript = `
(function () {
  var status = document.getElementById("reset-status");
  function setStatus(text) { if (status) status.textContent = text; }
  function clearCaches() {
    if (!("caches" in window)) return Promise.resolve();
    setStatus("Tasklytic Cache wird bereinigt ...");
    return caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key.indexOf("tasklytic-") === 0; }).map(function (key) { return caches.delete(key).catch(function () { return false; }); }));
    }).catch(function () {});
  }
  function unregisterServiceWorkers() {
    if (!("serviceWorker" in navigator)) return Promise.resolve();
    setStatus("Service Worker werden entfernt ...");
    return navigator.serviceWorker.getRegistrations().then(function (registrations) {
      return Promise.all(registrations.map(function (registration) {
        try {
          if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
        } catch (error) {}
        return registration.unregister().catch(function () { return false; });
      }));
    }).catch(function () {});
  }
  function clearStorage() {
    setStatus("Lokale App-Version wird zurueckgesetzt ...");
    try {
      localStorage.removeItem("tasklytic-build-version");
      sessionStorage.removeItem("tasklytic-recovery-reload-at");
      sessionStorage.removeItem("tasklytic-chunk-reload-at");
    } catch (error) {}
  }
  Promise.resolve()
    .then(unregisterServiceWorkers)
    .then(clearCaches)
    .then(clearStorage)
    .finally(function () {
      setStatus("Fertig. App wird neu geladen ...");
      setTimeout(function () { window.location.replace("/login"); }, 800);
    });
})();`;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4 text-slate-900">
      <section className="w-full max-w-md rounded-2xl bg-white p-5 text-center shadow-panel">
        <h1 className="text-lg font-semibold">Neue Version verfügbar</h1>
        <p id="reset-status" className="mt-2 text-sm text-slate-600">Tasklytic wird aktualisiert ...</p>
        <a href="/login" className="btn-primary mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold">
          Zum Login
        </a>
      </section>
      <script dangerouslySetInnerHTML={{ __html: resetScript }} />
    </main>
  );
}
