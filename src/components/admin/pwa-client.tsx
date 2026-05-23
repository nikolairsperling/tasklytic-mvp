"use client";

import Link from "next/link";
import { Bell, Download, HelpCircle, RefreshCw, Settings, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { NotificationSettingsPayload } from "@/lib/notification-settings";

type PushStatus =
  | "checking"
  | "registering"
  | "active"
  | "permission_required"
  | "not_allowed"
  | "not_supported"
  | "ios_not_installed"
  | "https_required"
  | "needs_key"
  | "sw_inactive"
  | "idle"
  | "error";

type PushConfig = {
  enabled?: boolean;
  vapidPublicKey?: string | null;
};

type PushDebugInfo = {
  isIos: boolean;
  isStandalone: boolean;
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  vapidKeyPresent: boolean;
  serviceWorkerActive: boolean;
  serviceWorkerInstalling: boolean;
  serviceWorkerWaiting: boolean;
  subscriptionActive: boolean;
};

type PushSetupCardProps = {
  initialSettings?: NotificationSettingsPayload;
  mode?: "dashboard" | "settings";
};

const notificationSettingLabels: { key: keyof NotificationSettingsPayload; label: string }[] = [
  { key: "pushNewEmailEnabled", label: "Push bei neuer E-Mail" },
  { key: "pushReplyEnabled", label: "Push bei Antwort" },
  { key: "pushLeadEnrichmentEnabled", label: "Push bei Lead-Anreicherung" },
  { key: "pushFollowUpEnabled", label: "Push bei Follow-up" },
  { key: "pushCampaignStatusEnabled", label: "Push bei Kampagnenstatus" },
  { key: "pushErrorEnabled", label: "Push bei Fehlern" }
];

export function PwaClient() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") void ensureServiceWorkerRegistration();

    function updateOnlineState() {
      setOffline(!navigator.onLine);
    }

    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  return offline ? (
    <div className="fixed left-3 right-3 top-[calc(76px+env(safe-area-inset-top))] z-[140] mx-auto flex max-w-md items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 shadow-lg">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      Verbindung verloren
    </div>
  ) : null;
}

export function InstallPromptCard() {
  const [standalone, setStandalone] = useState(true);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    setStandalone(isStandalonePwa());
    const ua = navigator.userAgent.toLowerCase();
    setPlatform(/iphone|ipad|ipod/.test(ua) ? "ios" : /android/.test(ua) ? "android" : "other");
  }, []);

  if (standalone) return null;

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 md:hidden">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
          <Download className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">Tasklytic als App installieren</h2>
          <p className="mt-1 text-sm leading-5">
            {platform === "ios"
              ? "Teilen öffnen und zum Home-Bildschirm hinzufügen."
              : platform === "android"
                ? "Im Browsermenü App installieren wählen."
                : "Im Browsermenü Tasklytic zum Startbildschirm hinzufügen."}
          </p>
        </div>
      </div>
    </section>
  );
}

export function PushStatusCard() {
  const [status, setStatus] = useState<PushStatus>("checking");

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      const nextStatus = await getCurrentPushStatus();
      if (active) setStatus(nextStatus);
    }

    void checkStatus();
    return () => {
      active = false;
    };
  }, []);

  const statusText = getPushStatusText(status);

  return (
    <Link href="/admin/settings/notifications" className="block">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-panel">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink">Push-Benachrichtigungen</h2>
            <p className="mt-1 text-sm text-slate-500">Status: {statusText}</p>
          </div>
          <Settings className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        </div>
      </section>
    </Link>
  );
}

