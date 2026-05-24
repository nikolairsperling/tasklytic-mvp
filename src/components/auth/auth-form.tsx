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
    <form action={submit} className="auth-form">
      {mode === "setup" ? (
        <label className="auth-field">
          <span className="auth-label">Name</span>
          <input name="name" required autoComplete="name" className="auth-input" />
        </label>
      ) : null}
      <label className="auth-field">
        <span className="auth-label">E-Mail</span>
        <input name="email" type="email" required autoComplete="email" className="auth-input" />
      </label>
      <label className="auth-field">
        <span className="auth-label">Passwort</span>
        <input name="password" type="password" required minLength={mode === "setup" ? 10 : undefined} autoComplete={mode === "setup" ? "new-password" : "current-password"} className="auth-input" />
      </label>
      {mode === "setup" ? (
        <label className="auth-field">
          <span className="auth-label">Passwort wiederholen</span>
          <input name="passwordRepeat" type="password" required minLength={10} autoComplete="new-password" className="auth-input" />
        </label>
      ) : null}
      <button disabled={isPending} className="auth-primary-button mt-2">
        {isPending ? "Bitte warten..." : mode === "setup" ? "Admin erstellen" : "Einloggen"}
      </button>
      {toast ? <p className="auth-alert auth-alert-success">{toast}</p> : null}
      {message ? <p className="auth-alert auth-alert-error">{message}</p> : null}
      {debug ? <p className="auth-alert auth-alert-debug">{debug}</p> : null}
    </form>
  );
}

function formatAuthError(error?: string) {
  if (error?.includes("SESSION_SECRET")) {
    return "System nicht korrekt eingerichtet:\nSESSION_SECRET fehlt.\nBitte .env konfigurieren.";
  }

  return error ?? "Anmeldung fehlgeschlagen.";
}
