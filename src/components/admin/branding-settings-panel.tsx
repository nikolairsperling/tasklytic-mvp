"use client";

import { useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AssetFilePicker } from "@/components/admin/asset-file-picker";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import type { DesignSettingsPayload } from "@/lib/app-settings";
import { imageUrlHint, isDirectImageUrl } from "@/lib/image-url";

export function BrandingSettingsPanel({ settings }: { settings: DesignSettingsPayload }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof DesignSettingsPayload>(key: K, value: DesignSettingsPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  function save() {
    if ((form.logoUrl && !isDirectImageUrl(form.logoUrl)) || (form.iconUrl && !isDirectImageUrl(form.iconUrl))) {
      setMessage(imageUrlHint);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/settings/design", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(response.ok ? "Branding gespeichert." : data?.error ?? "Speichern fehlgeschlagen.");
    });
  }

  return (
    <div>
      <PageHeader title="Branding" description="App Name, Logo, Icon und Farben fuer Tasklytic konfigurieren." backButton={<AdminBackButton href="/admin/settings" />} />
      {message ? <p className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}
      <AdminCard>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate">App Name</span>
            <input value={form.appName} onChange={(event) => update("appName", event.target.value)} />
          </label>
          <ColorInput label="Primärfarbe" value={form.primaryColor} onChange={(value) => update("primaryColor", value)} />
          <ColorInput label="Sekundärfarbe" value={form.secondaryColor} onChange={(value) => update("secondaryColor", value)} />
          <ColorInput label="Akzentfarbe" value={form.accentColor} onChange={(value) => update("accentColor", value)} />
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate">Logo URL</span>
            <input value={form.logoUrl ?? ""} onChange={(event) => update("logoUrl", event.target.value || null)} />
            {form.logoUrl && !isDirectImageUrl(form.logoUrl) ? <span className="block text-xs text-red-600">{imageUrlHint}</span> : null}
          </label>
          <div className="md:col-span-2"><AssetFilePicker label="Logo hochladen" type="logo" onSelect={(url) => update("logoUrl", url)} /></div>
          {form.logoUrl && isDirectImageUrl(form.logoUrl) ? (
            <div className="md:col-span-2">
              <img src={form.logoUrl} alt="Logo" className="h-20 max-w-xs rounded-xl border border-slate-200 bg-white object-contain p-3" />
            </div>
          ) : null}
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate">Icon URL</span>
            <input value={form.iconUrl ?? ""} onChange={(event) => update("iconUrl", event.target.value || null)} />
            {form.iconUrl && !isDirectImageUrl(form.iconUrl) ? <span className="block text-xs text-red-600">{imageUrlHint}</span> : null}
          </label>
          <div className="md:col-span-2"><AssetFilePicker label="Icon hochladen" type="logo" onSelect={(url) => update("iconUrl", url)} /></div>
          {form.iconUrl && isDirectImageUrl(form.iconUrl) ? (
            <div className="md:col-span-2">
              <img src={form.iconUrl} alt="Icon" className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-contain p-2" />
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={save} disabled={isPending} className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">Speichern</button>
        </div>
      </AdminCard>
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
