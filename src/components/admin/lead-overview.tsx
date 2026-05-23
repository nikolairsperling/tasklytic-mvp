"use client";

import { ChevronLeft, ChevronRight, Eye, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { CampaignFlowWizard, type CampaignFlowOffer, type CampaignFlowTemplate } from "@/components/admin/campaign-flow-wizard";
import { ProspectCrmPanel, type ProspectCrmPanelData } from "@/components/admin/prospect-crm-panel";
import { BulkActionBar, BulkResearchLimitModal, LandingpageActions, LeadListAssignModal, ScoreSummary, StatusBadge, exceedsBulkResearchLimit, getBulkSelectionLabel, normalizeBulkApiError, prospectDetailFromApi, toggleVisibleSelection, maxBulkResearchCount, type LeadListOption } from "@/components/admin/prospect-list";
import { bulkDeleteHardConfirmationThreshold, bulkDeleteTypedConfirmation } from "@/lib/bulk-delete";
import { defaultProspectsPageSize, getCompactPaginationPages, normalizeProspectsPageSize, prospectsPageSizeOptions, prospectsPageSizeStorageKey, type PaginatedResponse, type Pagination } from "@/lib/pagination";
import type { LeadActivityType, LeadListItem } from "@/lib/leads";
import { prospectEventLabel } from "@/lib/prospect-events";

type LeadOverviewProps = {
  initialLeads: LeadListItem[];
  pagination: Pagination;
  campaigns?: Array<{ id: string; name: string; status: string }>;
  targetGroups?: Array<{ id: string; name: string }>;
  offers?: CampaignFlowOffer[];
  templates?: CampaignFlowTemplate[];
  leadLists?: LeadListOption[];
};

type ProspectLeadApiItem = {
  id: string;
  companyName: string;
  decisionMakerName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  leadStatus: string;
  icpFitScore: number;
  icpFitLabel: string;
  industry: string | null;
  painType: string | null;
  engagementLevel: string;
  engagementScore: number;
  landingpageUrl: string | null;
  slug: string | null;
  decisionMakerEmail?: string | null;
  companyEmail?: string | null;
  landingpageReviewStatus?: string | null;
  events?: Array<{ id: string; type: string; createdAt: string }>;
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

type SelectionMode = "page" | "allFiltered";
type ProspectBulkFilters = {
  q?: string;
};
type ProspectBulkSelectionPayload = {
  selectionMode: SelectionMode;
  ids?: string[];
  filters?: ProspectBulkFilters;
};

const leadStatusLabels: Record<string, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  interested: "Interessiert",
  not_interested: "Kein Interesse",
  meeting: "Termin",
  customer: "Kunde"
};

export function LeadOverview({ initialLeads, pagination, campaigns = [], targetGroups = [], offers = [], templates = [], leadLists = [] }: LeadOverviewProps) {
  const [query, setQuery] = useState("");
  const [leadItems, setLeadItems] = useState(initialLeads);
  const [currentPagination, setCurrentPagination] = useState(pagination);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [drawerLead, setDrawerLead] = useState<ProspectCrmPanelData | null>(null);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [campaignFlowOpen, setCampaignFlowOpen] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [addToCampaignOpen, setAddToCampaignOpen] = useState(false);
  const [leadListModalOpen, setLeadListModalOpen] = useState(false);
  const [leadListProspectIds, setLeadListProspectIds] = useState<string[]>([]);
  const [researchLimitOpen, setResearchLimitOpen] = useState(false);
  const [bulkCampaignId, setBulkCampaignId] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);

  useEffect(() => {
    setLeadItems(initialLeads);
    setSelectedLeadIds([]);
    setAllFilteredSelected(false);
  }, [initialLeads]);

  useEffect(() => {
    setCurrentPagination(pagination);
  }, [pagination]);

  useEffect(() => {
    const storedLimit = normalizeProspectsPageSize(window.localStorage.getItem(prospectsPageSizeStorageKey));
    if (storedLimit !== currentPagination.limit) {
      void loadPage(1, storedLimit);
    }
  // Run once after hydration so a stored page size can replace the server default.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return leadItems;

    return leadItems.filter((lead) =>
      [
        lead.name,
        lead.company,
        lead.status,
        lead.leadStatus,
        lead.warmth,
        lead.lastEvent ? prospectEventLabel(lead.lastEvent.type) : ""
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [leadItems, query]);

  const drawerIndex = drawerLead ? leads.findIndex((lead) => lead.id === drawerLead.id) : -1;
  const previousLeadId = drawerIndex > 0 ? leads[drawerIndex - 1]?.id : null;
  const nextLeadId = drawerIndex >= 0 && drawerIndex < leads.length - 1 ? leads[drawerIndex + 1]?.id : null;
  const visibleLeadIds = leads.map((lead) => lead.id);
  const totalFiltered = query.trim() ? leads.length : currentPagination.total;
  const selectedCount = allFilteredSelected ? totalFiltered : selectedLeadIds.length;
  const allVisibleSelected = visibleLeadIds.length > 0 && (allFilteredSelected || visibleLeadIds.every((id) => selectedLeadIds.includes(id)));
  const selectedMode: SelectionMode = allFilteredSelected ? "allFiltered" : "page";
  const selectedLabel = getBulkSelectionLabel({ selectedCount, selectedMode });
  const canSelectAllFiltered = !allFilteredSelected && selectedLeadIds.length > 0 && totalFiltered > selectedLeadIds.length;
  const selectedCampaignLeads = leads
    .filter((lead) => allFilteredSelected || selectedLeadIds.includes(lead.id))
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      companyName: lead.company,
      email: lead.decisionMakerEmail ?? lead.companyEmail ?? null,
      landingpageUrl: lead.landingpageUrl,
      slug: lead.slug,
      landingpageReviewStatus: lead.landingpageReviewStatus
    }));

  function getCurrentFilters(): ProspectBulkFilters {
    return {
      q: query.trim()
    };
  }

  function getBulkActionIds(maxIds?: number) {
    return typeof maxIds === "number" ? selectedLeadIds.slice(0, maxIds) : selectedLeadIds;
  }

  function getBulkSelectionPayload(maxIds?: number): ProspectBulkSelectionPayload {
    if (allFilteredSelected) {
      return {
        selectionMode: "allFiltered",
        filters: getCurrentFilters()
      };
    }
    return {
      selectionMode: "page",
      ids: getBulkActionIds(maxIds)
    };
  }

  async function loadPage(page: number, limit = currentPagination.limit) {
    if ((page === currentPagination.page && limit === currentPagination.limit) || loadingPage) return;

    setLoadingPage(page);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));

    try {
      const response = await fetch(`/api/prospects?${params.toString()}`);
      const body = (await response.json().catch(() => null)) as PaginatedResponse<ProspectLeadApiItem> | { error?: string } | null;
      if (!response.ok || !body || !("data" in body)) {
        throw new Error(body && "error" in body ? body.error : "Leads konnten nicht geladen werden.");
      }
      setLeadItems(body.data.map(leadFromApi));
      setCurrentPagination(body.pagination);
      setSelectedLeadIds([]);
      setAllFilteredSelected(false);
      setQuery("");
      window.history.pushState(null, "", getLeadsHref(page, body.pagination.limit));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : "Leads konnten nicht geladen werden.");
    } finally {
      setLoadingPage(null);
    }
  }

  function handlePageSizeChange(limit: number) {
    const nextLimit = normalizeProspectsPageSize(limit);
    window.localStorage.setItem(prospectsPageSizeStorageKey, String(nextLimit));
    setSelectedLeadIds([]);
    setAllFilteredSelected(false);
    void loadPage(1, nextLimit);
  }

  async function openDrawer(leadId: string) {
    setLoadingLeadId(leadId);
    setError(null);

    try {
      const response = await fetch(`/api/prospects/${leadId}`);
      const body = (await response.json().catch(() => null)) as ProspectDetailApiResponse | { error?: string } | null;
      if (!response.ok || !body || !("id" in body)) {
        throw new Error(body && "error" in body ? body.error : "Lead konnte nicht geladen werden.");
      }
      setDrawerLead({ ...prospectDetailFromApi(body), targetGroups });
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Lead konnte nicht geladen werden.");
    } finally {
      setLoadingLeadId(null);
    }
  }

  function handleDrawerSaved(updated: ProspectCrmPanelData) {
    setDrawerLead(updated);
    setLeadItems((current) => current.map((lead) => lead.id === updated.id ? {
      ...lead,
      name: updated.decisionMakerName || [updated.firstName, updated.lastName].filter(Boolean).join(" ") || updated.companyName,
      company: updated.companyName,
      status: updated.status,
      leadStatus: updated.leadStatus,
      icpFitScore: updated.icpFitScore,
      icpFitLabel: updated.icpFitLabel,
      industry: updated.industry,
      painType: updated.painType
    } : lead));
    setError(null);
  }

  async function updateLeadStatus(leadId: string, leadStatus: string) {
    setError(null);
    try {
      const response = await fetch(`/api/prospects/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadStatus })
      });
      const body = (await response.json().catch(() => null)) as { error?: string; leadStatus?: string } | null;
      if (!response.ok || body?.error) {
        throw new Error(body?.error ?? "Lead Status konnte nicht gespeichert werden.");
      }
      setLeadItems((current) => current.map((lead) => lead.id === leadId ? { ...lead, leadStatus: body?.leadStatus ?? leadStatus } : lead));
      if (drawerLead?.id === leadId) {
        setDrawerLead((current) => current ? { ...current, leadStatus: body?.leadStatus ?? leadStatus } : current);
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Lead Status konnte nicht gespeichert werden.");
    }
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) {
      return;
    }

    setBulkDeleting(true);
    setError(null);

    try {
      const ids = getBulkActionIds();
      const response = await fetch("/api/prospects/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...getBulkSelectionPayload(),
          confirmBulkDelete: selectedCount > bulkDeleteHardConfirmationThreshold,
          typedConfirmation: selectedCount > bulkDeleteHardConfirmationThreshold ? bulkDeleteTypedConfirmation : undefined
        })
      });
      const body = (await response.json().catch(() => null)) as { deleted?: number; failed?: number; error?: string } | null;
      if (!response.ok) {
        throw new Error(normalizeBulkApiError(body, "Leads konnten nicht gelöscht werden."));
      }
      setLeadItems((current) => current.filter((lead) => !ids.includes(lead.id)));
      setSelectedLeadIds([]);
      setAllFilteredSelected(false);
      setConfirmBulkDelete(false);
      setToast(`${body?.deleted ?? 0} Leads gelöscht`);
    } catch (deleteError) {
      setError(normalizeBulkApiError(deleteError, "Leads konnten nicht gelöscht werden."));
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleAddSelectedToCampaign() {
    if (!bulkCampaignId || selectedCount === 0) {
      return;
    }

    setBulkAdding(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${bulkCampaignId}/prospects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getBulkSelectionPayload())
      });
      const body = (await response.json().catch(() => null)) as { added?: number; skipped?: number; failed?: number; error?: string } | null;
      if (!response.ok) {
        throw new Error(normalizeBulkApiError(body, "Leads konnten nicht hinzugefügt werden."));
      }
      setSelectedLeadIds([]);
      setAllFilteredSelected(false);
      setBulkCampaignId("");
      setAddToCampaignOpen(false);
      setToast(`${body?.added ?? 0} hinzugefügt, ${body?.skipped ?? 0} übersprungen`);
    } catch (addError) {
      setError(normalizeBulkApiError(addError, "Leads konnten nicht hinzugefügt werden."));
    } finally {
      setBulkAdding(false);
    }
  }

  function handleCreateCampaignSuccess() {
    setSelectedLeadIds([]);
    setAllFilteredSelected(false);
  }

  async function runBulkAction(endpoint: string, success: (body: Record<string, number>) => string, options: { type: "research" | "landingpages"; maxIds?: number }) {
    if (selectedCount === 0) return;
    if (options.type === "research" && exceedsBulkResearchLimit(selectedCount) && !options.maxIds) return;
    if (options.type === "landingpages" && selectedCount > maxBulkResearchCount && typeof window !== "undefined") {
      const confirmed = window.confirm(`${selectedCount.toLocaleString("de-DE")} Landingpages generieren?`);
      if (!confirmed) return;
    }
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getBulkSelectionPayload(options.maxIds))
      });
      const body = (await response.json().catch(() => null)) as Record<string, number> & { error?: string } | null;
      if (!response.ok || !body) throw new Error(normalizeBulkApiError(body, "Bulk-Aktion fehlgeschlagen."));
      setToast(success(body));
      setSelectedLeadIds([]);
      setAllFilteredSelected(false);
      window.location.reload();
    } catch (bulkError) {
      setError(normalizeBulkApiError(bulkError, "Bulk-Aktion fehlgeschlagen."));
    }
  }

  function handleBulkResearchClick() {
    if (exceedsBulkResearchLimit(selectedCount)) {
      setResearchLimitOpen(true);
      return;
    }
    void runBulkAction("/api/prospects/bulk-research", (body) => `${body.processed ?? 0} verarbeitet, ${body.enriched ?? 0} angereichert, ${body.skipped ?? 0} übersprungen, ${body.failed ?? 0} fehlgeschlagen`, { type: "research" });
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 md:mb-8 md:gap-5 md:pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal text-ink md:text-3xl">Alle Leads</h1>
          <p className="mt-2 text-sm text-slate-500">
            {currentPagination.total.toLocaleString("de-DE")} Einträge · Seite {currentPagination.page} von {currentPagination.totalPages} · {currentPagination.limit} pro Seite
            {query ? ` · ${leads.length.toLocaleString("de-DE")} Treffer` : ""}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:max-w-2xl md:flex-row md:items-end md:justify-end">
          <label className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <span className="sr-only">Leads suchen</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Suchen"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Suche löschen"
                title="Suche löschen"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Leads pro Seite</span>
            <select
              value={currentPagination.limit}
              onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
            >
              {prospectsPageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </header>

      {error ? (
        <div role="status" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {toast}
        </div>
      ) : null}

      <div className="static z-20 mb-5 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:sticky md:top-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex min-w-0 max-w-full items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0"
              checked={allVisibleSelected}
              onChange={(event) => {
                setAllFilteredSelected(false);
                setSelectedLeadIds((current) => toggleVisibleSelection(current, visibleLeadIds, event.target.checked));
              }}
            />
            <span className="min-w-0 break-words">Alle sichtbaren auswählen</span>
          </label>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedCount}
        selectionLabel={selectedLabel}
        selectedMode={selectedMode}
        canSelectAllFiltered={canSelectAllFiltered}
        totalFiltered={totalFiltered}
        bulkDeleting={bulkDeleting}
        onSelectAllFiltered={() => {
          setAllFilteredSelected(true);
          setSelectedLeadIds(visibleLeadIds);
        }}
        researchLimited={exceedsBulkResearchLimit(selectedCount)}
        onResearch={handleBulkResearchClick}
        onGenerateLandingpages={() => void runBulkAction("/api/prospects/bulk-generate-landingpages", (body) => `${body.generated ?? 0} Landingpages generiert, ${body.skipped ?? 0} übersprungen, ${body.failed ?? 0} fehlgeschlagen`, { type: "landingpages" })}
        onAddToCampaign={() => setAddToCampaignOpen(true)}
        onAssignLeadList={() => {
          setLeadListProspectIds(allFilteredSelected ? [] : getBulkActionIds());
          setLeadListModalOpen(true);
        }}
        onDelete={() => setConfirmBulkDelete(true)}
      />

      <section className="space-y-3 md:hidden">
        {leads.map((lead) => {
          const active = drawerLead?.id === lead.id;

          return (
            <article
              key={lead.id}
              role="button"
              tabIndex={0}
              onClick={() => openDrawer(lead.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  openDrawer(lead.id);
                }
              }}
              className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${active ? "border-blue-200 ring-2 ring-blue-100" : "border-slate-200"}`}
            >
              <div className="flex min-w-0 items-start gap-3 pr-12" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`${lead.name} auswählen`}
                  checked={allFilteredSelected || selectedLeadIds.includes(lead.id)}
                  onChange={(event) => {
                    setAllFilteredSelected(false);
                    setSelectedLeadIds((current) => {
                      const base = allFilteredSelected ? visibleLeadIds : current;
                      return event.target.checked ? [...new Set([...base, lead.id])] : base.filter((id) => id !== lead.id);
                    });
                  }}
                  onClick={(event) => event.stopPropagation()}
                  className="mt-3 h-5 w-5 shrink-0"
                />
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {getInitials(lead.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-base font-semibold text-ink">{lead.name}</h2>
                  <p className="mt-1 break-words text-sm text-slate-500">{lead.company}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openDrawer(lead.id)}
                disabled={loadingLeadId === lead.id}
                aria-label={`${lead.name} öffnen`}
                title="Öffnen"
                className="btn-secondary absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge status={lead.status} />
              </div>

              {(lead.industry || lead.painType) ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {lead.industry ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{lead.industry}</span> : null}
                  {lead.painType ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">{lead.painType}</span> : null}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Kampagnenstatus</span>
                  <select
                    value={lead.leadStatus}
                    onChange={(event) => updateLeadStatus(lead.id, event.target.value)}
                    aria-label="Lead Status ändern"
                    onClick={(event) => event.stopPropagation()}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                  >
                    {Object.entries(leadStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>

                <ScoreSummary score={lead.score} icpLabel={lead.icpFitLabel} icpScore={lead.icpFitScore} engagementLevel={lead.warmth} engagementScore={lead.score} />

                <div className="text-sm text-slate-500">
                  {lead.lastEvent ? (
                    <p className="break-words">
                      <span className="font-medium text-slate-700">{prospectEventLabel(lead.lastEvent.type)}</span>
                      <span className="text-slate-400"> · {formatDate(lead.lastEvent.createdAt)}</span>
                    </p>
                  ) : (
                    <span>Keine Aktivität</span>
                  )}
                </div>
                <div>
                  <p className="break-words text-xs font-medium text-slate-600">{lead.slug ? `/p/${lead.slug}` : "Nicht erstellt"}</p>
                  <div className="mt-2">
                    <LandingpageActions slug={lead.slug} landingpageUrl={lead.landingpageUrl} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {leads.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            Keine Leads gefunden.
          </div>
        ) : null}
      </section>

      <section className="hidden w-full min-w-0 max-w-full overflow-x-auto border-b border-slate-200 md:block">
        <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              <th className="w-10 px-3 py-4">
                <label className="inline-flex items-center" title="Alle sichtbaren auswählen">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={allVisibleSelected}
                    onChange={(event) => {
                      setAllFilteredSelected(false);
                      setSelectedLeadIds((current) => toggleVisibleSelection(current, visibleLeadIds, event.target.checked));
                    }}
                    aria-label="Alle sichtbaren auswählen"
                  />
                </label>
              </th>
              <th className="w-20 px-3 py-4"></th>
              <th className="px-3 py-4">Lead / Firma</th>
              <th className="w-44 px-3 py-4">Status</th>
              <th className="w-48 px-3 py-4">Scores</th>
              <th className="w-56 px-3 py-4">Letzte Aktivität</th>
              <th className="w-44 px-3 py-4">Landingpage</th>
              <th className="w-28 px-3 py-4 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const active = drawerLead?.id === lead.id;

              return (
                <tr
                  key={lead.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDrawer(lead.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openDrawer(lead.id);
                  }}
                  className={`cursor-pointer transition ${active ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <td className="px-3 py-5" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0"
                      aria-label={`${lead.name} auswählen`}
                    checked={allFilteredSelected || selectedLeadIds.includes(lead.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      setAllFilteredSelected(false);
                      setSelectedLeadIds((current) => {
                        const base = allFilteredSelected ? visibleLeadIds : current;
                        return event.target.checked ? [...new Set([...base, lead.id])] : base.filter((id) => id !== lead.id);
                      });
                    }}
                    />
                  </td>
                  <td className="px-3 py-5">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {getInitials(lead.name)}
                    </span>
                  </td>
                  <td className="min-w-0 px-3 py-5">
                    <p className="truncate font-semibold text-ink">{lead.name}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">{lead.company}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lead.industry ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{lead.industry}</span> : null}
                      {lead.painType ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{lead.painType}</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-5">
                    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                      <StatusBadge status={lead.status} />
                      <select
                        value={lead.leadStatus}
                        onChange={(event) => updateLeadStatus(lead.id, event.target.value)}
                        aria-label="Lead Status ändern"
                        onClick={(event) => event.stopPropagation()}
                        className="block h-9 max-w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
                      >
                        {Object.entries(leadStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-5">
                    <ScoreSummary score={lead.score} icpLabel={lead.icpFitLabel} icpScore={lead.icpFitScore} engagementLevel={lead.warmth} engagementScore={lead.score} />
                  </td>
                  <td className="px-3 py-5">
                    {lead.lastEvent ? (
                      <div>
                        <p className="font-medium text-slate-700">{prospectEventLabel(lead.lastEvent.type)}</p>
                        <p className="mt-1 text-xs text-slate-400">{formatDate(lead.lastEvent.createdAt)}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">Keine Aktivität</span>
                    )}
                  </td>
                  <td className="min-w-0 px-3 py-5" onClick={(event) => event.stopPropagation()}>
                    <p className="truncate text-xs font-medium text-slate-600">{lead.slug ? `/p/${lead.slug}` : "Nicht erstellt"}</p>
                    <div className="mt-2">
                      <LandingpageActions slug={lead.slug} landingpageUrl={lead.landingpageUrl} />
                    </div>
                  </td>
                  <td className="px-3 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openDrawer(lead.id)}
                      disabled={loadingLeadId === lead.id}
                      aria-label={`${lead.name} öffnen`}
                      title="Öffnen"
                      className="btn-secondary inline-grid h-10 w-10 place-items-center rounded-xl"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-16 text-center text-sm text-slate-500">
                  Keine Leads gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => loadPage(currentPagination.page - 1)}
          disabled={currentPagination.page <= 1 || Boolean(loadingPage)}
          className="btn-secondary inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </button>
        <div className="flex flex-wrap gap-2">
          {getCompactPaginationPages(currentPagination.page, currentPagination.totalPages).map((page, index) => (
            page === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="grid h-10 min-w-10 place-items-center text-sm font-semibold text-slate-400">...</span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => loadPage(page)}
                disabled={Boolean(loadingPage)}
                aria-current={currentPagination.page === page ? "page" : undefined}
                className={`h-10 min-w-10 rounded-xl px-3 text-sm font-semibold ${
                  currentPagination.page === page
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                } disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400`}
              >
                {page}
              </button>
            )
          ))}
        </div>
        <button
          type="button"
          onClick={() => loadPage(currentPagination.page + 1)}
          disabled={currentPagination.page >= currentPagination.totalPages || Boolean(loadingPage)}
          className="btn-secondary inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          Weiter
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {confirmBulkDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="bulk-delete-leads-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="bulk-delete-leads-title" className="text-lg font-semibold text-ink">
              Leads löschen?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {selectedCount} ausgewählte Leads werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting} className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-medium sm:w-auto">
                Abbrechen
              </button>
              <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting} className="btn-danger w-full rounded-xl px-4 py-2 text-sm font-semibold sm:w-auto">
                {bulkDeleting ? "Löscht..." : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {researchLimitOpen ? (
        <BulkResearchLimitModal
          selectedCount={selectedCount}
          onCancel={() => setResearchLimitOpen(false)}
          onRunFirstBatch={() => {
            setResearchLimitOpen(false);
            void runBulkAction("/api/prospects/bulk-research", (body) => `${body.processed ?? 0} verarbeitet, ${body.enriched ?? 0} angereichert, ${body.skipped ?? 0} übersprungen, ${body.failed ?? 0} fehlgeschlagen`, { type: "research", maxIds: maxBulkResearchCount });
          }}
        />
      ) : null}

      {addToCampaignOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="add-leads-to-campaign-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="add-leads-to-campaign-title" className="text-lg font-semibold text-ink">
              Zur Kampagne hinzufügen
            </h3>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block">Bestehende Kampagne</span>
                <select
                  value={bulkCampaignId}
                  onChange={(event) => setBulkCampaignId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Bitte Kampagne auswählen</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} · {campaign.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setAddToCampaignOpen(false)} disabled={bulkAdding} className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-medium sm:w-auto">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleAddSelectedToCampaign}
                disabled={!bulkCampaignId || bulkAdding}
                className="btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {bulkAdding ? "Fügt hinzu..." : "Hinzufügen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LeadListAssignModal
        open={leadListModalOpen}
        selectedCount={selectedCount}
        prospectIds={leadListProspectIds}
        selectionPayload={getBulkSelectionPayload()}
        leadLists={leadLists}
        targetGroups={targetGroups}
        onClose={() => setLeadListModalOpen(false)}
        onSuccess={(message) => {
          setToast(message);
          setSelectedLeadIds([]);
          setAllFilteredSelected(false);
          setLeadListProspectIds([]);
          setLeadListModalOpen(false);
          window.location.reload();
        }}
        onError={setError}
      />

      {drawerLead ? (
        <div className="fixed inset-0 z-[120] bg-slate-950/30">
          <div className="lead-detail-panel lead-detail-drawer-shell ml-auto bg-slate-50 shadow-2xl">
            <div className="lead-detail-content">
              <ProspectCrmPanel
                prospect={drawerLead}
                previousProspectId={previousLeadId}
                nextProspectId={nextLeadId}
                mode="drawer"
                onClose={() => setDrawerLead(null)}
                onNavigate={openDrawer}
                onSaved={handleDrawerSaved}
              />
            </div>
          </div>
        </div>
      ) : null}
      <CampaignFlowWizard
        open={campaignFlowOpen}
        leads={selectedCampaignLeads}
        targetGroups={targetGroups}
        offers={offers}
        templates={templates}
        leadLists={leadLists}
        onClose={() => setCampaignFlowOpen(false)}
        onSuccess={(result) => {
          setToast(`Kampagne erstellt. ${result.added} Leads hinzugefügt. ${result.skipped} übersprungen.`);
          handleCreateCampaignSuccess();
        }}
      />
    </div>
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

function getLeadsHref(page: number, limit: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (limit !== defaultProspectsPageSize) params.set("limit", String(normalizeProspectsPageSize(limit)));
  const query = params.toString();
  return query ? `/admin/leads?${query}` : "/admin/leads";
}

function leadFromApi(prospect: ProspectLeadApiItem): LeadListItem {
  const fullName = [prospect.firstName, prospect.lastName].filter(Boolean).join(" ").trim();
  const name = prospect.decisionMakerName || fullName || prospect.companyName;
  const event = prospect.events?.[0];

  return {
    id: prospect.id,
    name,
    company: prospect.companyName,
    status: prospect.status,
    leadStatus: prospect.leadStatus,
    icpFitScore: prospect.icpFitScore,
    icpFitLabel: prospect.icpFitLabel,
    industry: prospect.industry,
    painType: prospect.painType,
    warmth: prospect.engagementLevel || "cold",
    score: Math.max(0, Math.min(100, prospect.engagementScore ?? 0)),
    lastEvent: isLeadActivityType(event?.type)
      ? {
          id: event.id,
          type: event.type,
          createdAt: event.createdAt
        }
      : null,
    landingpageUrl: prospect.landingpageUrl || (prospect.slug ? `/p/${prospect.slug}` : null),
    slug: prospect.slug,
    decisionMakerEmail: prospect.decisionMakerEmail,
    companyEmail: prospect.companyEmail,
    landingpageReviewStatus: prospect.landingpageReviewStatus
  };
}

function isLeadActivityType(value: string | undefined): value is LeadActivityType {
  return value === "video_watched" || value === "page_view" || value === "cta_clicked";
}
