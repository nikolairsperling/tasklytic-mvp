"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, StatusBadge } from "@/components/admin/ui";
import type { SafeSmtpSettings } from "@/lib/smtp-settings";

export function SmtpSettingsPanel({ status, endpoint = "/api/settings/smtp", testConnectionEndpoint = "/api/settings/smtp/test-connection", testSendEndpoint = "/api/settings/smtp/test-email" }: { status: SafeSmtpSettings; endpoint?: string; testConnectionEndpoint?: string; testSendEndpoint?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function runPost(url: string, body?: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = (await response.json().catch(() => null)) as { error?: string; messageId?: string } | null;

    if (!response.ok) {
      throw new Error(data?.error ?? "Aktion fehlgeschlagen.");
    }

    return data;
  }

  function testConnection() {
    startTransition(async () => {
      try {
        const result = await runPost(testConnectionEndpoint);
        setMessage({ type: "success", text: result?.messageId ?? "SMTP Verbindung erfolgreich geprüft." });
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "SMTP Test fehlgeschlagen." });
      }
    });
  }

  function sendTestEmail() {
    startTransition(async () => {
      try {
        const result = await runPost(testSendEndpoint, { to: email });
        setMessage({
          type: "success",
          text: result?.messageId ? `Testmail gesendet: ${result.messageId}` : "Testmail gesendet."
        });
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Testmail fehlgeschlagen." });
      }
    });
  }

  function saveSettings(formData: FormData) {
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: endpoint.endsWith("/email") ? "PATCH" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(formData.entries()))
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(data?.error ?? "Speichern fehlgeschlagen.");
        }
        setMessage({ type: "success", text: "SMTP Einstellungen gespeichert." });
        window.location.reload();
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Speichern fehlgeschlagen." });
      }
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
        <div>
          <p className="text-sm font-medium text-ink">SMTP Status</p>
          <p className="mt-1 text-sm text-slate-500">
            Quelle: {status.source}. Passwörter werden niemals im Klartext angezeigt.
          </p>
        </div>
        <StatusBadge tone={status.configured ? "green" : "red"}>
          {status.configured ? "vollständig konfiguriert" : "unvollständig"}
        </StatusBadge>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        saveSettings(new FormData(event.currentTarget));
      }}>
        <Field label="SMTP Host" name="host" defaultValue={status.values.SMTP_HOST ?? ""} required />
        <Field label="SMTP Port" name="port" type="number" defaultValue={status.values.SMTP_PORT ?? "587"} required />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate">SMTP Secure</span>
          <select name="secure" defaultValue={status.values.SMTP_SECURE ?? "false"}>
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        </label>
        <Field label="SMTP User" name="user" defaultValue={status.values.SMTP_USER ?? ""} required />
        <Field label="SMTP Password" name="password" type="password" placeholder={status.values.SMTP_PASS_SET ? "Passwort gesetzt, leer lassen zum Beibehalten" : "Passwort eingeben"} />
        <Field label="From Email" name="fromEmail" type="email" defaultValue={status.values.SMTP_FROM_EMAIL ?? ""} required />
        <Field label="From Name" name="fromName" defaultValue={status.values.SMTP_FROM_NAME ?? "Tasklytic"} required />
        <Field label="Reply-To Email" name="replyToEmail" type="email" defaultValue={status.values.SMTP_REPLY_TO_EMAIL ?? ""} />
        <Field label="Tägliches Versandlimit" name="dailyLimit" type="number" defaultValue={status.values.EMAIL_MAX_EMAILS_PER_DAY ?? "50"} required />
        <div className="md:col-span-2">
          <PrimaryButton type="submit" disabled={isPending}>SMTP Einstellungen speichern</PrimaryButton>
        </div>
      </form>

      {status.missingFields.length > 0 ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Fehlende Variablen: {status.missingFields.join(", ")}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-ink">Verbindung testen</h3>
          <p className="mt-1 text-sm text-slate-500">Prüft Login und SMTP-Erreichbarkeit per Nodemailer.</p>
          <div className="mt-4">
            <PrimaryButton onClick={testConnection} disabled={isPending}>
              SMTP Verbindung testen
            </PrimaryButton>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-ink">Testmail senden</h3>
          <p className="mt-1 text-sm text-slate-500">Sendet eine einzelne Testmail an eine manuelle Adresse.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
            <PrimaryButton onClick={sendTestEmail} disabled={isPending}>
              Testmail senden
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-ink">{value ?? "nicht gesetzt"}</p>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  placeholder
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} />
    </label>
  );
}
