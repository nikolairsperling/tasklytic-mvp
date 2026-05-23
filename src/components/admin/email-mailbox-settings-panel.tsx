"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, StatusBadge } from "@/components/admin/ui";
import type { SafeMailboxSettings } from "@/lib/mailbox";
import type { SafeSmtpSettings } from "@/lib/smtp-settings";

type EmailMailboxSettingsPanelProps = {
  smtp: SafeSmtpSettings;
  mailbox: SafeMailboxSettings;
};

export function EmailMailboxSettingsPanel({ smtp, mailbox }: EmailMailboxSettingsPanelProps) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [smtpConnected, setSmtpConnected] = useState(smtp.configured);
  const [mailboxState, setMailboxState] = useState(mailbox);
  const [smtpForm, setSmtpForm] = useState({
    host: smtp.values.SMTP_HOST ?? "",
    port: smtp.values.SMTP_PORT ?? "587",
    secure: smtp.values.SMTP_SECURE ?? "false",
    user: smtp.values.SMTP_USER ?? "",
    password: "",
    fromEmail: smtp.values.SMTP_FROM_EMAIL ?? smtp.values.SMTP_USER ?? "",
    fromName: smtp.values.SMTP_FROM_NAME ?? "Tasklytic",
    replyToEmail: smtp.values.SMTP_REPLY_TO_EMAIL ?? "",
    dailyLimit: smtp.values.EMAIL_MAX_EMAILS_PER_DAY ?? "50"
  });
  const [imapForm, setImapForm] = useState({
    host: mailbox.values.host ?? "",
    port: mailbox.values.port ?? "993",
    secure: mailbox.values.secure ?? "true",
    user: mailbox.values.user ?? "",
    password: "",
    warmupStartDate: mailbox.values.warmupStartDate ?? "",
    warmupLevel: mailbox.values.warmupLevel ?? ""
  });

  function updateSmtp(key: keyof typeof smtpForm, value: string) {
    setSmtpForm((current) => ({ ...current, [key]: value }));
    setSmtpConnected(false);
  }

  function updateImap(key: keyof typeof imapForm, value: string) {
    setImapForm((current) => ({ ...current, [key]: value }));
    setMailboxState((current) => ({ ...current, tested: false, values: { ...current.values, testedAt: null } }));
  }

  function save() {
    startTransition(async () => {
      try {
        await saveSmtpSettings();
        const mailboxData = await saveImapSettings();

        setMailboxState(mailboxData);
        setSmtpForm((current) => ({ ...current, password: "" }));
        setImapForm((current) => ({ ...current, password: "" }));
        setMessage({ type: "success", text: "Mail-Einstellungen gespeichert." });
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Mail-Einstellungen konnten nicht gespeichert werden." });
      }
    });
  }

  function testSmtp() {
    startTransition(async () => {
      try {
        await saveSmtpSettings();
      } catch {
        setSmtpConnected(false);
        setMessage({ type: "error", text: "SMTP-Verbindung fehlgeschlagen. Bitte Mail-Einstellungen prüfen." });
        return;
      }
      const response = await fetch("/api/settings/email/test-connection", { method: "POST" });
      if (!response.ok) {
        setSmtpConnected(false);
        setMessage({ type: "error", text: "SMTP-Verbindung fehlgeschlagen. Bitte Mail-Einstellungen prüfen." });
        return;
      }
      setSmtpConnected(true);
      setMessage({ type: "success", text: "SMTP-Verbindung erfolgreich getestet." });
    });
  }

  function testImap() {
    startTransition(async () => {
      try {
        const savedMailbox = await saveImapSettings();
        setMailboxState(savedMailbox);
      } catch {
        setMessage({ type: "error", text: "IMAP-Verbindung fehlgeschlagen. Bitte Mail-Einstellungen prüfen." });
        return;
      }
      const response = await fetch("/api/settings/mailbox/test-connection", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage({ type: "error", text: data?.error ?? "IMAP-Verbindung fehlgeschlagen. Bitte Mail-Einstellungen prüfen." });
        return;
      }
      const updated = await fetch("/api/settings/mailbox", { cache: "no-store" }).then((item) => item.json()).catch(() => null) as SafeMailboxSettings | null;
      if (updated?.values) setMailboxState(updated);
      setMessage({ type: "success", text: "IMAP-Verbindung erfolgreich getestet." });
    });
  }

  async function saveSmtpSettings() {
    const smtpResponse = await fetch("/api/settings/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(smtpForm)
    });
    if (!smtpResponse.ok) throw new Error("SMTP Einstellungen konnten nicht gespeichert werden.");
  }

  async function saveImapSettings() {
    const mailboxResponse = await fetch("/api/settings/mailbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(imapForm)
    });
    const mailboxData = (await mailboxResponse.json().catch(() => null)) as SafeMailboxSettings | { error?: string } | null;
    if (!mailboxResponse.ok || !isMailboxSettings(mailboxData)) throw new Error("IMAP Einstellungen konnten nicht gespeichert werden.");
    return mailboxData;
  }

  const mailboxReady = smtpConnected && mailboxState.configured && mailboxState.tested;
  const lastCheck = mailboxState.values.testedAt ? new Date(mailboxState.values.testedAt).toLocaleString("de-DE") : "keine Prüfung";
  const imapFormComplete = Boolean(imapForm.host && imapForm.port && imapForm.user && (imapForm.password || mailboxState.values.passwordSet));

  return (
    <div className="space-y-6">
      {message ? <div className={`rounded-2xl px-4 py-3 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message.text}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-semibold text-ink">Status</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusItem label="SMTP verbunden" ok={smtpConnected} />
          <StatusItem label="IMAP verbunden" ok={mailboxState.tested} />
          <StatusItem label="Mailbox bereit" ok={mailboxReady} />
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Letzte Prüfung</p>
            <p className="mt-2 text-sm font-semibold text-ink">{lastCheck}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-ink">SMTP</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Host" value={smtpForm.host} onChange={(value) => updateSmtp("host", value)} />
          <Field label="Port" type="number" value={smtpForm.port} onChange={(value) => updateSmtp("port", value)} />
          <Field label="Benutzer" value={smtpForm.user} onChange={(value) => updateSmtp("user", value)} />
          <Field label="Passwort" type="password" value={smtpForm.password} placeholder={smtp.values.SMTP_PASS_SET ? "••••••••" : "SMTP Passwort"} onChange={(value) => updateSmtp("password", value)} />
          <SelectField label="TLS" value={smtpForm.secure} onChange={(value) => updateSmtp("secure", value)} />
          <Field label="Absender E-Mail" type="email" value={smtpForm.fromEmail} onChange={(value) => updateSmtp("fromEmail", value)} />
          <Field label="Absender Name" value={smtpForm.fromName} onChange={(value) => updateSmtp("fromName", value)} />
          <Field label="Tägliches Versandlimit" type="number" value={smtpForm.dailyLimit} onChange={(value) => updateSmtp("dailyLimit", value)} />
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={testSmtp} disabled={isPending}>Verbindung testen</PrimaryButton>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-ink">IMAP</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Host" value={imapForm.host} onChange={(value) => updateImap("host", value)} />
          <Field label="Port" type="number" value={imapForm.port} onChange={(value) => updateImap("port", value)} />
          <Field label="Benutzer" value={imapForm.user} onChange={(value) => updateImap("user", value)} />
          <Field label="Passwort" type="password" value={imapForm.password} placeholder={mailboxState.values.passwordPlaceholder ?? "IMAP Passwort"} onChange={(value) => updateImap("password", value)} />
          <SelectField label="SSL/TLS" value={imapForm.secure} onChange={(value) => updateImap("secure", value)} />
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={testImap} disabled={isPending || !imapFormComplete}>Verbindung testen</PrimaryButton>
        </div>
      </section>

      <div className="flex justify-end">
        <PrimaryButton onClick={save} disabled={isPending}>Speichern</PrimaryButton>
      </div>
    </div>
  );
}

function StatusItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="mt-2"><StatusBadge tone={ok ? "green" : "amber"}>{ok ? "ja" : "nein"}</StatusBadge></div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </label>
  );
}

function isMailboxSettings(value: SafeMailboxSettings | { error?: string } | null): value is SafeMailboxSettings {
  return Boolean(value && "values" in value && "configured" in value);
}
