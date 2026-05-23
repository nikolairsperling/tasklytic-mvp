"use client";

import { useState, useTransition } from "react";

export function LandingpagePreviewActions({
  prospectId,
  slug,
  appUrl
}: {
  prospectId: string;
  slug: string | null;
  appUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const href = slug ? landingpageHref(slug, appUrl) : "";

  function generate() {
    startTransition(async () => {
      const response = await fetch(`/api/prospects/${prospectId}/landingpage`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Landingpage konnte nicht generiert werden.");
        return;
      }
      window.location.reload();
    });
  }

  function preview() {
    if (!slug) {
      setMessage("Bitte zuerst Landingpage generieren");
      return;
    }
    setMessage(null);
    setOpen(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={preview} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
        Landingpage Vorschau
      </button>
      {slug ? (
        <a href={href} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
          Landingpage öffnen
        </a>
      ) : (
        <button type="button" onClick={generate} disabled={isPending} className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold">
          Landingpage generieren
        </button>
      )}
      {message ? <span className="text-xs text-amber-600">{message}</span> : null}
      {open && slug ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4">
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button type="button" onClick={() => setViewport("desktop")} className={`rounded-xl px-3 py-2 text-xs font-medium ${viewport === "desktop" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  Desktop
                </button>
                <button type="button" onClick={() => setViewport("mobile")} className={`rounded-xl px-3 py-2 text-xs font-medium ${viewport === "mobile" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  Mobile
                </button>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                Schließen
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-slate-100 p-3">
              <iframe title="Landingpage Vorschau" src={href} className="mx-auto h-full min-h-[720px] rounded-xl bg-white" style={{ width: viewport === "mobile" ? 390 : "100%", maxWidth: "100%" }} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function canPreviewLandingpage(slug: string | null | undefined): { ok: boolean; message?: string } {
  return slug ? { ok: true } : { ok: false, message: "Bitte zuerst Landingpage generieren" };
}

function landingpageHref(slug: string, appUrl?: string): string {
  return appUrl ? `${appUrl.replace(/\/$/, "")}/p/${slug}` : `/p/${slug}`;
}
