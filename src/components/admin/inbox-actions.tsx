"use client";

import { useEffect, useState, useTransition } from "react";
import { PrimaryButton } from "@/components/admin/ui";

type InboxHealth = {
  smtpConfigured: boolean;
  imapConfigured: boolean;
  imapTested: boolean;
  mailboxReady: boolean;
  lastSyncAt: string | null;
  errors: string[];
};

export function InboxActions() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [health, setHealth] = useState<InboxHealth | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);

  useEffect(() => {
    void loadHealth();
  }, []);

  async function loadHealth() {
    setIsLoadingHealth(true);
    try {
      const response = await fetch("/api/inbox/health", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as InboxHealth | { error?: string } | null;
      if (!response.ok || !data || typeof (data as InboxHealth).mailboxReady !== "boolean") {
        throw new Error("Mailbox-Status konnte nicht geladen werden.");
      }
      setHealth(data as InboxHealth);
    } catch (error) {
      setHealth({
        smtpConfigured: false,
        imapConfigured: false,
        imapTested: false,
        mailboxReady: false,
        lastSyncAt: null,
        errors: ["Synchronisierung fehlgeschlagen. Bitte Mail-Einstellungen prüfen."]
      });
    } finally {
      setIsLoadingHealth(false);
    }
  }

  function sync() {
    startTransition(async () => {
      const response = await fetch("/api/inbox/sync", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { created?: number; skipped?: number; error?: string } | null;
      if (!response.ok) {
        setMessage(data?.error ?? "Synchronisierung fehlgeschlagen. Bitte Mail-Einstellungen prüfen.");
        return;
      }
      setMessage(`${data?.created ?? 0} neue Mails, ${data?.skipped ?? 0} übersprungen.`);
      window.location.reload();
    });
  }

  const mailboxReady = Boolean(health?.mailboxReady);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={sync} disabled={!mailboxReady || isPending}>
          {isPending ? "Synchronisiert..." : "Postfach synchronisieren"}
        </PrimaryButton>
        <p className="text-sm text-slate-500">
          Letzte Synchronisierung: {isLoadingHealth ? "lädt..." : health?.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString("de-DE") : "keine Daten"}
        </p>
      </div>
      {!mailboxReady && !isLoadingHealth ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Synchronisierung fehlgeschlagen. Bitte Mail-Einstellungen prüfen.</p> : null}
      {message ? <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{message}</p> : null}
    </div>
  );
}
