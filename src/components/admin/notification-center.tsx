"use client";

import { Bell, CheckCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { Component, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  url?: string | null;
  read: boolean;
  createdAt: string;
};

type NotificationPayload = {
  unreadCount: number;
  items: NotificationItem[];
};

export function NotificationCenter() {
  return (
    <NotificationCenterBoundary>
      <NotificationCenterContent />
    </NotificationCenterBoundary>
  );
}

class NotificationCenterBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[notification-center]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <button type="button" className="btn-secondary relative grid h-10 w-10 place-items-center rounded-full opacity-60" aria-label="Benachrichtigungen aktuell nicht verfügbar" disabled>
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>
      );
    }
    return this.props.children;
  }
}

function NotificationCenterContent() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationPayload>({ unreadCount: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const items = Array.isArray(data.items) ? data.items.filter((item) => item && typeof item.id === "string" && item.id.length > 0) : [];
  const unreadCount = typeof data.unreadCount === "number" && Number.isFinite(data.unreadCount) ? data.unreadCount : 0;

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    function handleClick(event: globalThis.MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Benachrichtigungen konnten nicht geladen werden.");
      setData(normalizeNotificationPayload(await response.json()));
    } catch {
      setData({ unreadCount: 0, items: [] });
    } finally {
      setLoading(false);
    }
  }

  async function markRead() {
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => undefined);
    await loadNotifications();
  }

  async function deleteNotification(item: NotificationItem) {
    if (!item.id) return;
    setData((current) => ({
      unreadCount: Math.max(0, current.unreadCount - (item.read ? 0 : 1)),
      items: (Array.isArray(current.items) ? current.items : []).filter((notification) => notification.id !== item.id)
    }));
    setToast("Benachrichtigung gelöscht");
    globalThis.setTimeout(() => setToast(null), 2200);

    const response = await fetch(`/api/notifications/${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) await loadNotifications();
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="btn-secondary relative grid h-10 w-10 place-items-center rounded-full"
        aria-label="Benachrichtigungen öffnen"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="fixed left-3 right-3 top-[calc(72px+env(safe-area-inset-top))] z-[150] max-h-[min(70vh,560px)] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl md:absolute md:left-auto md:right-0 md:top-12 md:w-96">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Benachrichtigungen</p>
              <p className="text-xs text-slate-500">{unreadCount} ungelesen</p>
            </div>
            <button type="button" onClick={markRead} className="btn-secondary inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Alle gelesen
            </button>
          </div>
          <div className="max-h-[calc(min(70vh,560px)-64px)] overflow-y-auto p-2">
            {loading ? <p className="px-3 py-6 text-sm text-slate-500">Lädt...</p> : null}
            {!loading && items.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Keine Benachrichtigungen.</p> : null}
            <div className="space-y-2">
              {items.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onClosePanel={() => setOpen(false)}
                  onDelete={() => deleteNotification(item)}
                />
              ))}
            </div>
          </div>
          {toast ? (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg bg-slate-950 px-3 py-2 text-center text-xs font-medium text-white shadow-lg">
              {toast}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NotificationCard({
  item,
  onClosePanel,
  onDelete
}: {
  item: NotificationItem;
  onClosePanel: () => void;
  onDelete: () => void;
}) {
  const cardBody = (
    <div className={`min-h-[88px] rounded-xl border px-3 py-3 shadow-sm transition-colors ${item.read ? "border-slate-100 bg-white hover:bg-slate-50" : "border-blue-100 bg-blue-50 hover:bg-blue-100"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{item.title}</p>
            <time className="shrink-0 text-[11px] text-slate-400">{formatRelative(item.createdAt)}</time>
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">{item.body}</p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label="Benachrichtigung löschen"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return item.url ? (
    <Link href={item.url} onClick={onClosePanel} className="block">
      {cardBody}
    </Link>
  ) : (
    <div>{cardBody}</div>
  );
}

function formatRelative(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} Std.`;
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(timestamp));
}

function normalizeNotificationPayload(payload: unknown): NotificationPayload {
  if (!payload || typeof payload !== "object") return { unreadCount: 0, items: [] };
  const value = payload as Partial<NotificationPayload>;
  const items = Array.isArray(value.items)
    ? value.items.filter((item): item is NotificationItem => Boolean(item && typeof item.id === "string"))
    : [];
  return {
    unreadCount: typeof value.unreadCount === "number" && Number.isFinite(value.unreadCount) ? value.unreadCount : 0,
    items
  };
}
