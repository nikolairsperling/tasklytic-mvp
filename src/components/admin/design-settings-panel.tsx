"use client";

import React, { useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import type { DesignSettingsPayload } from "@/lib/app-settings";
import { fontStack } from "@/lib/fonts";

const fonts: NonNullable<DesignSettingsPayload["selectedFont"]>[] = ["Inter", "Lato"];

export function DesignSettingsPanel({ settings }: { settings: DesignSettingsPayload }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof DesignSettingsPayload>(key: K, value: DesignSettingsPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/settings/design", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json().catch(() => null)) as DesignSettingsPayload | { error?: string } | null;
      if (!response.ok) {
        setMessage({ type: "error", text: data && "error" in data ? data.error ?? "Speichern fehlgeschlagen." : "Speichern fehlgeschlagen." });
        return;
      }
      setForm(data as DesignSettingsPayload);
      setMessage({ type: "success", text: "Design Einstellungen gespeichert." });
      window.dispatchEvent(new CustomEvent("tasklytic-design-settings-updated", { detail: data }));
    });
  }

  return (
    <div>
      <PageHeader title="Design Einstellungen" description="Globales Admin- und Landingpage-Design konfigurieren." backButton={<AdminBackButton href="/admin/settings" />} />
      {message ? (
        <p className={`mb-4 rounded-2xl px-4 py-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <AdminCard>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Theme</span>
              <select value={form.themeMode} onChange={(event) => update("themeMode", event.target.value as DesignSettingsPayload["themeMode"])}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Schriftart</span>
              <select
                value={fonts.includes(form.selectedFont as NonNullable<DesignSettingsPayload["selectedFont"]>) ? form.selectedFont : "Inter"}
                onChange={(event) => {
                  const selectedFont = event.target.value as NonNullable<DesignSettingsPayload["selectedFont"]>;
                  setForm((current) => ({ ...current, selectedFont, fontFamily: selectedFont }));
                }}
              >
                {fonts.map((font) => <option key={font} value={font}>{font}</option>)}
              </select>
            </label>

            <ColorInput label="Primary Color" value={form.primaryColor} onChange={(value) => update("primaryColor", value)} />
            <ColorInput label="Accent Color" value={form.accentColor} onChange={(value) => update("accentColor", value)} />
            <ColorInput label="Background Color" value={form.backgroundColor} onChange={(value) => update("backgroundColor", value)} />
            <ColorInput label="Text Color" value={form.textColor} onChange={(value) => update("textColor", value)} />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Button Radius</span>
              <input type="number" min={0} max={32} value={form.buttonRadius} onChange={(event) => update("buttonRadius", Number(event.target.value))} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Card Radius</span>
              <input type="number" min={0} max={32} value={form.cardRadius} onChange={(event) => update("cardRadius", Number(event.target.value))} />
            </label>
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate">Logo URL</span>
              <input type="url" value={form.logoUrl ?? ""} onChange={(event) => update("logoUrl", event.target.value || null)} />
            </label>
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate">Favicon URL</span>
              <input type="url" value={form.faviconUrl ?? ""} onChange={(event) => update("faviconUrl", event.target.value || null)} />
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={save} disabled={isPending} className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
              Speichern
            </button>
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Live Preview</h2>
          <div
            className="mt-4 rounded-2xl border p-5"
            style={{
              backgroundColor: form.backgroundColor,
              color: form.textColor,
              borderRadius: form.cardRadius,
              fontFamily: fontStack(form.selectedFont ?? form.fontFamily)
            }}
          >
            <div className="flex items-center gap-3">
              {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" /> : <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: form.primaryColor }} />}
              <div>
                <p className="font-semibold">Tasklytic</p>
                <p className="text-sm opacity-75">Preview Card</p>
              </div>
            </div>
            <p className="mt-4 text-sm opacity-80">So wirken Karten, Text und Akzentfarbe mit den gespeicherten Werten.</p>
            <button type="button" className="btn-primary mt-5 px-4 py-2 text-sm font-semibold" style={{ borderRadius: form.buttonRadius }}>
              Aktion
            </button>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <div className="flex gap-3">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-14 p-1" />
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}
