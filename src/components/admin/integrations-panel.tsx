"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, StatusBadge } from "@/components/admin/ui";

export function IntegrationsPanel({ settings }: { settings: any }) {
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const openAiConnected = currentSettings.openai.keySet;
  const openAiSource = currentSettings.openai.source === "db"
    ? "gespeichert"
    : currentSettings.openai.source === "env"
      ? ".env"
      : "keine";

  function save(formData: FormData, type: "slack" | "clickup" | "openai") {
    startTransition(async () => {
      const response = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...Object.fromEntries(formData.entries()), enabled: formData.get("enabled") === "on" })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | typeof currentSettings | null;
      if (response.ok && data && !("error" in data)) {
        setCurrentSettings(data);
        setMessage(type === "openai" ? "OpenAI Einstellungen gespeichert." : "Integration gespeichert.");
        eventTargetReset(type);
        return;
      }
      setMessage(data && "error" in data ? data.error ?? "Speichern fehlgeschlagen." : "Speichern fehlgeschlagen.");
    });
  }

  function post(url: string) {
    startTransition(async () => {
      const response = await fetch(url, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "Verbindung erfolgreich getestet." : data?.error ?? "Test fehlgeschlagen.");
    });
  }

  return (
    <div className="w-full max-w-full space-y-5 overflow-hidden">
      {message ? <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">{message}</div> : null}
      <section className="w-full max-w-full rounded-2xl border border-white/10 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">OpenAI</h2>
          <StatusBadge tone={openAiConnected ? "green" : "neutral"}>
            {openAiConnected ? "OpenAI verbunden" : "OpenAI nicht verbunden"}
          </StatusBadge>
        </div>
        <p className="mt-2 text-sm text-slate-500">Quelle: {openAiSource}</p>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save(new FormData(event.currentTarget), "openai"); }}>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={currentSettings.openai.enabled} className="h-4 w-4" /> Aktiv</label>
          <input name="apiKey" type="password" autoComplete="new-password" placeholder="OpenAI API Key, leer lassen zum Beibehalten" />
          <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
            <PrimaryButton type="submit" disabled={isPending}>Speichern</PrimaryButton>
            <PrimaryButton onClick={() => post("/api/settings/integrations/openai/test")} disabled={isPending}>Verbindung testen</PrimaryButton>
          </div>
        </form>
      </section>
      <section className="w-full max-w-full rounded-2xl border border-white/10 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">Slack</h2>
          <StatusBadge tone={currentSettings.slack.webhookSet ? "green" : "neutral"}>{currentSettings.slack.webhookSet ? "Webhook gesetzt" : "kein Webhook"}</StatusBadge>
        </div>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save(new FormData(event.currentTarget), "slack"); }}>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={currentSettings.slack.enabled} className="h-4 w-4" /> Aktiv</label>
          <input name="webhookUrl" type="url" placeholder="Slack Webhook URL, leer lassen zum Beibehalten" />
          <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
            <PrimaryButton type="submit" disabled={isPending}>Slack speichern</PrimaryButton>
            <PrimaryButton onClick={() => post("/api/integrations/slack/test")} disabled={isPending}>Testnachricht senden</PrimaryButton>
          </div>
        </form>
      </section>
      <section className="w-full max-w-full rounded-2xl border border-white/10 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">ClickUp</h2>
          <StatusBadge tone={currentSettings.clickup.tokenSet ? "green" : "neutral"}>{currentSettings.clickup.tokenSet ? "Token gesetzt" : "kein Token"}</StatusBadge>
        </div>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save(new FormData(event.currentTarget), "clickup"); }}>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={currentSettings.clickup.enabled} className="h-4 w-4" /> Aktiv</label>
          <input name="apiToken" type="password" placeholder="API Token, leer lassen zum Beibehalten" />
          <input name="teamId" placeholder="Workspace/Team ID" defaultValue={currentSettings.clickup.config.teamId ?? ""} />
          <input name="spaceId" placeholder="Space ID optional" defaultValue={currentSettings.clickup.config.spaceId ?? ""} />
          <input name="folderId" placeholder="Folder ID optional" defaultValue={currentSettings.clickup.config.folderId ?? ""} />
          <input name="listId" placeholder="List ID" defaultValue={currentSettings.clickup.config.listId ?? ""} />
          <input name="defaultAssignee" placeholder="Default Assignee optional" defaultValue={currentSettings.clickup.config.defaultAssignee ?? ""} />
          <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
            <PrimaryButton type="submit" disabled={isPending}>ClickUp speichern</PrimaryButton>
            <PrimaryButton onClick={() => post("/api/integrations/clickup/test")} disabled={isPending}>Testverbindung</PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function eventTargetReset(type: "slack" | "clickup" | "openai") {
  const fieldName = type === "slack" ? "webhookUrl" : type === "clickup" ? "apiToken" : "apiKey";
  const input = document.querySelector<HTMLInputElement>(`input[name="${fieldName}"]`);
  if (input) input.value = "";
}
