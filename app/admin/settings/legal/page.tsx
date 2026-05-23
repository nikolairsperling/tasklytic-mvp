"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader } from "@/components/admin/ui";

type LegalSettings = {
  imprintMode: "external" | "content";
  imprintUrl: string | null;
  imprintContent: string;
  privacyMode: "external" | "content";
  privacyUrl: string | null;
  privacyContent: string;
  cookiesMode: "external" | "content";
  cookiesUrl: string | null;
  cookiesContent: string;
};

const defaultSettings: LegalSettings = {
  imprintMode: "content",
  imprintUrl: "",
  imprintContent: "",
  privacyMode: "content",
  privacyUrl: "",
  privacyContent: "",
  cookiesMode: "content",
  cookiesUrl: "",
  cookiesContent: ""
};

const tabs = [
  { key: "imprint", label: "Impressum", mode: "imprintMode", url: "imprintUrl", content: "imprintContent", preview: "/legal/impressum" },
  { key: "privacy", label: "Datenschutz", mode: "privacyMode", url: "privacyUrl", content: "privacyContent", preview: "/legal/datenschutz" },
  { key: "cookies", label: "Cookies", mode: "cookiesMode", url: "cookiesUrl", content: "cookiesContent", preview: "/legal/cookies" }
] as const;

export default function LegalSettingsPage() {
  const [settings, setSettings] = useState<LegalSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("imprint");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const active = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  useEffect(() => {
    fetch("/api/settings/legal", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body) throw new Error(body?.error ?? "Rechtliche Einstellungen konnten nicht geladen werden.");
        setSettings({ ...defaultSettings, ...body });
      })
      .catch((error) => setMessage({ type: "error", text: error instanceof Error ? error.message : "Rechtliche Einstellungen konnten nicht geladen werden." }));
  }, []);

  function save() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/settings/legal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage({ type: "error", text: body?.error ?? "Rechtliche Einstellungen konnten nicht gespeichert werden." });
        return;
      }
      setSettings({ ...defaultSettings, ...body });
      setMessage({ type: "success", text: "Rechtliche Einstellungen gespeichert." });
    });
  }

  return (
    <div>
      <PageHeader title="Rechtliches" description="Impressum, Datenschutz und Cookie-Hinweis verwalten." backButton={<AdminBackButton href="/admin/settings" />} />
      {message ? <p className={`mb-4 rounded-xl px-4 py-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message.text}</p> : null}
      <AdminCard>
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Modus
            <select value={settings[active.mode]} onChange={(event) => setSettings((current) => ({ ...current, [active.mode]: event.target.value as "external" | "content" }))} className="min-h-11 rounded-xl border border-slate-200 px-3">
              <option value="external">Externer Link</option>
              <option value="content">Eigener Text</option>
            </select>
          </label>
          {settings[active.mode] === "external" ? (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Externe URL
              <input value={settings[active.url] ?? ""} onChange={(event) => setSettings((current) => ({ ...current, [active.url]: event.target.value }))} placeholder="https://..." className="min-h-11 rounded-xl border border-slate-200 px-3" />
            </label>
          ) : (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Eigener Text
              <textarea value={settings[active.content]} onChange={(event) => setSettings((current) => ({ ...current, [active.content]: event.target.value }))} rows={14} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={save} disabled={isPending} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
              Speichern
            </button>
            <Link href={settings[active.mode] === "external" && settings[active.url] ? settings[active.url] || active.preview : active.preview} target="_blank" className="btn-secondary rounded-xl px-4 py-2 text-sm font-semibold">
              Vorschau öffnen
            </Link>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
