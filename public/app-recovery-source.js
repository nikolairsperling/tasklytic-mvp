(function () {
  var reloadKey = "tasklytic-recovery-reload-at";
  var versionKey = "tasklytic-app-version";
  var cacheVersionKey = "tasklytic-cache-version";
  var lastCssStatus = "unknown";
  var lastJsStatus = "unknown";
  var lastChunkStatus = "unknown";
  var lastSwStatus = "unknown";
  var currentBuildId = "unknown";

  function readCurrentBuildId() {
    try {
      var marker = document.querySelector('meta[name="tasklytic-build-id"]');
      if (marker && marker.content) return marker.content;
    } catch (error) {}
    try {
      var stored = localStorage.getItem(versionKey);
      if (stored) return stored;
    } catch (error) {}
    return currentBuildId;
  }

  function logStatus(reason, extra) {
    try {
      currentBuildId = readCurrentBuildId();
      console.info("[tasklytic:asset-status]", {
        reason: reason,
        css: lastCssStatus,
        js: lastJsStatus,
        chunk: lastChunkStatus,
        serviceWorker: lastSwStatus,
        cacheVersion: localStorage.getItem(cacheVersionKey),
        appVersion: localStorage.getItem(versionKey),
        buildId: currentBuildId,
        pathname: window.location.pathname,
        extra: extra || null
      });
    } catch (error) {}
  }

  function clearTasklyticCaches() {
    if (!("caches" in window)) return Promise.resolve();
    return caches.keys()
      .then(function (keys) {
        try { console.info("[tasklytic:cache]", { keys: keys, deleting: keys }); } catch (error) {}
        return Promise.all(keys.map(function (key) { return caches.delete(key).catch(function () { return false; }); }));
      })
      .catch(function () {});
  }

  function unregisterServiceWorkers() {
    if (!("serviceWorker" in navigator)) return Promise.resolve();
    return navigator.serviceWorker.getRegistrations()
      .then(function (registrations) {
        lastSwStatus = registrations.length ? "registered:" + registrations.length : "none";
        try { console.info("[tasklytic:service-worker]", { registrations: registrations.length }); } catch (error) {}
        return Promise.all(registrations.map(function (registration) {
          try {
            if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
            if (registration.active) registration.active.postMessage({ type: "CLEAR_OLD_CACHES" });
          } catch (error) {}
          return registration.unregister().catch(function () { return false; });
        }));
      })
      .catch(function () {});
  }

  window.__TASKLYTIC_DISABLE_SERVICE_WORKER__ = function () {
    return unregisterServiceWorkers().then(clearTasklyticCaches);
  };

  function shouldReloadOnce() {
    try {
      var previous = Number(sessionStorage.getItem(reloadKey) || "0");
      if (previous && Date.now() - previous < 60000) return false;
      sessionStorage.setItem(reloadKey, String(Date.now()));
      return true;
    } catch (error) {
      return false;
    }
  }

  function selfHeal(reason, detail) {
    logStatus(reason, detail);
    if (!shouldReloadOnce()) return false;
    window.__TASKLYTIC_DISABLE_SERVICE_WORKER__()
      .finally(function () {
        var isChunkFailure = /chunk|next-script|script-error|asset-load-failed/i.test(String(reason || ""));
        var target = isChunkFailure ? "/login?fresh=" + Date.now() : window.location.href;
        try {
          if (isChunkFailure) window.location.href = target;
          else window.location.reload();
        } catch (error) {
          window.location.href = target;
        }
      });
    return true;
  }

  function showLoadFailure(reason, detail) {
    logStatus(reason, detail);
    if (document.documentElement && document.documentElement.dataset.tasklyticLoadFailure === "1") return;
    if (document.documentElement) document.documentElement.dataset.tasklyticLoadFailure = "1";
    var failedFile = detail && detail.scriptUrl ? String(detail.scriptUrl) : "";
    var failedFileHtml = failedFile
      ? '<p style="font-size:12px;line-height:1.5;margin:0 0 18px;color:#64748b;word-break:break-all;">Fehlerhafte Datei: ' + escapeHtml(failedFile) + '</p>'
      : "";
    var html = [
      '<main style="min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;padding:24px;">',
      '<section style="width:100%;max-width:420px;border:1px solid #e2e8f0;background:white;border-radius:16px;padding:24px;box-shadow:0 20px 45px rgba(15,23,42,.12);text-align:center;">',
      '<h1 style="font-size:20px;line-height:1.3;margin:0 0 10px;font-weight:700;">Tasklytic konnte nicht vollständig geladen werden.</h1>',
      '<p style="font-size:14px;line-height:1.6;margin:0 0 18px;color:#475569;">CSS oder JavaScript wurde nicht korrekt geladen. Bitte lade die App neu.</p>',
      failedFileHtml,
      '<button type="button" onclick="window.__TASKLYTIC_DISABLE_SERVICE_WORKER__&&window.__TASKLYTIC_DISABLE_SERVICE_WORKER__().finally(function(){window.location.reload();})" style="min-height:44px;border:0;border-radius:12px;background:#2563eb;color:white;padding:10px 16px;font-weight:700;cursor:pointer;">App neu laden</button>',
      '</section>',
      '</main>'
    ].join("");
    if (document.body) document.body.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char;
    });
  }

  function isNextCssLink(link) {
    return Boolean(link && link.tagName === "LINK" && link.rel === "stylesheet" && /\/_next\/static\/css\//.test(link.href || ""));
  }

  function isNextChunkScript(script) {
    return Boolean(script && script.tagName === "SCRIPT" && /\/_next\/static\/chunks\/[^?#]+\.js(?:[?#]|$)/.test(script.src || ""));
  }

  function handleFailedAssets(reason, detail) {
    if (!selfHeal(reason, detail)) showLoadFailure(reason + "-after-retry", detail);
  }

  function verifyAssets() {
    var stylesheets = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"][href*="/_next/static/css"]'));
    var scripts = Array.prototype.slice.call(document.querySelectorAll('script[src*="/_next/static/"]'));
    var failedStylesheet = stylesheets.some(function (link) { return link.dataset.tasklyticFailed === "1"; });
    var failedScript = scripts.some(function (script) { return script.dataset.tasklyticFailed === "1" && isNextChunkScript(script); });
    lastCssStatus = failedStylesheet ? "failed" : stylesheets.length ? "link-present" : "no-next-css-link";
    lastJsStatus = failedScript ? "failed" : scripts.length ? "loaded" : "no-next-js";
    logStatus("verify-assets", { stylesheetCount: stylesheets.length, scriptCount: scripts.length });
    if (failedStylesheet || failedScript) {
      handleFailedAssets("asset-load-failed", { failedStylesheet: failedStylesheet, failedScript: failedScript });
    } else if (document.documentElement) {
      document.documentElement.dataset.tasklyticLoadFailure = "0";
    }
  }

  window.addEventListener("error", function (event) {
    var target = event && event.target;
    if (!target) return;
    var url = target.src || target.href || "";
    currentBuildId = readCurrentBuildId();
    if (target.tagName === "SCRIPT" && !isNextChunkScript(target)) {
      logStatus("ignored-script-error", {
        scriptUrl: url,
        outerHTML: target.outerHTML || "",
        buildId: currentBuildId,
        pathname: window.location.pathname
      });
      return;
    }
    if (isNextChunkScript(target)) {
      target.dataset.tasklyticFailed = "1";
      lastJsStatus = "failed";
      lastChunkStatus = "script-error";
      try {
        console.warn("TASKLYTIC_FAILED_SCRIPT_URL", url);
      } catch (error) {}
      handleFailedAssets("next-script-error", {
        scriptUrl: url,
        outerHTML: target.outerHTML || "",
        buildId: currentBuildId,
        pathname: window.location.pathname
      });
    }
    if (isNextCssLink(target)) {
      target.dataset.tasklyticFailed = "1";
      lastCssStatus = "failed";
    }
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason;
    var message = reason && (reason.message || reason.name) ? String(reason.name || "") + " " + String(reason.message || "") : String(reason || "");
    if (/ChunkLoadError|Loading chunk|failed to fetch dynamically imported module|Importing a module script failed|Loading CSS chunk/i.test(message)) {
      currentBuildId = readCurrentBuildId();
      lastChunkStatus = "chunk-error";
      try {
        console.warn("TASKLYTIC_FAILED_SCRIPT_URL", message);
      } catch (error) {}
      var detail = { scriptUrl: message, outerHTML: "", buildId: currentBuildId, pathname: window.location.pathname, message: message };
      if (!selfHeal("chunk-error", detail)) showLoadFailure("chunk-error-after-retry", detail);
    }
  });

  function checkVersion() {
    return fetch("/app-version.json?ts=" + Date.now(), { cache: "no-store" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (!data || !data.version) return;
        var current = localStorage.getItem(versionKey);
        var next = String(data.version);
        currentBuildId = next;
        logStatus("version-check", { current: current, next: next });
        if (current && current !== next) {
          localStorage.setItem(versionKey, next);
          localStorage.setItem(cacheVersionKey, next);
          return window.__TASKLYTIC_DISABLE_SERVICE_WORKER__();
        }
        localStorage.setItem(versionKey, next);
        localStorage.setItem(cacheVersionKey, next);
      })
      .catch(function (error) {
        logStatus("version-check-failed", { message: error && error.message ? error.message : String(error) });
      });
  }

  window.addEventListener("load", function () {
    checkVersion().finally(function () {
      window.setTimeout(verifyAssets, 2000);
    });
  });

  unregisterServiceWorkers().then(function () {
    logStatus("startup-service-worker-check");
  });
})();