export function PushSetupCard({ initialSettings, mode = "settings" }: PushSetupCardProps) {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsPayload>(initialSettings ?? {
    pushNewEmailEnabled: true,
    pushReplyEnabled: true,
    pushLeadEnrichmentEnabled: true,
    pushFollowUpEnabled: true,
    pushCampaignStatusEnabled: true,
    pushErrorEnabled: true
  });
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);
  const [debug, setDebug] = useState<PushDebugInfo>({
    isIos: false,
    isStandalone: false,
    isSecureContext: false,
    hasServiceWorker: false,
    hasPushManager: false,
    notificationPermission: "unsupported",
    vapidKeyPresent: false,
    serviceWorkerActive: false,
    serviceWorkerInstalling: false,
    serviceWorkerWaiting: false,
    subscriptionActive: false
  });

  const statusText = useMemo(() => {
    return getPushStatusText(status);
  }, [status]);

  const statusHint = useMemo(() => {
    if (message) return message;
    if (status === "ios_not_installed") {
      return "Für Push-Benachrichtigungen bitte die App über Safari zum Home-Bildschirm hinzufügen.";
    }
    if (status === "https_required") {
      return isIpHostname()
        ? "Für Push-Benachrichtigungen wird eine HTTPS-Domain benötigt."
        : "Push-Benachrichtigungen benötigen HTTPS oder localhost.";
    }
    if (status === "needs_key") return "NEXT_PUBLIC_VAPID_PUBLIC_KEY fehlt. Hinterlege den Public Key und starte die App neu.";
    if (status === "sw_inactive") return "Push/PWA ist vorübergehend deaktiviert, bis die App ohne Service Worker stabil läuft.";
    if (status === "registering") return "Service Worker wird bereinigt ...";
    if (status === "permission_required") return "Browser-Berechtigung fehlt. Aktiviere Push, um die Abfrage zu starten.";
    if (status === "not_allowed") return "Push wurde im Browser blockiert. Ändere die Berechtigung in den Website-Einstellungen.";
    if (status === "idle") return "Push kann aktiviert werden.";
    if (status === "active") return "Push-Benachrichtigungen sind für dieses Gerät aktiv.";
    if (status === "error") return "Push-Status konnte nicht vollständig geprüft werden.";
    if (status === "not_supported") return "Dieser Browser unterstützt Web Push Notifications nicht.";
    return "";
  }, [message, status]);

  const canEnablePush = (status === "idle" || status === "permission_required") && !busy;
  const canDisablePush = hasSubscription && !busy;
  const canSendTest = hasSubscription && !busy;

  useEffect(() => {
    void refreshPushStatus();
  }, []);

  async function refreshPushStatus() {
    setMessage("");
    setStatus("checking");

    const environment = getPushEnvironment();
    setDebug((current) => ({
      ...current,
      ...environment,
      notificationPermission: typeof Notification !== "undefined" ? Notification.permission : "unsupported"
    }));

    if (environment.isIos && !environment.isStandalone) {
      setStatus("ios_not_installed");
      setHasSubscription(false);
      return;
    }

    if (!environment.isSecureContext) {
      setStatus("https_required");
      setHasSubscription(false);
      return;
    }

    if (!environment.hasServiceWorker || !environment.hasPushManager || typeof Notification === "undefined") {
      setStatus("not_supported");
      setHasSubscription(false);
      return;
    }

    setStatus("registering");
    const registration = await ensureServiceWorkerRegistration();
    if (!registration?.active || !("pushManager" in registration)) {
      setDebug((current) => ({ ...current, ...getServiceWorkerState(registration) }));
      setStatus("sw_inactive");
      setHasSubscription(false);
      return;
    }

    try {
      const config = await fetch("/api/push/subscribe", { cache: "no-store" }).then((response) => response.json()) as PushConfig;
      const vapidKeyPresent = Boolean(config.vapidPublicKey);
      setDebug((current) => ({ ...current, vapidKeyPresent, ...getServiceWorkerState(registration) }));
      if (!vapidKeyPresent) {
        setStatus("needs_key");
        setHasSubscription(false);
        return;
      }

      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setStatus("not_allowed");
        setHasSubscription(false);
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      const subscriptionActive = Boolean(subscription || config.enabled);
      setHasSubscription(subscriptionActive);
      setDebug((current) => ({ ...current, subscriptionActive, ...getServiceWorkerState(registration) }));
      setStatus(subscriptionActive ? "active" : Notification.permission === "granted" ? "idle" : "permission_required");
    } catch (error) {
      console.warn("[PWA] Push status check failed", error);
      setStatus("error");
      setHasSubscription(false);
    }
  }

  async function enablePush() {
    setBusy(true);
    setMessage("");
    try {
      const environment = getPushEnvironment();
      setDebug((current) => ({
        ...current,
        ...environment,
        notificationPermission: typeof Notification !== "undefined" ? Notification.permission : "unsupported"
      }));

      if (environment.isIos && !environment.isStandalone) {
        setStatus("ios_not_installed");
        return;
      }
      if (!environment.isSecureContext) {
        setStatus("https_required");
        return;
      }
      if (!environment.hasServiceWorker || !environment.hasPushManager || typeof Notification === "undefined") {
        setStatus("not_supported");
        return;
      }

      const config = await fetch("/api/push/subscribe", { cache: "no-store" }).then((response) => response.json()) as PushConfig;
      if (!config.vapidPublicKey) {
        setStatus("needs_key");
        setDebug((current) => ({ ...current, vapidKeyPresent: false }));
        return;
      }
      setDebug((current) => ({ ...current, vapidKeyPresent: true }));

      const registration = await ensureServiceWorkerRegistration();
      if (!registration?.active || !("pushManager" in registration)) {
        setDebug((current) => ({ ...current, ...getServiceWorkerState(registration) }));
        setStatus("sw_inactive");
        return;
      }
      setDebug((current) => ({ ...current, ...getServiceWorkerState(registration) }));

      if (Notification.permission === "denied") {
        setStatus("not_allowed");
        return;
      }

      const permission = await Notification.requestPermission();
      setDebug((current) => ({ ...current, notificationPermission: permission }));
      if (permission !== "granted") {
        setStatus("not_allowed");
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)
        });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });
      if (!response.ok) throw new Error("Subscription konnte nicht gespeichert werden.");
      setStatus("active");
      setHasSubscription(true);
      setDebug((current) => ({ ...current, subscriptionActive: true, ...getServiceWorkerState(registration) }));
      setMessage("Push-Benachrichtigungen sind aktiv.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Push konnte nicht aktiviert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const data = await response.json().catch(() => null) as { error?: string; notification?: { title?: string; body?: string; url?: string | null } } | null;
      if (!response.ok) throw new Error(data?.error ?? "Test-Push fehlgeschlagen.");
      const registration = await ensureServiceWorkerRegistration();
      if (!registration?.active) throw new Error("Service Worker nicht aktiv.");
      registration.active.postMessage({
        type: "TASKLYTIC_TEST_NOTIFICATION",
        title: data?.notification?.title ?? "Tasklytic",
        body: data?.notification?.body ?? "Test-Benachrichtigung",
        url: data?.notification?.url ?? "/admin/dashboard"
      });
      setMessage("Test-Benachrichtigung gesendet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test-Push fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await ensureServiceWorkerRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();

      const response = await fetch("/api/push/subscribe", { method: "DELETE" });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Push konnte nicht deaktiviert werden.");

      setStatus("idle");
      setHasSubscription(false);
      setDebug((current) => ({ ...current, subscriptionActive: false }));
      setMessage("Push-Benachrichtigungen sind deaktiviert.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Push konnte nicht deaktiviert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function repairServiceWorker() {
    setRepairBusy(true);
    setBusy(true);
    setMessage("Service Worker wird entfernt ...");
    setStatus("registering");
    try {
      await resetAndRegisterServiceWorker();
      window.location.reload();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Service Worker konnte nicht neu registriert werden.");
      setRepairBusy(false);
      setBusy(false);
    }
  }

  async function updateNotificationSetting(key: keyof NotificationSettingsPayload, value: boolean) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    setSettingsBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings)
      });
      const data = await response.json().catch(() => null) as NotificationSettingsPayload | { error?: string } | null;
      if (!response.ok || !data) throw new Error(readApiError(data) ?? "Einstellung konnte nicht gespeichert werden.");
      if (isApiError(data)) throw new Error(data.error ?? "Einstellung konnte nicht gespeichert werden.");
      setSettings(data);
      setMessage("Benachrichtigungseinstellungen gespeichert.");
    } catch (error) {
      setSettings(settings);
      setMessage(error instanceof Error ? error.message : "Einstellung konnte nicht gespeichert werden.");
    } finally {
      setSettingsBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">Push-Benachrichtigungen</h2>
          <p className="mt-1 text-sm text-slate-500">Status: {statusText}</p>
        </div>
        <Bell className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      </div>

      {statusHint ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusHint}</p> : null}

      {status === "ios_not_installed" ? (
        <div className="mt-3 space-y-3">
          <button
            type="button"
            onClick={() => setShowGuide((value) => !value)}
            className="btn-secondary inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            Anleitung anzeigen
          </button>
          {showGuide ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              <p className="font-semibold">So aktivierst du Push auf dem iPhone</p>
              <ol className="mt-2 space-y-1 pl-4">
                <li>1. In Safari die Teilen-Schaltfläche öffnen.</li>
                <li>2. "Zum Home-Bildschirm" wählen.</li>
                <li>3. Tasklytic über das App-Icon starten.</li>
                <li>4. Danach Push erneut aktivieren.</li>
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={enablePush}
          disabled={!canEnablePush}
          className="btn-primary inline-flex min-h-[52px] items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Bitte warten..." : "Push aktivieren"}
        </button>
        <button
          type="button"
          onClick={disablePush}
          disabled={!canDisablePush}
          className="btn-secondary inline-flex min-h-[52px] items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          Push deaktivieren
        </button>
        <button
          type="button"
          onClick={sendTest}
          disabled={!canSendTest}
          className="btn-secondary inline-flex min-h-[52px] items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          Test senden
        </button>
      </div>

      {mode === "settings" ? (
        <div className="mt-5 space-y-3">
          {notificationSettingLabels.map((item) => (
            <label key={item.key} className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-ink">
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={settings[item.key]}
                disabled={settingsBusy}
                onChange={(event) => void updateNotificationSetting(item.key, event.target.checked)}
                className="h-4 w-4"
              />
            </label>
          ))}

          <div className="rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left font-semibold text-ink"
              aria-expanded={showAdvanced}
            >
              <span>Erweitert</span>
              <span className="text-xs text-slate-500">{showAdvanced ? "Einklappen" : "Ausklappen"}</span>
            </button>
            {showAdvanced ? (
              <dl className="grid grid-cols-1 gap-2 border-t border-slate-200 p-3 sm:grid-cols-2">
                <DebugRow label="iPhone erkannt" value={debug.isIos ? "ja" : "nein"} />
                <DebugRow label="Standalone" value={debug.isStandalone ? "ja" : "nein"} />
                <DebugRow label="Secure Context" value={debug.isSecureContext ? "ja" : "nein"} />
                <DebugRow label="Service Worker" value={debug.hasServiceWorker ? "ja" : "nein"} />
                <DebugRow label="SW aktiv" value={debug.serviceWorkerActive ? "aktiv" : "inaktiv"} />
                <DebugRow label="SW installing" value={debug.serviceWorkerInstalling ? "ja" : "nein"} />
                <DebugRow label="SW waiting" value={debug.serviceWorkerWaiting ? "ja" : "nein"} />
                <DebugRow label="PushManager" value={debug.hasPushManager ? "ja" : "nein"} />
                <DebugRow label="Notification" value={debug.notificationPermission} />
                <DebugRow label="VAPID Key" value={debug.vapidKeyPresent ? "vorhanden" : "fehlt"} />
                <DebugRow label="Subscription" value={debug.subscriptionActive ? "aktiv" : "inaktiv"} />
                <button
                  type="button"
                  onClick={repairServiceWorker}
                  disabled={repairBusy}
                  className="btn-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {repairBusy ? "Entfernt ..." : "Service Worker entfernen"}
                </button>
              </dl>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-slate-500">{message}</p> : null}
    </section>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function getPushEnvironment() {
  const userAgent = typeof navigator.userAgent === "string" ? navigator.userAgent.toLowerCase() : "";
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isStandalone = isStandalonePwa();
  const isSecureContext = (Boolean(window.isSecureContext) && !isIpHostname()) || isLocalhost();
  return {
    isIos,
    isStandalone,
    isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    notificationPermission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
    vapidKeyPresent: false
  } satisfies Omit<PushDebugInfo, "serviceWorkerActive" | "serviceWorkerInstalling" | "serviceWorkerWaiting" | "subscriptionActive">;
}

async function getCurrentPushStatus(): Promise<PushStatus> {
  try {
    const environment = getPushEnvironment();
    if (environment.isIos && !environment.isStandalone) return "ios_not_installed";
    if (!environment.isSecureContext) return "https_required";
    if (!environment.hasServiceWorker || !environment.hasPushManager) return "not_supported";
    if (typeof Notification === "undefined") return "not_supported";

    const registration = await ensureServiceWorkerRegistration();
    if (!registration?.active || !("pushManager" in registration)) return "sw_inactive";

    const config = await fetch("/api/push/subscribe", { cache: "no-store" }).then((response) => response.json()) as PushConfig;
    if (!config.vapidPublicKey) return "needs_key";
    if (Notification.permission === "denied") return "not_allowed";
    const subscription = await registration.pushManager.getSubscription();
    return subscription || config.enabled ? "active" : Notification.permission === "granted" ? "idle" : "permission_required";
  } catch {
    return "error";
  }
}

function getPushStatusText(status: PushStatus) {
  if (status === "active") return "Push aktiv";
  if (status === "permission_required") return "Berechtigung fehlt";
  if (status === "not_allowed") return "Nicht erlaubt";
  if (status === "not_supported") return "Nicht unterstützt";
  if (status === "ios_not_installed") return "Nur als installierte App verfügbar";
  if (status === "https_required") return "HTTPS erforderlich";
  if (status === "needs_key") return "VAPID-Key fehlt";
  if (status === "sw_inactive") return "PWA deaktiviert";
  if (status === "error") return "Fehler";
  if (status === "registering") return "Service Worker wird entfernt ...";
  if (status === "checking") return "Prüft...";
  return "Push bereit";
}

function isApiError(value: unknown): value is { error?: string } {
  return Boolean(value && typeof value === "object" && "error" in value);
}

function readApiError(value: unknown) {
  return isApiError(value) ? value.error : undefined;
}

function isStandalonePwa() {
  const standaloneNavigator = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) || standaloneNavigator;
}

function isLocalhost() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "::1";
}

function isIpHostname() {
  const hostname = window.location.hostname;
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || /^\[[0-9a-f:]+\]$/i.test(hostname) || (/^[0-9a-f:]+$/i.test(hostname) && hostname.includes(":"));
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  await unregisterTasklyticServiceWorkers();
  return null;
}

function getServiceWorkerState(registration: ServiceWorkerRegistration | null | undefined) {
  return {
    serviceWorkerActive: Boolean(registration?.active),
    serviceWorkerInstalling: Boolean(registration?.installing),
    serviceWorkerWaiting: Boolean(registration?.waiting)
  };
}

async function resetAndRegisterServiceWorker() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  if (!canUseServiceWorkerOnCurrentOrigin()) throw new Error("Service Worker benötigen HTTPS oder localhost.");

  await unregisterTasklyticServiceWorkers();
  return null;
}

async function unregisterTasklyticServiceWorkers() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.all(registrations.map(async (registration) => {
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    if (registration.active) registration.active.postMessage({ type: "CLEAR_OLD_CACHES" });
    await registration.unregister().catch(() => false);
  }));

  if ("caches" in window) {
    const keys = await window.caches.keys().catch(() => []);
    await Promise.all(keys.filter((key) => key.startsWith("tasklytic-")).map((key) => window.caches.delete(key).catch(() => false)));
  }
}

function canUseServiceWorkerOnCurrentOrigin() {
  return window.location.protocol === "https:" || isLocalhost();
}
