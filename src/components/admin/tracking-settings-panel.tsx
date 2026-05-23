"use client";

import React, { useMemo, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import type { TrackingSettingsPayload } from "@/lib/app-settings";

export function TrackingSettingsPanel({ settings }: { settings: TrackingSettingsPayload }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [testToken, setTestToken] = useState("test-token");

  const testLink = useMemo(() => {
    const base = form.trackingDomain?.trim()
      ? /^https?:\/\//i.test(form.trackingDomain)
        ? form.trackingDomain.replace(/\/$/, "")
        : `https://${form.trackingDomain.replace(/\/$/, "")}`
      : "";
    return `${base}/api/track/click/${testToken || "test-token"}`;
  }, [form.trackingDomain, testToken]);

  function update<K extends keyof TrackingSettingsPayload>(key: K, value: TrackingSettingsPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/settings/tracking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json().catch(() => null)) as TrackingSettingsPayload | { error?: string } | null;
      if (!response.ok) {
        setMessage({ type: "error", text: data && "error" in data ? data.error ?? "Speichern fehlgeschlagen." : "Speichern fehlgeschlagen." });
        return;
      }
      setForm(data as TrackingSettingsPayload);
      setMessage({ type: "success", text: "Tracking Einstellungen gespeichert." });
    });
  }

  return (
    <div>
      <PageHeader title="Tracking Einstellungen" description="Open- und Click-Tracking für Kampagnenmails steuern." backButton={<AdminBackButton href="/admin/settings" />} />
      {message ? (
        <p className={`mb-4 rounded-2xl px-4 py-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AdminCard>
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle label="Open Tracking aktivieren" checked={form.openTrackingEnabled} onChange={(checked) => update("openTrackingEnabled", checked)} />
            <Toggle label="Click Tracking aktivieren" checked={form.clickTrackingEnabled} onChange={(checked) => update("clickTrackingEnabled", checked)} />

            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate">Tracking Domain</span>
              <input value={form.trackingDomain ?? ""} onChange={(event) => update("trackingDomain", event.target.value || null)} placeholder="tracking.example.com" />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Consent Modus</span>
              <select value={form.trackingConsentMode} onChange={(event) => update("trackingConsentMode", event.target.value as TrackingSettingsPayload["trackingConsentMode"])}>
                <option value="legitimate_interest">Berechtigtes Interesse</option>
                <option value="consent_required">Einwilligung erforderlich</option>
                <option value="disabled">Tracking deaktiviert</option>
              </select>
            </label>

            <Toggle label="UTM Parameter anhängen" checked={form.appendUtmParams} onChange={(checked) => update("appendUtmParams", checked)} />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">UTM Source</span>
              <input value={form.utmSource} onChange={(event) => update("utmSource", event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">UTM Medium</span>
              <input value={form.utmMedium} onChange={(event) => update("utmMedium", event.target.value)} />
            </label>
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate">UTM Campaign</span>
              <input value={form.utmCampaign} onChange={(event) => update("utmCampaign", event.target.value)} />
            </label>
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate">Datenschutz-Hinweis</span>
              <textarea rows={5} value={form.privacyNoticeText} onChange={(event) => update("privacyNoticeText", event.target.value)} />
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={save} disabled={isPending} className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
              Speichern
            </button>
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Testlink</h2>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate">Token</span>
            <input value={testToken} onChange={(event) => setTestToken(event.target.value)} />
          </label>
          <button type="button" onClick={() => setTestToken(`test-${Date.now()}`)} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            Testlink generieren
          </button>
          <p className="mt-4 break-all rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{testLink}</p>
        </AdminCard>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5" />
    </label>
  );
}
