"use client";

import { Bell, CheckCircle2, Clock3, Phone, RefreshCw } from "lucide-react";
import React, { useMemo, useState, useTransition } from "react";
import { buildTelHref } from "@/lib/calling";
import { calculateFollowUpAt, getFollowUpViewLabel, type FollowUpView } from "@/lib/follow-ups";
import { useCallingSettings } from "@/components/admin/use-calling-settings";

export type FollowUpItem = {
  id: string;
  companyName: string;
  city: string;
  decisionMakerName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyPhone: string | null;
  decisionMakerPhone: string | null;
  decisionMakerEmail: string | null;
  lastEmailSentAt: string | null;
  followUpReason: string | null;
  followUpAt: string | null;
  followUpStatus: string;
  status: string;
  leadStatus: string;
  slug: string | null;
  landingpageUrl: string | null;
  companyEmail: string | null;
};

export type FollowUpDashboardData = {
  summary: {
    today: number;
    overdue: number;
    week: number;
    done: number;
    dueCount: number;
    totalOpen: number;
  };
  lists: Record<FollowUpView, FollowUpItem[]>;
};

type FollowUpDashboardProps = FollowUpDashboardData & {
  initialView?: FollowUpView;
};

export function FollowUpDashboard({ summary, lists, initialView = "due" }: FollowUpDashboardProps) {
  const callingSettings = useCallingSettings();
  const [selectedView, setSelectedView] = useState<FollowUpView>(initialView);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const items = lists[selectedView] ?? [];
  const tabs = useMemo(() => ([
    { key: "due" as const, label: "Heute fällig", count: summary.today },
    { key: "overdue" as const, label: "Überfällig", count: summary.overdue },
    { key: "week" as const, label: "Diese Woche", count: summary.week },
    { key: "done" as const, label: "Erledigt", count: summary.done }
  ]), [summary.done, summary.overdue, summary.today, summary.week]);

  function patchFollowUp(prospectId: string, payload: Record<string, unknown>, successText: string) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/prospects/${prospectId}/follow-up`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error ?? "Wiedervorlage konnte nicht gespeichert werden.");
        }
        setMessage(successText);
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Wiedervorlage konnte nicht gespeichert werden.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Pipeline</p>
        <h1 className="text-2xl font-semibold text-ink">Wiedervorlagen</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Heute fällig" value={summary.today} icon={<Clock3 className="h-4 w-4" />} />
        <Stat label="Überfällig" value={summary.overdue} icon={<Bell className="h-4 w-4" />} />
        <Stat label="Diese Woche" value={summary.week} icon={<RefreshCw className="h-4 w-4" />} />
        <Stat label="Erledigt" value={summary.done} icon={<CheckCircle2 className="h-4 w-4" />} />
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-panel">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedView(tab.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              selectedView === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {getFollowUpViewLabel(tab.key)}
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">{tab.count}</span>
          </button>
        ))}
      </div>

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-panel">
        <table className="min-w-[1280px] w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              <th className="px-4 py-4">Lead</th>
              <th className="px-4 py-4">Firma</th>
              <th className="px-4 py-4">Telefonnummer</th>
              <th className="px-4 py-4">letzte E-Mail</th>
              <th className="px-4 py-4">Follow-up Grund</th>
              <th className="px-4 py-4">Fällig seit</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                  Keine Wiedervorlagen in {getFollowUpViewLabel(selectedView).toLowerCase()}.
                </td>
              </tr>
            ) : items.map((item) => {
              const leadName = [item.decisionMakerName, item.firstName, item.lastName].find(Boolean) ?? item.companyName;
              const callHref = buildTelHref(item.phone ?? item.companyPhone ?? item.decisionMakerPhone, callingSettings);
              return (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4 font-medium text-ink">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                        {leadName.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate">{leadName}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.status} · {item.leadStatus}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="truncate font-medium text-slate-700">{item.companyName}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.city || "k. A."}</p>
                  </td>
                  <td className="px-4 py-4">
                    {callHref ? (
                      <a href={callHref} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        Anrufen
                      </a>
                    ) : (
                      <button type="button" disabled title="Keine Telefonnummer vorhanden" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-300">
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        Anrufen
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-700">{formatDate(item.lastEmailSentAt)}</td>
                  <td className="px-4 py-4 text-slate-700">{item.followUpReason || "Kein Grund hinterlegt"}</td>
                  <td className="px-4 py-4 text-slate-700">{formatDueSince(item.followUpAt)}</td>
                  <td className="px-4 py-4">
                    <StatusTone status={item.followUpStatus} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => patchFollowUp(item.id, { followUpStatus: "done" }, "Wiedervorlage erledigt.")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Erledigt
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => patchFollowUp(item.id, { followUpAt: calculateFollowUpAt(new Date()).toISOString(), followUpReason: item.followUpReason || "Später erinnern", followUpStatus: "snoozed" }, "Wiedervorlage verschoben.")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Clock3 className="h-4 w-4" aria-hidden="true" />
                        Später erinnern
                      </button>
                      {callHref ? (
                        <a href={callHref} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          <Phone className="h-4 w-4" aria-hidden="true" />
                          Anrufen
                        </a>
                      ) : (
                        <button type="button" disabled title="Keine Telefonnummer vorhanden" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-300">
                          <Phone className="h-4 w-4" aria-hidden="true" />
                          Anrufen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value.toLocaleString("de-DE")}</p>
    </div>
  );
}

function StatusTone({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "snoozed"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : status === "dismissed"
          ? "bg-slate-100 text-slate-600 ring-slate-200"
          : "bg-blue-50 text-blue-700 ring-blue-100";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>{status}</span>;
}

function formatDate(value: string | null) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDueSince(value: string | null) {
  if (!value) return "Kein Termin";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kein Termin";
  const diff = date.getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "heute";
  if (days > 0) return `in ${days} Tagen`;
  return `${Math.abs(days)} Tage überfällig`;
}
