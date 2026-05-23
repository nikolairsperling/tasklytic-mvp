"use client";

import Link from "next/link";
import { useEffect } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/components/app-version-client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin-route]", error);
    if (isChunkLoadError(error)) void recoverFromChunkLoadError();
  }, [error]);

  if (isChunkLoadError(error)) {
    return (
      <div className="flex min-h-[calc(100vh-180px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full items-center justify-center px-0 py-6 font-sans">
        <section className="w-full max-w-md rounded-2xl bg-white p-5 text-center shadow-panel sm:p-6">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <h1 className="mt-5 text-lg font-semibold text-ink">Tasklytic wird aktualisiert...</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Komponenten werden neu geladen.</p>
          <button type="button" onClick={() => void recoverFromChunkLoadError()} className="btn-primary mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold">
            Jetzt aktualisieren
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-180px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full items-center justify-center px-0 py-6 font-sans">
      <section className="w-full max-w-md rounded-2xl bg-white p-5 text-center shadow-panel sm:p-6">
        <h1 className="text-lg font-semibold text-ink">Dieser Bereich konnte nicht geladen werden.</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={reset} className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold">
            Neu laden
          </button>
          <Link href="/admin/dashboard" className="btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold">
            Zur Übersicht
          </Link>
        </div>
      </section>
    </div>
  );
}
