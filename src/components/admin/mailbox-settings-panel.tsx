"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, StatusBadge } from "@/components/admin/ui";
import type { SafeMailboxSettings } from "@/lib/mailbox";

export function MailboxSettingsPanel({ settings }: { settings: SafeMailboxSettings }) {
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    host: settings.values.host ?? "",
    port: settings.values.port ?? "993",
    secure: settings.values.secure ?? "true",
    user: settings.values.user ?? "",
    password: "",
    warmupStartDate: settings.values.warmupStartDate ?? "",
    warmupLevel: settings.values.warmupLevel ?? ""
  });
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [isPending, startTransition] = useTransition();

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const response = await fetch("/api/settings/mailbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json().catch(() => null)) as SafeMailboxSettings | { error?: string } | null;
      if (!response.ok || !isMailboxSettings(data)) {
        setMessage(readError(data) ?? "Speichern fehlgeschlagen.");
        return;
      }
      setCurrentSettings(data);
      setForm((current) => ({ ...current, password: "" }));
      setMessage("IMAP Einstellungen gespeichert. Bitte Verbindung testen, um die Inbox-Synchronisation zu aktivieren.");
    });
  }

  function test() {
    startTransition(async () => {
      const response = await fetch("/api/settings/mailbox/test-connection", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "IMAP-Verbindung erfolgreich getestet. Mailbox Ready ist jetzt aktiv." : data?.error ?? "Test fehlgeschlagen.");
      if (response.ok) {
        const updated = await fetch("/api/settings/mailbox", { cache: "no-store" }).then((item) => item.json()).catch(() => null) as SafeMailboxSettings | null;
        if (updated?.values) setCurrentSettings(updated);
      }
    });
  }

  function importFromSmtp() {
    startTransition(async () => {
      const response = await fetch("/api/settings/mailbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importFromSmtp: true })
      });
      const data = (await response.json().catch(() => null)) as SafeMailboxSettings | { error?: string } | null;
      if (!response.ok || !isMailboxSettings(data)) {
        setMessage(readError(data) ?? "SMTP Daten konnten nicht übernommen werden.");
        return;
      }
      setCurrentSettings(data);
      setForm({
        host: data.values.host ?? "",
        port: data.values.port ?? "993",
        secure: data.values.secure ?? "true",
        user: data.values.user ?? "",
        password: "",
        warmupStartDate: data.values.warmupStartDate ?? "",
        warmupLevel: data.values.warmupLevel ?? ""
      });
      setMessage("SMTP Daten übernommen. Bitte IMAP-Verbindung testen, bevor die Inbox synchronisiert.");
    });
  }

  const passwordPlaceholder = currentSettings.values.passwordPlaceholder ?? (currentSettings.values.passwordSet ? "••••••••" : "IMAP Passwort");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Postfach empfangen (IMAP)</h2>
          <p className="mt-1 text-sm text-slate-500">Passwort wird verschlüsselt gespeichert und nie im Klartext angezeigt.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={currentSettings.configured ? "green" : "red"}>{currentSettings.configured ? "IMAP konfiguriert" : "IMAP unvollständig"}</StatusBadge>
          <StatusBadge tone={currentSettings.tested ? "green" : "amber"}>{currentSettings.tested ? "getestet" : "nicht getestet"}</StatusBadge>
        </div>
      </div>
      {message ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">{message}</div> : null}

      <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <Field label="IMAP Host" name="host" value={form.host} onChange={(value) => update("host", value)} />
        <Field label="IMAP Port" name="port" type="number" value={form.port} onChange={(value) => update("port", value)} />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate">IMAP Secure SSL/TLS</span>
          <select name="secure" value={form.secure} onChange={(event) => update("secure", event.target.value)}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
        <Field label="IMAP Benutzer" name="user" value={form.user} onChange={(value) => update("user", value)} />
        <Field label="IMAP Passwort" name="password" type="password" value={form.password} placeholder={passwordPlaceholder} onChange={(value) => update("password", value)} />
        <Field label="Warmup Startdatum" name="warmupStartDate" type="date" value={form.warmupStartDate} onChange={(value) => update("warmupStartDate", value)} />
        <Field label="Warmup Level" name="warmupLevel" type="number" value={form.warmupLevel} onChange={(value) => update("warmupLevel", value)} />
        <div className="flex flex-wrap gap-3 md:col-span-2">
          {currentSettings.smtpImportAvailable ? (
            <button type="button" onClick={importFromSmtp} disabled={isPending} className="btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium leading-tight">
              Von SMTP übernehmen
            </button>
          ) : null}
          <PrimaryButton onClick={test} disabled={isPending || !currentSettings.configured}>IMAP-Verbindung testen</PrimaryButton>
          <PrimaryButton type="submit" disabled={isPending}>Speichern</PrimaryButton>
        </div>
      </form>

      {currentSettings.missingFields.length > 0 ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Fehlende IMAP Angaben: {currentSettings.missingFields.join(", ")}
        </div>
      ) : null}

      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        Heute erlaubt: {currentSettings.values.allowedEmailsToday ?? "nicht berechnet"}
        {currentSettings.values.testedAt ? <span className="ml-2">· Letzter IMAP-Test: {new Date(currentSettings.values.testedAt).toLocaleString("de-DE")}</span> : null}
      </div>
    </div>
  );
}

function isMailboxSettings(value: SafeMailboxSettings | { error?: string } | null): value is SafeMailboxSettings {
  return Boolean(value && "values" in value && "configured" in value);
}

function readError(value: SafeMailboxSettings | { error?: string } | null) {
  return value && "error" in value ? value.error : undefined;
}

function Field({ label, name, type = "text", value, placeholder, onChange }: { label: string; name: string; type?: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <input name={name} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
