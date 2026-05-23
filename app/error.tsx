"use client";

import Link from "next/link";
import { useEffect } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/components/app-version-client";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[root-route]", error);
    if (isChunkLoadError(error)) void recoverFromChunkLoadError();
  }, [error]);

  if (isChunkLoadError(error)) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
        <div className="mx-auto mt-10 max-w-lg rounded-2xl bg-white p-5 shadow-panel">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <h1 className="mt-5 text-lg font-semibold">Tasklytic wird aktualisiert...</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Komponenten werden neu geladen.</p>
          <button type="button" onClick={() => void recoverFromChunkLoadError()} className="btn-primary mt-4 rounded-xl px-4 py-2 text-sm font-semibold">
            Jetzt aktualisieren
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto mt-10 max-w-lg rounded-2xl bg-white p-5 shadow-panel">
        <h1 className="text-lg font-semibold">Tasklytic konnte diesen Bereich nicht laden</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Der Fehler wurde abgefangen, damit kein weißer App-Fehlerbildschirm erscheint.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
            Neu laden
          </button>
          <Link href="/admin/dashboard" className="btn-secondary rounded-xl px-4 py-2 text-sm font-semibold">
            Dashboard öffnen
          </Link>
        </div>
      </div>
    </main>
  );
}
