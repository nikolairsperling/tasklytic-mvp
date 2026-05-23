"use client";

import { Bell, ExternalLink, Mail, PanelRightOpen, Phone, Search } from "lucide-react";
import React, { useMemo, useState, useTransition } from "react";
import { buildTelHref } from "@/lib/calling";
import { ProspectCrmPanel, type ProspectCrmPanelData } from "@/components/admin/prospect-crm-panel";
import { prospectDetailFromApi } from "@/components/admin/prospect-list";
import { useCallingSettings } from "@/components/admin/use-calling-settings";
import type { HotLeadItem, HotLeadKpis } from "@/lib/hot-leads";
import { prospectEventLabel } from "@/lib/prospect-events";

type HotLeadDashboardProps = {
  leads: HotLeadItem[];
  kpis: HotLeadKpis;
};

type ProspectDetailApiResponse = ProspectCrmPanelData & {
  notes?: Array<{ id: string; text: string; createdAt: string }>;
  events?: Array<{ id: string; type: string; meta: unknown; scoreDelta: number; createdAt: string }>;
  campaignEnrollments?: Array<{
    id: string;
    status: string;
    campaign: { id: string; name: string; status: string };
  }>;
};

export function HotLeadDashboard({ leads, kpis }: HotLeadDashboardProps) {
  const [query, setQuery] = useState("");
  const [drawerLead, setDrawerLead] = useState<ProspectCrmPanelData | null>(null);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const callingSettings = useCallingSettings();

  const visibleLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return leads;

    return leads.filter((lead) =>
      [
        lead.name,
        lead.companyName,
        lead.city,
        lead.status,
        lead.engagementLevel,
        lead.painType ?? "",
        lead.painSummary ?? "",
        lead.lastEvent ? prospectEventLabel(lead.lastEvent.type) : ""
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [leads, query]);

  const drawerIndex = drawerLead ? visibleLeads.findIndex((lead) => lead.prospectId === drawerLead.id) : -1;
  const previousLeadId = drawerIndex > 0 ? visibleLeads[drawerIndex - 1]?.prospectId : null;
  const nextLeadId = drawerIndex >= 0 && drawerIndex < visibleLeads.length - 1 ? visibleLeads[drawerIndex + 1]?.prospectId : null;

  async function openDrawer(prospectId: string) {
    setLoadingLeadId(prospectId);
    setMessage(null);

    try {
      const response = await fetch(`/api/prospects/${prospectId}`);
      const body = (await response.json().catch(() => null)) as ProspectDetailApiResponse | { error?: string } | null;
      if (!response.ok || !body || !("id" in body)) {
        throw new Error(body && "error" in body ? body.error : "Lead konnte nicht geladen werden.");
      }
      setDrawerLead(prospectDetailFromApi(body));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lead konnte nicht geladen werden.");
    } finally {
      setLoadingLeadId(null);
    }
  }

  function setFollowUp(prospectId: string) {
    startTransition(async () => {
      setMessage(null);
      const followUpAt = new Date();
      followUpAt.setDate(followUpAt.getDate() + 1);
      followUpAt.setHours(9, 0, 0, 0);

      try {
        const response = await fetch(`/api/prospects/${prospectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followUpAt: followUpAt.toISOString() })
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Wiedervorlage konnte nicht gesetzt werden.");
        }
        setMessage("Wiedervorlage gesetzt.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Wiedervorlage konnte nicht gesetzt werden.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <header className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Hot Leads</h1>
          <p className="mt-2 text-sm text-slate-500">Leads mit hoher Kaufwahrscheinlichkeit</p>
        </div>
        <label className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Hot Leads suchen</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hot Leads suchen"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-ink outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </label>
      </header>

      <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Hot Leads gesamt" value={kpis.total} />
        <Kpi label="Heute aktiv" value={kpis.activeToday} />
        <Kpi label="CTA geklickt" value={kpis.ctaClicked} />
        <Kpi label="Buchungsseite geöffnet" value={kpis.bookingOpened} />
        <Kpi label="Antworten erhalten" value={kpis.emailReplied} />
      </section>

      {message ? (
        <div role="status" className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          {message}
        </div>
      ) : null}

      {leads.length === 0 ? (
        <div className="border-y border-slate-200 py-16 text-center">
          <p className="mx-auto max-w-xl text-sm text-slate-500">
            Noch keine Hot Leads. Starte eine Kampagne oder prüfe deine Tracking- und Research-Daten.
          </p>
        </div>
      ) : (
        <>
        <section className="space-y-3 md:hidden">
          {visibleLeads.map((lead) => (
            <article key={lead.prospectId} className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3 pr-12">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {getInitials(lead.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-ink">{lead.name}</h2>
                  <p className="mt-1 truncate text-sm text-slate-500">{lead.companyName}</p>
                </div>
              </div>
              <IconButton label="Drawer öffnen" disabled={loadingLeadId === lead.prospectId} onClick={() => openDrawer(lead.prospectId)} className="absolute right-4 top-4">
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <div className="mt-4 flex flex-wrap gap-2">
                <WarmthBadge level={lead.engagementLevel} />
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Engagement {lead.engagementScore}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">ICP {lead.icpFitScore}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">{lead.painType ?? "Pain offen"}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{lead.painSummary ?? "Noch kein Pain-Signal dokumentiert."}</p>
              <div className="mt-4 grid gap-2">
                <Progress label="Engagement" value={lead.engagementScore} />
                <Progress label="ICP" value={lead.icpFitScore} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {lead.landingpageUrl ? (
                  <a href={lead.landingpageUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Landingpage
                  </a>
                ) : null}
                {lead.decisionMakerEmail ? (
                  <a href={`mailto:${lead.decisionMakerEmail}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    E-Mail
                  </a>
                ) : null}
                {buildTelHref(lead.phone ?? lead.companyPhone, callingSettings) ? (
                  <a href={buildTelHref(lead.phone ?? lead.companyPhone, callingSettings) ?? undefined} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Anrufen
                  </a>
                ) : (
                  <button type="button" disabled title="Keine Telefonnummer vorhanden" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-300">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Anrufen
                  </button>
                )}
                <button type="button" disabled={isPending} onClick={() => setFollowUp(lead.prospectId)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  Wiedervorlage
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-400">{lead.lastEvent ? prospectEventLabel(lead.lastEvent.type) : "Score-Signal"} · {formatDate(lead.lastActivityAt)}</p>
            </article>
          ))}
          {visibleLeads.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">Keine Hot Leads für diese Suche.</div>
          ) : null}
        </section>
        <section className="hidden overflow-x-auto border-b border-slate-200 md:block">
          <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                <th className="w-[240px] px-3 py-4">Lead</th>
                <th className="w-[220px] px-3 py-4">Unternehmen</th>
                <th className="px-3 py-4">Pain</th>
                <th className="w-[210px] px-3 py-4">Letzte Aktivität</th>
                <th className="w-[210px] px-3 py-4">Score</th>
                <th className="w-[230px] px-3 py-4 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleLeads.map((lead) => (
                <tr
                  key={lead.prospectId}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDrawer(lead.prospectId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openDrawer(lead.prospectId);
                  }}
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="px-3 py-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {getInitials(lead.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{lead.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <WarmthBadge level={lead.engagementLevel} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-5">
                    <p className="truncate font-medium text-slate-700">{lead.companyName}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{lead.city || "k. A."}</p>
                  </td>
                  <td className="px-3 py-5">
                    <p className="truncate font-medium text-slate-700">{lead.painType ?? "Pain offen"}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{lead.painSummary ?? "Noch kein Pain-Signal dokumentiert."}</p>
                  </td>
                  <td className="px-3 py-5">
                    <p className="font-medium text-slate-700">{lead.lastEvent ? prospectEventLabel(lead.lastEvent.type) : "Score-Signal"}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(lead.lastActivityAt)}</p>
                  </td>
                  <td className="px-3 py-5">
                    <div className="space-y-2">
                      <Progress label="Engagement" value={lead.engagementScore} />
                      <Progress label="ICP" value={lead.icpFitScore} />
                    </div>
                  </td>
                  <td className="px-3 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <IconButton label="Drawer öffnen" disabled={loadingLeadId === lead.prospectId} onClick={() => openDrawer(lead.prospectId)}>
                        <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                      {lead.landingpageUrl ? (
                        <a href={lead.landingpageUrl} target="_blank" rel="noreferrer" aria-label="Landingpage öffnen" title="Landingpage öffnen" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : null}
                      {lead.decisionMakerEmail ? (
                        <a href={`mailto:${lead.decisionMakerEmail}`} aria-label="E-Mail schreiben" title="E-Mail schreiben" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                          <Mail className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : null}
                      {buildTelHref(lead.phone ?? lead.companyPhone, callingSettings) ? (
                        <a href={buildTelHref(lead.phone ?? lead.companyPhone, callingSettings) ?? undefined} aria-label="Anrufen" title="Anrufen" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                          <Phone className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : (
                        <button type="button" disabled title="Keine Telefonnummer vorhanden" aria-label="Keine Telefonnummer vorhanden" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-300">
                          <Phone className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      <IconButton label="Wiedervorlage setzen" disabled={isPending} onClick={() => setFollowUp(lead.prospectId)}>
                        <Bell className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-16 text-center text-sm text-slate-500">
                    Keine Hot Leads für diese Suche.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        </>
      )}

      {drawerLead ? (
        <div className="fixed inset-0 z-40 bg-slate-950/30">
          <div className="lead-detail-panel lead-detail-drawer-shell ml-auto bg-slate-50 shadow-2xl">
            <div className="lead-detail-content">
              <ProspectCrmPanel
                prospect={drawerLead}
                previousProspectId={previousLeadId}
                nextProspectId={nextLeadId}
                mode="drawer"
                onClose={() => setDrawerLead(null)}
                onNavigate={openDrawer}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value.toLocaleString("de-DE")}</p>
    </div>
  );
}

function WarmthBadge({ level }: { level: string }) {
  if (level === "hot") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">🔥 Hot</span>;
  if (level === "warm") return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">🟠 Warm</span>;
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">❄️ Cold</span>;
}

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[78px_minmax(0,1fr)_34px] items-center gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="text-right text-xs font-semibold text-slate-600">{value}</span>
    </div>
  );
}

function IconButton({ label, disabled, onClick, children, className = "" }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`btn-secondary inline-grid h-10 w-10 place-items-center rounded-xl ${className}`}
    >
      {children}
    </button>
  );
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
