"use client";

import React, { useState, useTransition } from "react";
import type { CallingSettingsPayload } from "@/lib/app-settings";

type CallingSettingsPanelProps = {
  settings: CallingSettingsPayload;
};

export function CallingSettingsPanel({ settings }: CallingSettingsPanelProps) {
  const [ownPhoneNumber, setOwnPhoneNumber] = useState(settings.ownPhoneNumber ?? "");
  const [defaultCountryDialCode, setDefaultCountryDialCode] = useState(settings.defaultCountryDialCode ?? "+49");
  const [callProviderMode, setCallProviderMode] = useState(settings.callProviderMode);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveSettings() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/settings/calling", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownPhoneNumber: ownPhoneNumber.trim() || null,
            defaultCountryDialCode,
            callProviderMode,
            voiceAiProvider: settings.voiceAiProvider,
            voiceAiDefaultVoice: settings.voiceAiDefaultVoice,
            voiceAiEnabled: settings.voiceAiEnabled
          })
        });
        const body = (await response.json().catch(() => null)) as Partial<CallingSettingsPayload> & { error?: string } | null;
        if (!response.ok || !body || body.error) {
          throw new Error(body?.error ?? "Calling Einstellungen konnten nicht gespeichert werden.");
        }
        setOwnPhoneNumber(body.ownPhoneNumber ?? "");
        setDefaultCountryDialCode(body.defaultCountryDialCode ?? "+49");
        setCallProviderMode(body.callProviderMode ?? "tel-link");
        setMessage("Calling Einstellungen gespeichert.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Calling Einstellungen konnten nicht gespeichert werden.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Eigene Telefonnummer</span>
          <input
            value={ownPhoneNumber}
            onChange={(event) => setOwnPhoneNumber(event.target.value)}
            placeholder="+49 30 123456"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Standard-Ländervorwahl</span>
          <input
            value={defaultCountryDialCode}
            onChange={(event) => setDefaultCountryDialCode(event.target.value)}
            placeholder="+49"
          />
        </label>
        <label className="block space-y-1 md:col-span-2">
          <span className="text-sm font-medium text-slate-600">Call Provider Modus</span>
          <select value={callProviderMode} onChange={(event) => setCallProviderMode(event.target.value as CallingSettingsPayload["callProviderMode"])}>
            <option value="tel-link">tel-link</option>
            <option value="sip">sip</option>
            <option value="twilio">twilio</option>
          </select>
        </label>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={saveSettings} disabled={isPending} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
          {isPending ? "Speichert..." : "Speichern"}
        </button>
      </div>
    </div>
  );
}
