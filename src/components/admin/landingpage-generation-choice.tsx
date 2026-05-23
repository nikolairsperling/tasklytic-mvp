"use client";

import Link from "next/link";
import { FileText, Layers } from "lucide-react";
import React from "react";
import { useState } from "react";

export function LandingpageGenerationChoice() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">Was möchtest du generieren?</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group min-h-52 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-panel transition hover:-translate-y-0.5 hover:border-slate-300"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-6 block text-xl font-semibold text-ink">Personalisierte Landingpages</span>
            <span className="mt-2 block max-w-lg text-sm leading-6 text-slate-500">
              Generiere einzigartige Landingpages für jeden Lead mit dynamischen Inhalten und QR-Codes.
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="landingpage-choice-title">
          <div className="w-[min(92vw,860px)] max-w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:w-[min(90vw,860px)] sm:p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="landingpage-choice-title" className="text-xl font-semibold text-ink">Personalisierte Landingpages</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">Wähle, ob du eine einzelne Landingpage oder einen Lauf für eine bestehende Liste starten möchtest.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50">Schließen</button>
            </div>
            <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
              <Link href="/admin/prospects" className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                <FileText className="h-5 w-5 text-slate-700" aria-hidden="true" />
                <span className="mt-4 block font-semibold text-ink">Für einzelne Leads generieren</span>
                <span className="mt-2 block text-sm leading-6 text-slate-500">Erstelle eine personalisierte Landingpage für einen ausgewählten Lead.</span>
              </Link>
              <Link href="/admin/impact/landingpages" className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                <Layers className="h-5 w-5 text-slate-700" aria-hidden="true" />
                <span className="mt-4 block font-semibold text-ink">Für eine Liste generieren</span>
                <span className="mt-2 block text-sm leading-6 text-slate-500">Generiere personalisierte Landingpages für alle Leads einer bestehenden Liste.</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
