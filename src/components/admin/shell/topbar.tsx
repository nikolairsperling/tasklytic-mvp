"use client";

import Link from "next/link";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationCenter } from "@/components/admin/notification-center";
import { getActiveAdminItem } from "@/lib/admin-navigation";

export function Topbar({
  pathname,
  themeMode,
  onThemeToggle,
  onMenuClick,
  appName = "Tasklytic",
  logoUrl
}: {
  pathname: string;
  themeMode: "light" | "dark";
  onThemeToggle: () => void;
  onMenuClick: () => void;
  appName?: string;
  logoUrl?: string | null;
}) {
  const active = getActiveAdminItem(pathname);
  const [dueCount, setDueCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/prospects/follow-ups", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { summary?: { dueCount?: number } } | null) => {
        if (!cancelled) {
          setDueCount(typeof body?.summary?.dueCount === "number" ? body.summary.dueCount : 0);
        }
      })
      .catch(() => {
        if (!cancelled) setDueCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="admin-header admin-topbar sticky top-0 z-[100] w-full max-w-full border-b px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:py-4 lg:px-8">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="btn-secondary grid h-11 w-11 place-items-center rounded-xl md:hidden"
            aria-label="Navigation öffnen"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-2 md:hidden" aria-label={appName}>
            {logoUrl ? <img src={logoUrl} alt="" className="admin-brand-mark h-10 w-10 object-contain" /> : <span className="admin-brand-mark grid h-10 w-10 place-items-center text-sm font-semibold text-white">T</span>}
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{appName} Admin</p>
            <h1 className="truncate text-xl font-semibold text-ink md:text-2xl">{active.label}</h1>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {typeof dueCount === "number" && dueCount > 0 ? (
            <Link href="/admin/follow-ups" className="admin-status-pill hidden min-h-10 max-w-full items-center rounded-full px-3 py-2 text-xs font-semibold sm:inline-flex">
              {dueCount.toLocaleString("de-DE")} Wiedervorlagen fällig
            </Link>
          ) : null}
          <NotificationCenter />
          <button
            type="button"
            onClick={onThemeToggle}
            className="btn-secondary inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
            aria-label={themeMode === "dark" ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
          >
            {themeMode === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            {themeMode === "dark" ? "Hell" : "Dunkel"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              window.location.href = "/login";
            }}
            className="btn-secondary hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold sm:inline-flex"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
