"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CookieBannerProps = {
  privacyHref: string;
  cookiesHref: string;
};

const storageKey = "tasklytic-cookie-consent";

export function CookieBanner({ privacyHref, cookiesHref }: CookieBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!window.localStorage.getItem(storageKey));
  }, []);

  function decide(value: "accepted" | "rejected") {
    window.localStorage.setItem(storageKey, value);
    window.dispatchEvent(new CustomEvent("tasklytic-cookie-consent", { detail: value }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl sm:bottom-5 sm:right-5 sm:left-auto sm:mx-0">
      <p className="text-sm leading-6 text-slate-700">
        Wir verwenden Cookies und Tracking, um diese Seite zu verbessern und Interaktionen auszuwerten. Du kannst zustimmen oder ablehnen.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <Link href={privacyHref} className="font-medium text-slate-600 underline underline-offset-4">Datenschutz</Link>
        <Link href={cookiesHref} className="font-medium text-slate-600 underline underline-offset-4">Cookies</Link>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => decide("rejected")} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Ablehnen
        </button>
        <button type="button" onClick={() => decide("accepted")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          Akzeptieren
        </button>
      </div>
    </div>
  );
}
