"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/components/app-version-client";

export default function WorkflowError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (isChunkLoadError(error)) void recoverFromChunkLoadError();
  }, [error]);

  if (isChunkLoadError(error)) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-panel">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <h2 className="mt-5 text-xl font-semibold text-ink">Tasklytic wird aktualisiert...</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Komponenten werden neu geladen.</p>
        <button type="button" onClick={() => void recoverFromChunkLoadError()} className="btn-primary mt-5 rounded-full px-4 py-2 text-sm font-semibold">
          Jetzt aktualisieren
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-xl font-semibold text-ink">Workflow konnte nicht geladen werden.</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Die Seite wurde von der Error Boundary abgefangen. Details werden erst nach Klick angezeigt.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold">
          Erneut versuchen
        </button>
        <button type="button" onClick={() => setDetailsOpen((current) => !current)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Details anzeigen
        </button>
        <Link href="/admin/dashboard" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Zur Übersicht
        </Link>
      </div>
      {detailsOpen ? (
        <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="break-words"><span className="font-semibold">error.message:</span> {error.message || "Unbekannter Fehler"}</p>
          {error.digest ? <p className="break-words"><span className="font-semibold">digest:</span> {error.digest}</p> : null}
          <p><span className="font-semibold">API Statuscode:</span> Nicht verfügbar in der React Error Boundary</p>
          <p><span className="font-semibold">API Response Body:</span> Nicht verfügbar in der React Error Boundary</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-xs">componentStack: {error.stack || "Nicht verfügbar"}</pre>
        </div>
      ) : null}
    </div>
  );
}
