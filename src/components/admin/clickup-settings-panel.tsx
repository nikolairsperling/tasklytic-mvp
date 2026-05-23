"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, StatusBadge } from "@/components/admin/ui";

type ClickUpSettings = {
  enabled: boolean;
  tokenSet: boolean;
  config: Record<string, string | undefined>;
};

export function ClickUpSettingsPanel({ settings }: { settings: ClickUpSettings }) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(formData: FormData) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/settings/clickup", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: formData.get("enabled") === "on",
            apiToken: formData.get("apiToken"),
            teamId: formData.get("teamId"),
            spaceId: formData.get("spaceId"),
            folderId: formData.get("folderId"),
            listId: formData.get("listId"),
            defaultAssignee: formData.get("defaultAssignee")
          })
        });
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) throw new Error(body?.error ?? "Speichern fehlgeschlagen.");
        setMessage({ type: "success", text: "ClickUp Einstellungen gespeichert." });
        window.location.reload();
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Speichern fehlgeschlagen." });
      }
    });
  }

  async function post(url: string, success: string) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(url, { method: "POST" });
        const body = (await response.json().catch(() => null)) as { error?: string; result?: { message?: string } } | null;
        if (!response.ok) throw new Error(body?.error ?? "Aktion fehlgeschlagen.");
        setMessage({ type: "success", text: body?.result?.message ?? success });
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Aktion fehlgeschlagen." });
      }
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
        <div>
          <p className="text-sm font-medium text-ink">ClickUp Status</p>
          <p className="mt-1 text-sm text-slate-500">API Token wird verschlüsselt gespeichert und nie angezeigt.</p>
        </div>
        <StatusBadge tone={settings.tokenSet ? "green" : "neutral"}>{settings.tokenSet ? "Token gesetzt" : "kein Token"}</StatusBadge>
      </div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save(new FormData(event.currentTarget)); }}>
        <label className="flex min-h-11 items-center gap-3 md:col-span-2">
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="h-4 w-4" />
          <span className="text-sm font-medium text-slate-600">Aktiv</span>
        </label>
        <Field label="ClickUp API Token" name="apiToken" type="password" placeholder={settings.tokenSet ? "Token gesetzt, leer lassen zum Beibehalten" : "Token eingeben"} />
        <Field label="Team/Workspace ID" name="teamId" defaultValue={settings.config.teamId ?? ""} />
        <Field label="Space ID" name="spaceId" defaultValue={settings.config.spaceId ?? ""} />
        <Field label="Folder ID optional" name="folderId" defaultValue={settings.config.folderId ?? ""} />
        <Field label="List ID" name="listId" defaultValue={settings.config.listId ?? ""} />
        <Field label="Default Assignee optional" name="defaultAssignee" defaultValue={settings.config.defaultAssignee ?? ""} />
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <PrimaryButton type="submit" disabled={isPending}>Speichern</PrimaryButton>
          <PrimaryButton onClick={() => void post("/api/settings/clickup/test", "ClickUp verbunden: Liste gefunden")} disabled={isPending}>Verbindung testen</PrimaryButton>
          <PrimaryButton onClick={() => void post("/api/settings/clickup/test-task", "ClickUp Test-Task erstellt.")} disabled={isPending}>Test-Task erstellen</PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", placeholder }: { label: string; name: string; defaultValue?: string; type?: string; placeholder?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
    </label>
  );
}
