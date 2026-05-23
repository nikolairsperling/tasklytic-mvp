"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage(null);
      setToast(null);
      let response: Response;
      try {
        response = await fetch(mode === "setup" ? "/api/setup/admin" : "/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(formData.entries()))
        });
      } catch {
        setMessage("Anmeldung fehlgeschlagen. Bitte Verbindung prüfen und erneut versuchen.");
        return;
      }
      const data = await response.json().catch(() => null) as { error?: string; success?: boolean; redirectTo?: string } | null;
      if (process.env.NODE_ENV !== "production") {
        setDebug(`Status: ${response.status} | success: ${data?.success === true ? "true" : "false"} | redirectTo: ${data?.redirectTo ?? "-"}`);
      }
      if (!response.ok) {
        setMessage(formatAuthError(data?.error));
        return;
      }
      if (!data?.success) {
        setMessage("Anmeldung fehlgeschlagen.");
        return;
      }
      if (mode === "setup") setToast("Admin erstellt");
      router.replace(mode === "setup" ? "/admin" : data.redirectTo || "/admin");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {mode === "setup" ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <input name="name" required autoComplete="name" className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" />
        </label>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">E-Mail</span>
        <input name="email" type="email" required autoComplete="email" className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Passwort</span>
        <input name="password" type="password" required minLength={mode === "setup" ? 10 : undefined} autoComplete={mode === "setup" ? "new-password" : "current-password"} className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" />
      </label>
      {mode === "setup" ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-600">Passwort wiederholen</span>
          <input name="passwordRepeat" type="password" required minLength={10} autoComplete="new-password" className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" />
        </label>
      ) : null}
      <button disabled={isPending} className="mt-4 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {isPending ? "Bitte warten..." : mode === "setup" ? "Admin erstellen" : "Einloggen"}
      </button>
      {toast ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{toast}</p> : null}
      {message ? <p className="whitespace-pre-line rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
      {debug ? <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">{debug}</p> : null}
    </form>
  );
}

function formatAuthError(error?: string) {
  if (error?.includes("SESSION_SECRET")) {
    return "System nicht korrekt eingerichtet:\nSESSION_SECRET fehlt.\nBitte .env konfigurieren.";
  }

  return error ?? "Anmeldung fehlgeschlagen.";
}
