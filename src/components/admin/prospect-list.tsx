"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Copy, ExternalLink, Eye, FilePlus2, FolderPlus, ListPlus, Loader2, Pencil, PhoneCall, PhoneOff, Search, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import type { CampaignFlowOffer, CampaignFlowTemplate, CampaignFlowTargetGroup } from "@/components/admin/campaign-flow-wizard";
import { ProspectCrmPanel, type ProspectCrmPanelData } from "@/components/admin/prospect-crm-panel";
import { bulkDeleteHardConfirmationThreshold, bulkDeleteTypedConfirmation } from "@/lib/bulk-delete";
import {
  defaultProspectsPageSize,
  getCompactPaginationPages,
  normalizeProspectsPageSize,
  prospectsPageSizeOptions,
  prospectsPageSizeStorageKey,
  type PaginatedResponse,
  type Pagination
} from "@/lib/pagination";
import type { ProspectStatus } from "@/lib/prospect-status";

export type ProspectListItem = {
  id: string;
  companyName: string;
  city: string;
  country: string;
  totalScore: number;
  engagementScore: number;
  engagementLevel: string;
  isHotLead: boolean;
  icpCategory: string;
  icpFitScore: number;
  icpFitLabel: string;
  industry: string | null;
  painType: string | null;
  painSignals: unknown;
  status: string;
  leadStatus?: string;
  slug: string | null;
  websiteUrl?: string | null;
  websiteOriginal?: string | null;
  websiteVerified?: boolean | null;
  websiteCandidate?: string | null;
  websiteConfidence?: number | null;
  phone?: string | null;
  companyPhone?: string | null;
  decisionMakerName?: string | null;
  decisionMakerRole?: string | null;
  decisionMakerEmail?: string | null;
  decisionMakerPhone?: string | null;
  decisionMakerSourceUrl?: string | null;
  decisionMakerSourceTextSnippet?: string | null;
  decisionMakerFoundAt?: string | Date | null;
  decisionMakerConfidence?: string | null;
  contactCandidates?: unknown;
  companyEmail?: string | null;
  emailOriginal?: string | null;
  emailVerified?: boolean | null;
  emailCandidate?: string | null;
  emailConfidence?: number | null;
  companyMatchConfidence?: number | null;
  companyMatchSource?: string | null;
  landingpageUrl?: string | null;
  landingpageReviewStatus?: string | null;
  researchStatus?: string | null;
  researchedAt?: string | Date | null;
  lastResearchError?: string | null;
  lastResearchErrorCode?: string | null;
  lastResearchAt?: string | Date | null;
  failedStep?: string | null;
  sourceUrl?: string | null;
  lastAttemptAt?: string | Date | null;
  lastSuccessfulResearchAt?: string | Date | null;
  enrichmentNotes?: string | null;
  followUpAt?: string | null;
  followUpReason?: string | null;
  followUpStatus?: string | null;
  lastContactedAt?: string | null;
  lastEmailSentAt?: string | null;
  aiCallStatus?: string;
  aiCallRecommended?: boolean;
  aiCallPriority?: "none" | "normal" | "high";
  aiCallPlannedFor?: string | null;
  aiCallBlockers?: string[];
  printMailingRecommended?: boolean;
  targetGroup?: { id: string; name: string } | null;
  updatedAt?: string | Date | null;
};

export type CampaignListItem = {
  id: string;
  name: string;
  status: string;
};

export type LeadListOption = {
  id: string;
  name: string;
  targetGroupId?: string | null;
  count?: number;
};

type ProspectListProps = {
  prospects: ProspectListItem[];
  campaigns?: CampaignListItem[];
  selectedProspectId?: string;
  activeStatus?: ProspectStatus | "all";
  scoreFilter?: "all" | "hot" | "medium" | "low";
  searchQuery?: string;
  leadListId?: string;
  followUpFilter?: "all" | "due" | "contacted_no_reply";
  dashboardFilter?: string;
  pagination: Pagination;
  initialDrawerProspect?: ProspectCrmPanelData | null;
  targetGroups?: CampaignFlowTargetGroup[];
  offers?: CampaignFlowOffer[];
  templates?: CampaignFlowTemplate[];
  leadLists?: LeadListOption[];
};

const scoreFilterLabels = {
  all: "Alle Scores",
  hot: "Hot Leads",
  medium: "Medium",
  low: "Low"
} as const;

const statusLabels: Record<string, string> = {
  all: "Alle Status",
  draft: "Entwurf",
  qualified: "Qualifiziert",
  landingpage_ready: "Landingpage bereit",
  contacted: "Kontaktiert",
  responded: "Geantwortet",
  disqualified: "Disqualifiziert"
};

export const maxBulkResearchCount = 20;
type ResearchProgressItem = { status: "waiting" | "running" | "completed" | "skipped" | "failed"; message?: string; leadName?: string; source?: string };
type SelectionMode = "page" | "allFiltered";
type ProspectBulkFilters = {
  status?: string;
  score?: "all" | "hot" | "medium" | "low";
  q?: string;
  leadListId?: string;
  followUp?: "all" | "due" | "contacted_no_reply";
};
type ProspectBulkSelectionPayload = {
  selectionMode: SelectionMode;
  ids?: string[];
  filters?: ProspectBulkFilters;
};

export function toggleVisibleSelection(currentIds: string[], visibleIds: string[], checked: boolean) {
  const next = new Set(currentIds);
  if (checked) {
    visibleIds.forEach((id) => next.add(id));
  } else {
    visibleIds.forEach((id) => next.delete(id));
  }
  return [...next];
}

export function getBulkSelectionLabel({
  selectedCount,
  selectedMode
}: {
  selectedCount: number;
  selectedMode: SelectionMode;
}) {
  return selectedMode === "allFiltered"
    ? `Alle ${selectedCount.toLocaleString("de-DE")} gefilterten Leads ausgewählt`
    : `${selectedCount.toLocaleString("de-DE")} Leads auf dieser Seite ausgewählt`;
}

export function exceedsBulkResearchLimit(selectedCount: number) {
  return selectedCount > maxBulkResearchCount;
}

export function getBulkResearchBatchIds(ids: string[]) {
  return ids.slice(0, maxBulkResearchCount);
}

export function requiresBulkDeleteTypedConfirmation(selectedCount: number) {
  return selectedCount > bulkDeleteHardConfirmationThreshold;
}

export function normalizeBulkApiError(error: unknown, fallback = "Bulk-Aktion fehlgeschlagen.") {
  const rawMessage = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "error" in error && typeof error.error === "string"
        ? error.error
        : "";

  if (rawMessage.includes("too_big") || rawMessage.includes("\"maximum\":20") || rawMessage.includes("\"maximum\": 20")) {
    return "Maximal 20 Leads pro Lauf erlaubt. Bitte wähle höchstens 20 Leads aus oder starte mehrere Läufe.";
  }

  if (rawMessage.trim().startsWith("[") || rawMessage.trim().startsWith("{")) {
    return fallback;
  }

  if (/load failed|failed to fetch|networkerror/i.test(rawMessage)) {
    return "Status konnte nicht geladen werden. Erneut versuchen.";
  }

  return rawMessage || fallback;
}

const formatIcpLabel = (value: string | null | undefined) => {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  return "Low";
};

export function getProspectListHref({
  prospectId,
  activeStatus = "all",
  scoreFilter = "all",
  searchQuery = "",
  leadListId = "",
  followUpFilter = "all",
  dashboardFilter = "",
  page,
  limit
}: {
  prospectId?: string;
  activeStatus?: ProspectStatus | "all";
  scoreFilter?: "all" | "hot" | "medium" | "low";
  searchQuery?: string;
  leadListId?: string;
  followUpFilter?: "all" | "due" | "contacted_no_reply";
  dashboardFilter?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (prospectId) {
    params.set("prospectId", prospectId);
  }
  if (activeStatus !== "all") {
    params.set("status", activeStatus);
  }
  if (scoreFilter !== "all") {
    params.set("score", scoreFilter);
  }
  if (searchQuery.trim()) {
    params.set("q", searchQuery.trim());
  }
  if (leadListId.trim()) {
    params.set("leadListId", leadListId.trim());
  }
  if (followUpFilter !== "all") {
    params.set("followUp", followUpFilter);
  }
  if (dashboardFilter.trim()) {
    params.set("dashboardFilter", dashboardFilter.trim());
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }
  if (limit && limit !== defaultProspectsPageSize) {
    params.set("limit", String(normalizeProspectsPageSize(limit)));
  }

  const query = params.toString();
  return query ? `/admin/prospects?${query}` : "/admin/prospects";
}

export function normalizeExternalWebsiteHref(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function removeProspectFromList(prospects: ProspectListItem[], prospectId: string) {
  return prospects.filter((prospect) => prospect.id !== prospectId);
}

export async function deleteProspect(
  prospectId: string,
  fetcher: typeof fetch = fetch
) {
  const response = await fetcher(`/api/prospects/${prospectId}`, { method: "DELETE" });
  if (!response.ok) {
    let message = "Prospect konnte nicht gelöscht werden.";
    try {
      const body = await response.json() as { error?: string };
      message = body.error ?? message;
    } catch {
      // Keep the fallback message when the API returns no JSON body.
    }
    throw new Error(message);
  }
}

export function getPaginationPages(totalPages: number) {
  return Array.from({ length: Math.max(1, totalPages) }, (_, index) => index + 1);
}

function prospectFromApi(prospect: ProspectListItem) {
  return {
    id: prospect.id,
    companyName: prospect.companyName,
    city: prospect.city,
    country: prospect.country,
    totalScore: prospect.totalScore,
    engagementScore: prospect.engagementScore,
    engagementLevel: prospect.engagementLevel,
    isHotLead: prospect.isHotLead,
    icpCategory: prospect.icpCategory,
    icpFitScore: prospect.icpFitScore,
    icpFitLabel: prospect.icpFitLabel,
    industry: prospect.industry,
    painType: prospect.painType,
    painSignals: prospect.painSignals,
    status: prospect.status,
    leadStatus: prospect.leadStatus,
    slug: prospect.slug,
    websiteUrl: prospect.websiteUrl ?? null,
    phone: prospect.phone,
    companyPhone: prospect.companyPhone,
    decisionMakerEmail: prospect.decisionMakerEmail,
    companyEmail: prospect.companyEmail,
    landingpageUrl: prospect.landingpageUrl,
    landingpageReviewStatus: prospect.landingpageReviewStatus,
    researchStatus: prospect.researchStatus,
    websiteOriginal: prospect.websiteOriginal,
    websiteVerified: prospect.websiteVerified,
    websiteCandidate: prospect.websiteCandidate,
    websiteConfidence: prospect.websiteConfidence,
    emailOriginal: prospect.emailOriginal,
    emailVerified: prospect.emailVerified,
    emailCandidate: prospect.emailCandidate,
    emailConfidence: prospect.emailConfidence,
    companyMatchConfidence: prospect.companyMatchConfidence,
    companyMatchSource: prospect.companyMatchSource,
    researchedAt: prospect.researchedAt,
    lastResearchError: prospect.lastResearchError,
    lastResearchErrorCode: prospect.lastResearchErrorCode,
    lastResearchAt: prospect.lastResearchAt,
    failedStep: prospect.failedStep,
    sourceUrl: prospect.sourceUrl,
    lastAttemptAt: prospect.lastAttemptAt,
    lastSuccessfulResearchAt: prospect.lastSuccessfulResearchAt,
    enrichmentNotes: prospect.enrichmentNotes,
    followUpAt: prospect.followUpAt,
    followUpReason: prospect.followUpReason,
    followUpStatus: prospect.followUpStatus,
    lastContactedAt: prospect.lastContactedAt,
    lastEmailSentAt: prospect.lastEmailSentAt,
    aiCallStatus: prospect.aiCallStatus,
    aiCallRecommended: prospect.aiCallRecommended,
    aiCallPriority: prospect.aiCallPriority,
    aiCallPlannedFor: prospect.aiCallPlannedFor,
    aiCallBlockers: prospect.aiCallBlockers,
    printMailingRecommended: prospect.printMailingRecommended,
    targetGroup: prospect.targetGroup,
    updatedAt: prospect.updatedAt
  };
}

export function ProspectList({
  prospects,
  campaigns = [],
  selectedProspectId,
  activeStatus = "all",
  scoreFilter = "all",
  searchQuery = "",
  leadListId = "",
  followUpFilter = "all",
  dashboardFilter = "",
  pagination,
  initialDrawerProspect = null,
  targetGroups = [],
  offers = [],
  templates = [],
  leadLists = []
}: ProspectListProps) {
  const router = useRouter();
  const [visibleProspects, setVisibleProspects] = useState(prospects);
  const [currentPagination, setCurrentPagination] = useState(pagination);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [drawerProspect, setDrawerProspect] = useState<ProspectCrmPanelData | null>(initialDrawerProspect);
  const [loadingProspectId, setLoadingProspectId] = useState<string | null>(null);
  const [confirmProspect, setConfirmProspect] = useState<ProspectListItem | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleteTypedInput, setBulkDeleteTypedInput] = useState("");
  const [addToCampaignOpen, setAddToCampaignOpen] = useState(false);
  const [leadListModalOpen, setLeadListModalOpen] = useState(false);
  const [leadListProspectIds, setLeadListProspectIds] = useState<string[]>([]);
  const [researchLimitOpen, setResearchLimitOpen] = useState(false);
  const [bulkCampaignId, setBulkCampaignId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkAction, setBulkAction] = useState<null | "research" | "landingpages" | "campaign" | "leadlist" | "delete">(null);
  const [callActionId, setCallActionId] = useState<string | null>(null);
  const [forceResearch, setForceResearch] = useState(false);
  const [researchProgress, setResearchProgress] = useState<Record<string, ResearchProgressItem>>({});
  const [researchCompletedCount, setResearchCompletedCount] = useState(0);
  const [researchTotalCount, setResearchTotalCount] = useState(0);
  const [researchDetailsProspect, setResearchDetailsProspect] = useState<ProspectListItem | null>(null);
  const [printMailingProspect, setPrintMailingProspect] = useState<ProspectListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<SelectionMode>("page");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setVisibleProspects(prospects);
    setSelectedIds([]);
    setSelectedMode("page");
  }, [prospects]);

  useEffect(() => {
    setCurrentPagination(pagination);
  }, [pagination]);

  useEffect(() => {
    setDrawerProspect(initialDrawerProspect);
  }, [initialDrawerProspect]);

  useEffect(() => {
    const storedLimit = normalizeProspectsPageSize(window.localStorage.getItem(prospectsPageSizeStorageKey));
    if (storedLimit !== currentPagination.limit) {
      void loadPage(1, storedLimit);
    }
  // Run once after hydration so a stored page size can replace the server default.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetHref = useMemo(
    () => getProspectListHref({ activeStatus, scoreFilter, searchQuery, leadListId, followUpFilter, dashboardFilter, limit: currentPagination.limit }),
    [activeStatus, scoreFilter, searchQuery, leadListId, followUpFilter, dashboardFilter, currentPagination.limit]
  );

  const scoreBadgeSignals = (value: ProspectListItem["painSignals"]) =>
    (Array.isArray(value) ? (value as Array<{ label?: string; type?: string }>) : []).slice(0, 3);

  const scoreLinks = [
    { key: "all", label: scoreFilterLabels.all },
    { key: "hot", label: scoreFilterLabels.hot },
    { key: "medium", label: scoreFilterLabels.medium },
    { key: "low", label: scoreFilterLabels.low }
  ] as const;

  const statusLinks = ["all", "draft", "qualified", "landingpage_ready", "contacted", "responded", "disqualified"] as const;

  async function loadPage(page: number, limit = currentPagination.limit) {
    if ((page === currentPagination.page && limit === currentPagination.limit) || loadingPage) return;

    setLoadingPage(page);
    setToast(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (activeStatus !== "all") params.set("status", activeStatus);
    if (scoreFilter !== "all") params.set("score", scoreFilter);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (leadListId) params.set("leadListId", leadListId);
    if (followUpFilter !== "all") params.set("followUp", followUpFilter);
    if (dashboardFilter) params.set("dashboardFilter", dashboardFilter);

    try {
      const response = await fetch(`/api/prospects?${params.toString()}`);
      const body = (await response.json().catch(() => null)) as PaginatedResponse<ProspectListItem> | { error?: string } | null;
      if (!response.ok || !body || !("data" in body)) {
        throw new Error(body && "error" in body ? body.error : "Prospects konnten nicht geladen werden.");
      }
      setVisibleProspects(body.data.map(prospectFromApi));
      setCurrentPagination(body.pagination);
      setSelectedIds([]);
      setSelectedMode("page");
      window.history.pushState(null, "", getProspectListHref({ activeStatus, scoreFilter, searchQuery, leadListId, followUpFilter, dashboardFilter, page, limit: body.pagination.limit }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Prospects konnten nicht geladen werden."
      });
    } finally {
      setLoadingPage(null);
    }
  }

  async function refreshCurrentPage(options: { preserveSelection?: boolean } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(currentPagination.page));
    params.set("limit", String(currentPagination.limit));
    if (activeStatus !== "all") params.set("status", activeStatus);
    if (scoreFilter !== "all") params.set("score", scoreFilter);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (leadListId) params.set("leadListId", leadListId);
    if (followUpFilter !== "all") params.set("followUp", followUpFilter);
    if (dashboardFilter) params.set("dashboardFilter", dashboardFilter);

    const response = await fetch(`/api/prospects?${params.toString()}`);
    const body = (await response.json().catch(() => null)) as PaginatedResponse<ProspectListItem> | { error?: string } | null;
    if (!response.ok || !body || !("data" in body)) {
      throw new Error(body && "error" in body ? body.error : "Prospects konnten nicht aktualisiert werden.");
    }
    setVisibleProspects(body.data.map(prospectFromApi));
    setCurrentPagination(body.pagination);
    if (!options.preserveSelection) {
      setSelectedIds([]);
      setSelectedMode("page");
    }
  }

  async function openProspectDrawer(prospectId: string) {
    setLoadingProspectId(prospectId);
    setToast(null);

    try {
      const response = await fetch(`/api/prospects/${prospectId}`);
      const body = (await response.json().catch(() => null)) as ProspectDetailApiResponse | { error?: string } | null;
      if (!response.ok || !body || !("id" in body)) {
        throw new Error(body && "error" in body ? body.error : "Prospect konnte nicht geladen werden.");
      }
      setDrawerProspect(prospectDetailFromApi(body));
      const url = getProspectListHref({ activeStatus, scoreFilter, searchQuery, leadListId, followUpFilter, dashboardFilter, page: currentPagination.page, limit: currentPagination.limit });
      const separator = url.includes("?") ? "&" : "?";
      window.history.pushState(null, "", `${url}${separator}prospectId=${prospectId}`);
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Prospect konnte nicht geladen werden."
      });
    } finally {
      setLoadingProspectId(null);
    }
  }

  function closeDrawer() {
    setDrawerProspect(null);
    window.history.pushState(null, "", getProspectListHref({ activeStatus, scoreFilter, searchQuery, leadListId, followUpFilter, dashboardFilter, page: currentPagination.page, limit: currentPagination.limit }));
  }

  function handlePageSizeChange(limit: number) {
    const nextLimit = normalizeProspectsPageSize(limit);
    window.localStorage.setItem(prospectsPageSizeStorageKey, String(nextLimit));
    setSelectedIds([]);
    setSelectedMode("page");
    void loadPage(1, nextLimit);
  }

  const drawerIndex = drawerProspect ? visibleProspects.findIndex((prospect) => prospect.id === drawerProspect.id) : -1;
  const previousProspectId = drawerIndex > 0 ? visibleProspects[drawerIndex - 1]?.id : null;
  const nextProspectId = drawerIndex >= 0 && drawerIndex < visibleProspects.length - 1 ? visibleProspects[drawerIndex + 1]?.id : null;
  const visibleIds = visibleProspects.map((prospect) => prospect.id);
  const allFilteredSelected = selectedMode === "allFiltered";
  const allVisibleSelected = visibleIds.length > 0 && (allFilteredSelected || visibleIds.every((id) => selectedIds.includes(id)));
  const selectedProspects = visibleProspects.filter((prospect) => allFilteredSelected || selectedIds.includes(prospect.id));
  const selectedCampaignLeads = selectedProspects.map((prospect) => ({
    id: prospect.id,
    name: prospect.companyName,
    companyName: prospect.companyName,
    email: prospect.decisionMakerEmail ?? prospect.companyEmail ?? null,
    landingpageUrl: prospect.landingpageUrl ?? (prospect.slug ? `/p/${prospect.slug}` : null),
    slug: prospect.slug,
    landingpageReviewStatus: prospect.landingpageReviewStatus
  }));
  const selectedCount = allFilteredSelected ? currentPagination.total : selectedIds.length;
  const selectedLabel = getBulkSelectionLabel({ selectedCount, selectedMode });
  const canSelectAllFiltered = !allFilteredSelected && selectedIds.length > 0 && currentPagination.total > selectedIds.length;

  function getCurrentFilters(): ProspectBulkFilters {
    return {
      status: activeStatus,
      score: scoreFilter,
      q: searchQuery.trim(),
      leadListId: leadListId.trim(),
      followUp: followUpFilter
    };
  }

  function getBulkSelectionPayload(ids = selectedIds): ProspectBulkSelectionPayload {
    if (selectedMode === "allFiltered") {
      return {
        selectionMode: "allFiltered",
        filters: getCurrentFilters()
      };
    }
    return {
      selectionMode: "page",
      ids
    };
  }

  async function handleDelete() {
    if (!confirmProspect) {
      return;
    }

    setDeletingId(confirmProspect.id);
    setToast(null);

    try {
      await deleteProspect(confirmProspect.id);
      setVisibleProspects((current) => removeProspectFromList(current, confirmProspect.id));
      setToast({ type: "success", message: "Prospect gelöscht" });
      setConfirmProspect(null);

      if (selectedProspectId === confirmProspect.id) {
        router.push(resetHref);
      }
      router.refresh();
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Prospect konnte nicht gelöscht werden."
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    if (requiresBulkDeleteTypedConfirmation(selectedCount) && bulkDeleteTypedInput !== bulkDeleteTypedConfirmation) return;

    setBulkDeleting(true);
    setBulkAction("delete");
    setToast(null);

    try {
      const payload = getBulkSelectionPayload();
      const response = await fetch("/api/prospects/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          confirmBulkDelete: selectedCount > bulkDeleteHardConfirmationThreshold,
          typedConfirmation: bulkDeleteTypedInput
        })
      });
      const body = (await response.json().catch(() => null)) as { deleted?: number; failed?: number; error?: string } | null;
      if (!response.ok) {
        throw new Error(normalizeBulkApiError(body, "Ausgewählte Einträge konnten nicht gelöscht werden."));
      }
      setToast({ type: "success", message: `${body?.deleted ?? 0} Leads gelöscht` });
      setVisibleProspects((current) => allFilteredSelected ? [] : current.filter((prospect) => !selectedIds.includes(prospect.id)));
      setSelectedIds([]);
      setSelectedMode("page");
      setConfirmBulkDelete(false);
      setBulkDeleteTypedInput("");
      router.refresh();
    } catch (error) {
      setToast({ type: "error", message: normalizeBulkApiError(error, "Ausgewählte Einträge konnten nicht gelöscht werden.") });
    } finally {
      setBulkDeleting(false);
      setBulkAction(null);
    }
  }

  function handleDrawerSaved(updated: ProspectCrmPanelData) {
    setDrawerProspect(updated);
    setVisibleProspects((current) => current.map((prospect) => prospect.id === updated.id ? {
      ...prospect,
      companyName: updated.companyName,
      city: updated.city,
      country: updated.country,
      status: updated.status,
      leadStatus: updated.leadStatus,
      icpCategory: updated.icpScore >= 70 ? "high" : updated.icpScore >= 40 ? "medium" : prospect.icpCategory,
      icpFitScore: updated.icpFitScore,
      icpFitLabel: updated.icpFitLabel,
      industry: updated.industry,
      painType: updated.painType
    } : prospect));
    setToast({ type: "success", message: "Lead gespeichert" });
  }

  async function updateProspectStatus(prospectId: string, status: ProspectStatus) {
    setToast(null);
    try {
      const response = await fetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const body = (await response.json().catch(() => null)) as { error?: string; status?: string } | null;
      if (!response.ok || body?.error) {
        throw new Error(body?.error ?? "Status konnte nicht gespeichert werden.");
      }
      setVisibleProspects((current) => current.map((prospect) => prospect.id === prospectId ? { ...prospect, status: body?.status ?? status } : prospect));
      if (drawerProspect?.id === prospectId) {
        setDrawerProspect((current) => current ? { ...current, status: body?.status ?? status } : current);
      }
      setToast({ type: "success", message: "Status gespeichert" });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Status konnte nicht gespeichert werden." });
    }
  }

  async function updateAiCall(prospectId: string, action: "plan" | "do_not_call") {
    setCallActionId(prospectId);
    setToast(null);
    try {
      const response = await fetch(`/api/prospects/${prospectId}/ai-call`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, voice: "neutral" })
      });
      const body = (await response.json().catch(() => null)) as { error?: string; status?: string; plannedFor?: string | null } | null;
      if (!response.ok || body?.error) {
        throw new Error(body?.error ?? "KI-Anruf konnte nicht aktualisiert werden.");
      }
      setVisibleProspects((current) => current.map((prospect) => prospect.id === prospectId ? {
        ...prospect,
        aiCallStatus: body?.status ?? (action === "plan" ? "call_planned" : "call_not_interested"),
        aiCallRecommended: action === "plan",
        aiCallPlannedFor: body?.plannedFor ?? prospect.aiCallPlannedFor,
        leadStatus: action === "do_not_call" ? "not_interested" : prospect.leadStatus
      } : prospect));
      setToast({ type: "success", message: action === "plan" ? "KI-Anruf vorbereitet. Live-Start erfolgt nur nach manueller Freigabe." : "Lead wird nicht angerufen." });
      router.refresh();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "KI-Anruf konnte nicht aktualisiert werden." });
    } finally {
      setCallActionId(null);
    }
  }

  async function handleAddSelectedToCampaign() {
    if (!bulkCampaignId || selectedCount === 0) {
      return;
    }

    setBulkAdding(true);
    setBulkAction("campaign");
    setToast(null);

    try {
      const payload = getBulkSelectionPayload();
      const response = await fetch(`/api/campaigns/${bulkCampaignId}/prospects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json().catch(() => null)) as { added?: number; skipped?: number; failed?: number; error?: string } | null;
      if (!response.ok) {
        throw new Error(normalizeBulkApiError(body, "Leads konnten nicht hinzugefügt werden."));
      }
      setToast({ type: "success", message: `${body?.added ?? 0} hinzugefügt, ${body?.skipped ?? 0} übersprungen` });
      setSelectedIds([]);
      setSelectedMode("page");
      setBulkCampaignId("");
      setAddToCampaignOpen(false);
      await refreshCurrentPage({ preserveSelection: false }).catch(() => router.refresh());
    } catch (error) {
      setToast({
        type: "error",
        message: normalizeBulkApiError(error, "Leads konnten nicht hinzugefügt werden.")
      });
    } finally {
      setBulkAdding(false);
      setBulkAction(null);
    }
  }

  function handleCreateCampaignSuccess() {
    setSelectedIds([]);
    setSelectedMode("page");
  }

  async function openLeadListModal() {
    if (selectedCount === 0) return;
    setToast(null);
    setLeadListProspectIds(selectedMode === "page" ? selectedIds : []);
    setLeadListModalOpen(true);
  }

  async function runBulkAction(endpoint: string, success: (body: Record<string, number>) => string, options: { type: "research" | "landingpages"; maxIds?: number }) {
    if (selectedCount === 0) return;
    if (options.type === "research" && exceedsBulkResearchLimit(selectedCount) && !options.maxIds) return;
    if (options.type === "landingpages" && selectedCount > maxBulkResearchCount && typeof window !== "undefined") {
      const confirmed = window.confirm(`${selectedCount.toLocaleString("de-DE")} Landingpages generieren?`);
      if (!confirmed) return;
    }
    setToast(null);
    setBulkAction(options.type);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getBulkSelectionPayload(options.maxIds ? selectedIds.slice(0, options.maxIds) : selectedIds))
      });
      const body = (await response.json().catch(() => null)) as Record<string, number> & { error?: string } | null;
      if (!response.ok || !body) throw new Error(normalizeBulkApiError(body, "Bulk-Aktion fehlgeschlagen."));
      setToast({ type: "success", message: success(body) });
      setSelectedIds([]);
      setSelectedMode("page");
      await refreshCurrentPage({ preserveSelection: false }).catch(() => router.refresh());
    } catch (error) {
      setToast({ type: "error", message: normalizeBulkApiError(error, "Bulk-Aktion fehlgeschlagen.") });
    } finally {
      setBulkAction(null);
    }
  }

  function handleBulkResearchClick() {
    if (exceedsBulkResearchLimit(selectedCount)) {
      setResearchLimitOpen(true);
      return;
    }
    void runBulkResearch();
  }

  async function runBulkResearch(maxIds?: number) {
    if (selectedCount === 0) return;
    setBulkAction("research");
    setToast(null);
    setResearchCompletedCount(0);

    try {
      if (selectedMode === "allFiltered") {
        setResearchTotalCount(Math.min(selectedCount, maxIds ?? maxBulkResearchCount));
        setResearchProgress({});
        const response = await fetch("/api/prospects/bulk-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...getBulkSelectionPayload(), force: forceResearch })
        });
        const body = (await response.json().catch(() => null)) as { total?: number; processed?: number; completed?: number; skipped?: number; failed?: number; errors?: Array<{ id: string; message: string }>; error?: string } | null;
        if (!response.ok || !body) throw new Error(normalizeBulkApiError(body, "Bulk-Anreicherung fehlgeschlagen."));
        setResearchCompletedCount((body.completed ?? 0) + (body.failed ?? 0));
        await refreshCurrentPage({ preserveSelection: false }).catch(() => router.refresh());
        setSelectedIds([]);
        setSelectedMode("page");
        setToast({
          type: (body.failed ?? 0) > 0 ? "error" : "success",
          message: `${body.completed ?? 0} angereichert, ${body.skipped ?? 0} übersprungen, ${body.failed ?? 0} fehlgeschlagen${body.errors?.[0]?.message ? ` · ${body.errors[0].message}` : ""}`
        });
        return;
      }

      const ids = typeof maxIds === "number" ? selectedIds.slice(0, maxIds) : selectedIds;
      const selectedById = new Map(visibleProspects.map((prospect) => [prospect.id, prospect]));
      const eligibleIds = ids.filter((id) => {
        const prospect = selectedById.get(id);
        return forceResearch || !prospect || !(prospect.researchStatus === "completed" && prospect.researchedAt);
      });
      const skippedIds = ids.filter((id) => !eligibleIds.includes(id));
      setResearchTotalCount(eligibleIds.length);
      setResearchProgress(Object.fromEntries([
        ...eligibleIds.map((id) => [id, { status: "waiting" as const }]),
        ...skippedIds.map((id) => [id, { status: "skipped" as const, message: "Bereits angereichert" }])
      ]));

      let completed = 0;
      let skipped = skippedIds.length;
      let failed = 0;
      const errors: Array<{ id: string; message: string }> = [];

      for (const id of eligibleIds) {
        setResearchProgress((current) => ({ ...current, [id]: { status: "running" } }));
        setVisibleProspects((current) => current.map((prospect) => prospect.id === id ? { ...prospect, researchStatus: "running" } : prospect));
        const response = await fetch("/api/prospects/bulk-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [id], force: forceResearch })
        });
        const body = (await response.json().catch(() => null)) as { total?: number; processed?: number; completed?: number; skipped?: number; failed?: number; errors?: Array<{ id: string; message: string }>; error?: string } | null;
        if (!response.ok || !body) {
          const message = normalizeBulkApiError(body, "Lead konnte nicht angereichert werden.");
          failed += 1;
          errors.push({ id, message });
          setResearchProgress((current) => ({ ...current, [id]: { status: "failed", message } }));
          setVisibleProspects((current) => current.map((prospect) => prospect.id === id ? { ...prospect, researchStatus: "failed", enrichmentNotes: message } : prospect));
        } else if ((body.failed ?? 0) > 0) {
          const message = body.errors?.[0]?.message ?? "Anreicherung fehlgeschlagen";
          failed += body.failed ?? 1;
          errors.push({ id, message });
          setResearchProgress((current) => ({ ...current, [id]: { status: "failed", message } }));
          setVisibleProspects((current) => current.map((prospect) => prospect.id === id ? { ...prospect, researchStatus: "failed", enrichmentNotes: message } : prospect));
        } else if ((body.skipped ?? 0) > 0 && (body.completed ?? 0) === 0) {
          skipped += body.skipped ?? 1;
          setResearchProgress((current) => ({ ...current, [id]: { status: "skipped", message: "Übersprungen" } }));
        } else {
          completed += body.completed ?? 1;
          setResearchProgress((current) => ({ ...current, [id]: { status: "completed" } }));
          setVisibleProspects((current) => current.map((prospect) => prospect.id === id ? { ...prospect, researchStatus: "completed", researchedAt: new Date().toISOString(), enrichmentNotes: null } : prospect));
        }
        setResearchCompletedCount(completed + failed);
      }

      await refreshCurrentPage({ preserveSelection: true }).catch(() => router.refresh());
      setToast({
        type: failed > 0 ? "error" : "success",
        message: `${completed} angereichert, ${skipped} übersprungen, ${failed} fehlgeschlagen${errors[0]?.message ? ` · ${errors[0].message}` : ""}`
      });
    } catch (error) {
      setToast({ type: "error", message: normalizeBulkApiError(error, "Bulk-Anreicherung fehlgeschlagen.") });
    } finally {
      setBulkAction(null);
    }
  }

  async function runSingleResearch(prospectId: string) {
    const prospect = visibleProspects.find((item) => item.id === prospectId);
    setToast(null);
    setResearchProgress((current) => ({ ...current, [prospectId]: { status: "running" } }));
    setVisibleProspects((current) => current.map((item) => item.id === prospectId ? { ...item, researchStatus: "running", lastResearchAt: new Date().toISOString() } : item));
    try {
      const response = await fetch("/api/prospects/bulk-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [prospectId], force: true })
      });
      const body = (await response.json().catch(() => null)) as { completed?: number; failed?: number; errors?: Array<{ id: string; message: string }>; error?: string } | null;
      if (!response.ok || !body || body.error || (body.failed ?? 0) > 0) {
        const message = body?.error ?? body?.errors?.[0]?.message ?? "Research fehlgeschlagen";
        setResearchProgress((current) => ({ ...current, [prospectId]: { status: "failed", message } }));
        setVisibleProspects((current) => current.map((item) => item.id === prospectId ? {
          ...item,
          researchStatus: "failed",
          lastResearchError: message,
          lastResearchErrorCode: null,
          failedStep: null,
          sourceUrl: item.sourceUrl ?? null,
          lastAttemptAt: new Date().toISOString(),
          lastResearchAt: new Date().toISOString(),
          enrichmentNotes: message
        } : item));
        setToast({ type: "error", message });
        return;
      }
      setResearchProgress((current) => ({ ...current, [prospectId]: { status: "completed" } }));
      await refreshCurrentPage({ preserveSelection: true }).catch(() => {
        setVisibleProspects((current) => current.map((item) => item.id === prospectId ? {
          ...item,
          researchStatus: "completed",
          researchedAt: new Date().toISOString(),
          lastResearchAt: new Date().toISOString(),
          lastSuccessfulResearchAt: new Date().toISOString(),
          lastResearchError: null,
          lastResearchErrorCode: null,
          failedStep: null,
          sourceUrl: item.sourceUrl ?? null,
          lastAttemptAt: new Date().toISOString(),
          enrichmentNotes: null
        } : item));
      });
      setToast({ type: "success", message: `${prospect?.companyName ?? "Lead"} analysiert` });
    } catch (error) {
      const message = normalizeBulkApiError(error, "Research fehlgeschlagen.");
      setResearchProgress((current) => ({ ...current, [prospectId]: { status: "failed", message } }));
      setVisibleProspects((current) => current.map((item) => item.id === prospectId ? {
        ...item,
        researchStatus: "failed",
        lastResearchError: message,
        lastResearchErrorCode: "RESEARCH_FAILED",
        failedStep: "analysis",
        sourceUrl: item.sourceUrl ?? null,
        lastAttemptAt: new Date().toISOString(),
        lastResearchAt: new Date().toISOString(),
        enrichmentNotes: message
      } : item));
      setToast({ type: "error", message });
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden rounded-2xl bg-white p-4 shadow-panel sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-full">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Pipeline</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Prospects</h2>
          <p className="mt-1 text-sm text-slate-500">
            {currentPagination.total.toLocaleString("de-DE")} Einträge · Seite {currentPagination.page} von {currentPagination.totalPages} · {currentPagination.limit} pro Seite
          </p>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <form action="/admin/prospects" className="relative w-full min-w-0 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="hidden" name="status" value={activeStatus === "all" ? "" : activeStatus} />
            <input type="hidden" name="score" value={scoreFilter === "all" ? "" : scoreFilter} />
            <input type="hidden" name="leadListId" value={leadListId} />
            <input type="hidden" name="followUp" value={followUpFilter === "all" ? "" : followUpFilter} />
            <input type="hidden" name="dashboardFilter" value={dashboardFilter} />
            <input type="hidden" name="limit" value={currentPagination.limit} />
            <label className="sr-only" htmlFor="prospect-search">Prospects suchen</label>
            <input
              id="prospect-search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Firma, Stadt, Branche suchen"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </form>
          <div className="admin-tab-scroll pb-1 lg:justify-end lg:pb-0">
            {statusLinks.map((status) => (
              <Link
                key={status}
                href={getProspectListHref({ activeStatus: status as ProspectStatus | "all", scoreFilter, searchQuery, leadListId, followUpFilter, dashboardFilter, limit: currentPagination.limit })}
                className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition ${
                  activeStatus === status
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {statusLabels[status]}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="admin-tab-scroll pb-1 sm:pb-0">
            {scoreLinks.map((entry) => (
              <Link
                key={entry.key}
                href={getProspectListHref({ activeStatus, scoreFilter: entry.key, searchQuery, leadListId, followUpFilter, dashboardFilter, limit: currentPagination.limit })}
                className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition ${
                  scoreFilter === entry.key
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>
          <div className="admin-tab-scroll pb-1 sm:pb-0">
            {[
              { key: "all", label: "Alle Follow-ups" },
              { key: "due", label: "Wiedervorlage fällig" },
              { key: "contacted_no_reply", label: "Kontaktiert, aber keine Antwort" }
            ].map((entry) => (
              <Link
                key={entry.key}
                href={getProspectListHref({ activeStatus, scoreFilter, searchQuery, leadListId, followUpFilter: entry.key as typeof followUpFilter, dashboardFilter, limit: currentPagination.limit })}
                className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition ${
                  followUpFilter === entry.key
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>
          <select
            value={leadListId}
            onChange={(event) => {
              const params = new URLSearchParams();
              if (activeStatus !== "all") params.set("status", activeStatus);
              if (scoreFilter !== "all") params.set("score", scoreFilter);
              if (searchQuery.trim()) params.set("q", searchQuery.trim());
              if (event.target.value) params.set("leadListId", event.target.value);
              if (followUpFilter !== "all") params.set("followUp", followUpFilter);
              if (dashboardFilter) params.set("dashboardFilter", dashboardFilter);
              if (currentPagination.limit !== defaultProspectsPageSize) params.set("limit", String(currentPagination.limit));
              router.push(params.toString() ? `/admin/prospects?${params.toString()}` : "/admin/prospects");
            }}
            className="h-9 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
          >
            <option value="">Alle Leadlisten</option>
            {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.count ?? 0})</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Leads pro Seite</span>
            <select
              value={currentPagination.limit}
              onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
            >
              {prospectsPageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      <label className="flex max-w-full flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0"
          checked={allVisibleSelected}
          onChange={(event) => {
            setSelectedMode("page");
            setSelectedIds((current) => toggleVisibleSelection(current, visibleIds, event.target.checked));
          }}
        />
        <span className="min-w-0 break-words">Alle sichtbaren auswählen</span>
      </label>

      <BulkActionBar
        selectedCount={selectedCount}
        selectionLabel={selectedLabel}
        selectedMode={selectedMode}
        canSelectAllFiltered={canSelectAllFiltered}
        totalFiltered={currentPagination.total}
        bulkDeleting={bulkDeleting}
        activeAction={bulkAction}
        forceResearch={forceResearch}
        onForceResearchChange={setForceResearch}
        researchProgress={researchProgress}
        researchCompletedCount={researchCompletedCount}
        researchTotalCount={researchTotalCount}
        onSelectAllFiltered={() => {
          setSelectedMode("allFiltered");
          setSelectedIds(visibleIds);
        }}
        researchLimited={exceedsBulkResearchLimit(selectedCount)}
        onResearch={handleBulkResearchClick}
        onGenerateLandingpages={() => void runBulkAction("/api/prospects/bulk-generate-landingpages", (body) => `${body.generated ?? 0} Landingpages generiert, ${body.skipped ?? 0} übersprungen, ${body.failed ?? 0} fehlgeschlagen`, { type: "landingpages" })}
        onAddToCampaign={() => setAddToCampaignOpen(true)}
        onAssignLeadList={() => void openLeadListModal()}
        onDelete={() => {
          setBulkDeleteTypedInput("");
          setConfirmBulkDelete(true);
        }}
      />

      {toast ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="space-y-3 md:hidden">
        {loadingPage ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Lädt Seite {loadingPage}...
          </div>
        ) : null}
        {visibleProspects.map((prospect) => {
          const isActive = selectedProspectId === prospect.id || drawerProspect?.id === prospect.id;
          const signals = scoreBadgeSignals(prospect.painSignals);

          return (
            <article
              key={prospect.id}
              role="button"
              tabIndex={0}
              onClick={() => openProspectDrawer(prospect.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openProspectDrawer(prospect.id);
              }}
              className={`w-full min-w-0 rounded-2xl border bg-white p-4 shadow-sm ${isActive ? "border-blue-200 ring-2 ring-blue-100" : "border-slate-200"}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="pt-1" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    aria-label={`${prospect.companyName} auswählen`}
                    checked={allFilteredSelected || selectedIds.includes(prospect.id)}
                    onChange={(event) => {
                      setSelectedMode("page");
                      setSelectedIds((current) => {
                        const base = allFilteredSelected ? visibleIds : current;
                        return event.target.checked
                          ? [...new Set([...base, prospect.id])]
                          : base.filter((id) => id !== prospect.id);
                      });
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                  {prospect.companyName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-snug text-ink">{prospect.companyName}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {[prospect.city, prospect.country].filter(Boolean).join(", ") || "Kein Ort hinterlegt"}
                  </p>
                  <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                    <ProspectWebsiteLink websiteUrl={prospect.websiteUrl} compact={false} />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge status={prospect.status} />
                {prospect.targetGroup?.name ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{prospect.targetGroup.name}</span> : null}
                {prospect.industry ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{prospect.industry}</span> : null}
                {signals.slice(0, 2).map((signal, index) => (
                  <span key={`${signal?.type ?? "signal"}-${index}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {signal?.label ?? signal?.type}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ResearchStatusBadge
                  prospect={prospect}
                  progress={researchProgress[prospect.id]}
                  onRetry={() => void runSingleResearch(prospect.id)}
                  onDetails={() => setResearchDetailsProspect(prospect)}
                />
                <LandingpageStatusBadge prospect={prospect} />
                {prospect.printMailingRecommended ? <PrintMailingRecommendation onClick={() => setPrintMailingProspect(prospect)} /> : null}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="block" onClick={(event) => event.stopPropagation()}>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Status</span>
                  <select
                    value={prospect.status}
                    onChange={(event) => updateProspectStatus(prospect.id, event.target.value as ProspectStatus)}
                    aria-label="Prospect Status ändern"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                  >
                    {statusLinks.filter((status) => status !== "all").map((status) => (
                      <option key={status} value={status}>{statusLabels[status]}</option>
                    ))}
                  </select>
                </label>

                <ScoreSummary
                  score={prospect.totalScore}
                  icpLabel={prospect.icpFitLabel}
                  icpScore={prospect.icpFitScore}
                  engagementLevel={prospect.engagementLevel}
                  engagementScore={prospect.engagementScore ?? 0}
                />

                <div className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Aktivität</span>
                  <span className="font-medium text-slate-700">{formatRelativeActivity(prospect.updatedAt)}</span>
                </div>

                <div className="min-w-0" onClick={(event) => event.stopPropagation()}>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Landingpage</span>
                  <p className="break-words text-xs font-medium text-slate-600">{prospect.slug ? `/p/${prospect.slug}` : "Nicht erstellt"}</p>
                  <div className="mt-2">
                    <LandingpageActions slug={prospect.slug} landingpageUrl={prospect.landingpageUrl} />
                  </div>
                </div>

                <AiCallRecommendation
                  prospect={prospect}
                  busy={callActionId === prospect.id}
                  onPlan={() => void updateAiCall(prospect.id, "plan")}
                  onDoNotCall={() => void updateAiCall(prospect.id, "do_not_call")}
                />
              </div>

              <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50" onClick={(event) => event.stopPropagation()}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold text-slate-700">
                  Aktionen
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </summary>
                <div className="grid gap-2 border-t border-slate-200 p-3">
                  <button
                    type="button"
                    onClick={() => openProspectDrawer(prospect.id)}
                    disabled={loadingProspectId === prospect.id}
                    className="btn-secondary inline-flex min-h-10 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    Öffnen
                  </button>
                  <Link
                    href={`/admin/prospects/${prospect.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  >
                    Bearbeiten
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmProspect(prospect)}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:border-red-200 hover:bg-red-50"
                  >
                    Löschen
                  </button>
                </div>
              </details>
            </article>
          );
        })}
        {!loadingPage && visibleProspects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Keine Prospects für diesen Filter.
          </div>
        ) : null}
      </div>

      <div className="hidden w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        {loadingPage ? (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Lädt Seite {loadingPage}...
          </div>
        ) : null}
        {visibleProspects.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Keine Prospects für diesen Filter.
          </div>
        ) : (
          <div className="min-w-[1180px] divide-y divide-slate-100">
            <div className="grid min-h-11 grid-cols-[40px_minmax(220px,1.45fr)_132px_minmax(140px,0.8fr)_170px_minmax(170px,1fr)_150px_132px] items-center gap-3 bg-slate-50 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              <span></span>
              <span>Lead / Firma</span>
              <span>Status</span>
              <span>Zielgruppe</span>
              <span>Scores</span>
              <span>Research / Landingpage <span className="sr-only">Letzte Aktivität</span></span>
              <span>Landingpage</span>
              <span className="text-right">Aktionen</span>
            </div>
            {visibleProspects.map((prospect) => {
              const isActive = selectedProspectId === prospect.id || drawerProspect?.id === prospect.id;
              const signals = scoreBadgeSignals(prospect.painSignals);

              return (
                <div
                  key={prospect.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProspectDrawer(prospect.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openProspectDrawer(prospect.id);
                  }}
                  className={`grid min-h-[76px] min-w-0 cursor-pointer grid-cols-[40px_minmax(220px,1.45fr)_132px_minmax(140px,0.8fr)_170px_minmax(170px,1fr)_150px_132px] items-center gap-4 px-4 py-4 transition ${
                    isActive
                      ? "bg-blue-50/70"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0"
                        aria-label={`${prospect.companyName} auswählen`}
                      checked={allFilteredSelected || selectedIds.includes(prospect.id)}
                      onChange={(event) => {
                        setSelectedMode("page");
                        setSelectedIds((current) => {
                          const base = allFilteredSelected ? visibleIds : current;
                          return event.target.checked
                            ? [...new Set([...base, prospect.id])]
                            : base.filter((id) => id !== prospect.id);
                        });
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                        {prospect.companyName.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-ink">{prospect.companyName}</p>
                        <p className="mt-1 break-words text-sm text-slate-500">
                          {[prospect.city, prospect.country].filter(Boolean).join(", ")}
                        </p>
                        <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                          <ProspectWebsiteLink websiteUrl={prospect.websiteUrl} compact />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {prospect.industry ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{prospect.industry}</span> : null}
                          {signals.length > 0 ? (
                            <>
                            {signals.map((signal, index) => (
                              <span key={`${signal?.type ?? "signal"}-${index}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                {signal?.label ?? signal?.type}
                              </span>
                            ))}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <StatusBadge status={prospect.status} />
                    <div onClick={(event) => event.stopPropagation()}>
                      <select
                        value={prospect.status}
                        onChange={(event) => updateProspectStatus(prospect.id, event.target.value as ProspectStatus)}
                        aria-label="Prospect Status ändern"
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        {statusLinks.filter((status) => status !== "all").map((status) => (
                          <option key={status} value={status}>{statusLabels[status]}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{prospect.targetGroup?.name ?? "Keine Zielgruppe"}</p>
                    {prospect.painType ? <p className="mt-1 truncate text-xs text-slate-500">{prospect.painType}</p> : null}
                  </div>

                  <ScoreSummary
                    score={prospect.totalScore}
                    icpLabel={prospect.icpFitLabel}
                    icpScore={prospect.icpFitScore}
                    engagementLevel={prospect.engagementLevel}
                    engagementScore={prospect.engagementScore ?? 0}
                  />

                  <div className="min-w-0 space-y-2 text-sm">
                    <ResearchStatusBadge
                      prospect={prospect}
                      progress={researchProgress[prospect.id]}
                      onRetry={() => void runSingleResearch(prospect.id)}
                      onDetails={() => setResearchDetailsProspect(prospect)}
                    />
                    <LandingpageStatusBadge prospect={prospect} />
                    {prospect.printMailingRecommended ? <PrintMailingRecommendation onClick={() => setPrintMailingProspect(prospect)} /> : null}
                  </div>

                  <div className="min-w-0">
                    {prospect.slug ? (
                      <span className="block break-words text-xs font-medium text-slate-600">
                        /p/{prospect.slug}
                      </span>
                    ) : (
                      <span className="block truncate text-xs font-medium text-slate-400">
                        Nicht erstellt
                      </span>
                    )}
                    <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                      <LandingpageActions slug={prospect.slug} landingpageUrl={prospect.landingpageUrl} />
                    </div>
                  </div>

                  <AiCallRecommendation
                    prospect={prospect}
                    compact
                    busy={callActionId === prospect.id}
                    onPlan={() => void updateAiCall(prospect.id, "plan")}
                    onDoNotCall={() => void updateAiCall(prospect.id, "do_not_call")}
                  />

                  <div className="flex w-full max-w-[132px] items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openProspectDrawer(prospect.id)}
                      disabled={loadingProspectId === prospect.id}
                      aria-label="Prospect öffnen"
                      title="Prospect öffnen"
                      className="btn-secondary inline-grid h-10 w-10 place-items-center rounded-xl"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <Link
                      href={`/admin/prospects/${prospect.id}`}
                      aria-label="Prospect bearbeiten"
                      title="Prospect bearbeiten"
                      className="inline-grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmProspect(prospect)}
                      aria-label="Löschen"
                      title="Löschen"
                      className="inline-grid h-10 w-10 place-items-center rounded-xl border border-red-100 bg-white text-red-600 hover:border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
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

      {confirmProspect ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-prospect-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="delete-prospect-title" className="text-lg font-semibold text-ink">
              Prospect löschen?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Dieser Prospect wird dauerhaft gelöscht. Zugehörige Landingpage, Kampagnenzuordnungen und Logs können davon betroffen sein.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmProspect(null)}
                disabled={deletingId === confirmProspect.id}
                className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingId === confirmProspect.id}
                className="btn-danger rounded-xl px-4 py-2 text-sm font-semibold"
              >
                {deletingId === confirmProspect.id ? "Löscht..." : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmBulkDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="bulk-delete-prospect-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="bulk-delete-prospect-title" className="text-lg font-semibold text-ink">
              Leads löschen?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {selectedCount.toLocaleString("de-DE")} ausgewählte Leads werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            {requiresBulkDeleteTypedConfirmation(selectedCount) ? (
              <label className="mt-4 block space-y-2 text-sm font-medium text-slate-700">
                <span>Zur Bestätigung bitte {bulkDeleteTypedConfirmation} eingeben.</span>
                <input
                  value={bulkDeleteTypedInput}
                  onChange={(event) => setBulkDeleteTypedInput(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  autoFocus
                />
              </label>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => {
                setConfirmBulkDelete(false);
                setBulkDeleteTypedInput("");
              }} disabled={bulkDeleting} className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting || (requiresBulkDeleteTypedConfirmation(selectedCount) && bulkDeleteTypedInput !== bulkDeleteTypedConfirmation)}
                className="btn-danger rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
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
            void runBulkResearch(maxBulkResearchCount);
          }}
        />
      ) : null}

      {addToCampaignOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="add-to-campaign-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="add-to-campaign-title" className="text-lg font-semibold text-ink">
              Zur Kampagne hinzufügen
            </h3>
            <div className="mt-4 space-y-3">
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
              <button type="button" onClick={() => setAddToCampaignOpen(false)} disabled={bulkAdding} className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleAddSelectedToCampaign}
                disabled={!bulkCampaignId || bulkAdding}
                className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
          setToast({ type: "success", message });
          setSelectedIds([]);
          setSelectedMode("page");
          setLeadListProspectIds([]);
          setLeadListModalOpen(false);
          void refreshCurrentPage({ preserveSelection: false }).catch(() => router.refresh());
        }}
        onError={(message) => setToast({ type: "error", message })}
      />

      {researchDetailsProspect ? (
        <ResearchDetailsModal
          prospect={researchDetailsProspect}
          onRetry={() => void runSingleResearch(researchDetailsProspect.id)}
          onClose={() => setResearchDetailsProspect(null)}
        />
      ) : null}

      {printMailingProspect ? (
        <PrintMailingDetailsModal
          prospect={printMailingProspect}
          onClose={() => setPrintMailingProspect(null)}
        />
      ) : null}

      {drawerProspect ? (
        <div className="fixed inset-0 z-[120] bg-slate-950/30">
          <div className="lead-detail-panel lead-detail-drawer-shell ml-auto bg-slate-50 shadow-2xl">
            <div className="lead-detail-content">
              <ProspectCrmPanel
                prospect={drawerProspect}
                previousProspectId={previousProspectId}
                nextProspectId={nextProspectId}
                mode="drawer"
                onClose={closeDrawer}
                onNavigate={openProspectDrawer}
                onSaved={handleDrawerSaved}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ScoreSummary({
  score,
  icpLabel,
  icpScore,
  engagementLevel,
  engagementScore
}: {
  score: number;
  icpLabel: string;
  icpScore: number;
  engagementLevel: string;
  engagementScore: number;
}) {
  return (
    <div className="w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 xl:w-[170px]">
      <p className="text-xs font-semibold text-slate-500">Score <span className="text-sm text-ink">{score}</span></p>
      <div className="mt-1.5 space-y-1 text-xs">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_64px_32px] items-center gap-1.5 text-slate-600">
          <span className="truncate text-slate-500">ICP</span>
          <LevelBadge level={formatIcpLabel(icpLabel)} />
          <span className="truncate text-right font-semibold text-slate-700">{icpScore}</span>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_64px_32px] items-center gap-1.5 text-slate-600">
          <span className="truncate text-slate-500">Engagement</span>
          <LevelBadge level={formatEngagementLabel(engagementLevel)} />
          <span className="truncate text-right font-semibold text-slate-700">{engagementScore}</span>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "responded"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : status === "landingpage_ready" || status === "qualified"
      ? "bg-blue-50 text-blue-700 ring-blue-100"
      : status === "disqualified"
        ? "bg-slate-100 text-slate-500 ring-slate-200"
        : "bg-slate-50 text-slate-600 ring-slate-200";

  return (
    <span className={`inline-flex h-7 max-w-full items-center rounded-full px-2.5 text-xs font-semibold ring-1 ${tone}`}>
      <span className="truncate">{statusLabels[status] ?? status}</span>
    </span>
  );
}

function ResearchStatusBadge({
  prospect,
  progress,
  onRetry,
  onDetails
}: {
  prospect: ProspectListItem;
  progress?: { status: "waiting" | "running" | "completed" | "skipped" | "failed"; message?: string };
  onRetry?: () => void;
  onDetails?: () => void;
}) {
  const status = progress?.status === "waiting"
    ? "waiting"
    : progress?.status === "running"
      ? "running"
      : progress?.status === "failed"
        ? isResearchFailureStatus(prospect.researchStatus ?? "") ? prospect.researchStatus ?? "failed" : "failed"
        : progress?.status === "completed"
          ? "completed"
          : prospect.researchStatus ?? "not_started";
  const label = researchStatusLabel(status);
  const date = (status === "completed" || status === "partial") && prospect.researchedAt ? ` · ${formatRelativeActivity(prospect.researchedAt)}` : "";
  const errorMessage = progress?.message ?? prospect.lastResearchError ?? prospect.enrichmentNotes ?? undefined;
  const lastAttempt = prospect.lastAttemptAt ?? prospect.lastResearchAt ?? prospect.researchedAt ?? null;
  const failed = isResearchFailureStatus(status);
  const verificationBadges = websiteVerificationBadges(prospect);
  if (failed) {
    return (
      <div className={`max-w-full rounded-xl px-2.5 py-2 text-xs ring-1 ${researchStatusTone(status)}`}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 font-semibold">Research: {label}</span>
          {prospect.lastResearchErrorCode ? <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 font-semibold">{prospect.lastResearchErrorCode}</span> : null}
        </div>
        <p className="mt-1 break-words">{errorMessage || "Kein Fehlergrund gespeichert."}</p>
        <p className="mt-1 text-[11px] opacity-80">Letzter Versuch: {lastAttempt ? formatRelativeActivity(lastAttempt) : "Unbekannt"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-8 items-center rounded-lg bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          >
            Erneut analysieren
          </button>
          <button
            type="button"
            onClick={onDetails}
            className="inline-flex min-h-8 items-center rounded-lg bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          >
            Details
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex max-w-full flex-wrap gap-1.5">
      <span title={errorMessage} className={`inline-flex min-h-7 max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${researchStatusTone(status)}`}>
        <span className="truncate">Research: {label}{date}</span>
      </span>
      {verificationBadges.map((badge) => (
        <span key={badge} className="inline-flex min-h-7 items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          {badge}
        </span>
      ))}
    </div>
  );
}

function websiteVerificationBadges(prospect: ProspectListItem) {
  const badges: string[] = [];
  if (prospect.websiteVerified) badges.push("Website geprüft");
  if (prospect.websiteCandidate && prospect.websiteCandidate !== prospect.websiteUrl) badges.push(prospect.websiteConfidence && prospect.websiteConfidence >= 85 ? "Website abweichend" : "Neue Website vorgeschlagen");
  if ((prospect.companyEmail || prospect.decisionMakerEmail) && prospect.emailVerified === false) badges.push("E-Mail unbestätigt");
  if (prospect.emailCandidate && prospect.emailCandidate !== prospect.companyEmail) badges.push("E-Mail aus Impressum gefunden");
  return badges.slice(0, 3);
}

function LandingpageStatusBadge({ prospect }: { prospect: ProspectListItem }) {
  const failed = prospect.landingpageReviewStatus === "failed";
  const created = Boolean(prospect.slug || prospect.landingpageUrl);
  const tone = failed
    ? "bg-red-50 text-red-700 ring-red-100"
    : created
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : "bg-slate-50 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex min-h-7 max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>
      <span className="truncate">Landingpage: {failed ? "Fehler" : created ? "Erstellt" : "Nicht erstellt"}</span>
    </span>
  );
}

function AiCallRecommendation({
  prospect,
  compact = false,
  busy,
  onPlan,
  onDoNotCall
}: {
  prospect: ProspectListItem;
  compact?: boolean;
  busy?: boolean;
  onPlan: () => void;
  onDoNotCall: () => void;
}) {
  const recommended = prospect.aiCallRecommended || prospect.aiCallStatus === "call_eligible" || prospect.aiCallStatus === "call_planned";
  const planned = prospect.aiCallStatus === "call_planned";
  const blocked = prospect.aiCallBlockers?.[0];
  const tone = planned
    ? "border-sky-200 bg-sky-50 text-sky-800"
    : recommended
      ? prospect.aiCallPriority === "high" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-500";
  const label = planned ? "KI-Anruf vorbereitet" : recommended ? "KI-Anruf empfohlen" : "KI-Anruf nicht empfohlen";
  const plannedText = prospect.aiCallPlannedFor ? formatDateTime(prospect.aiCallPlannedFor) : null;

  return (
    <div className={`rounded-xl border p-3 text-xs ${tone}`} onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start gap-2">
        <PhoneCall className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
          <p className="mt-1 text-[11px] leading-snug opacity-80">
            {plannedText ? `Vorbereitet: ${plannedText}` : blocked ?? "Freigabe erforderlich. Kein automatischer Start."}
          </p>
        </div>
      </div>
      {!compact || recommended ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPlan}
            disabled={busy || !recommended}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-slate-800 shadow-sm ring-1 ring-inset ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{planned ? "Anruf freigeben" : "KI-Anruf vorbereiten"}</span>
          </button>
          <button
            type="button"
            onClick={() => window.open("/admin/settings/voice-ai", "_blank", "noopener,noreferrer")}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200"
          >
            <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Testskript ansehen</span>
          </button>
          <button
            type="button"
            onClick={onDoNotCall}
            disabled={busy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PhoneOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Nicht anrufen</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PrintMailingRecommendation({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-100 transition hover:bg-violet-100 hover:text-violet-950"
      aria-label="Printversand Empfehlung öffnen"
      title="Printversand Empfehlung öffnen"
    >
      <FilePlus2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">Printversand empfohlen</span>
    </button>
  );
}

function PrintMailingDetailsModal({ prospect, onClose }: { prospect: ProspectListItem; onClose: () => void }) {
  const contact = prospect.decisionMakerName || prospect.decisionMakerRole || prospect.decisionMakerEmail
    ? [prospect.decisionMakerName, prospect.decisionMakerRole, prospect.decisionMakerEmail].filter(Boolean).join(" · ")
    : "Ansprechpartner noch offen";
  const address = [prospect.companyName, [prospect.city, prospect.country].filter(Boolean).join(", ")].filter(Boolean).join("\n");
  const reason = prospect.painType
    ? `Printversand empfohlen, weil der Lead in "${prospect.painType}" passt und ein ruhiger, vorbereiteter Briefkontakt sinnvoll sein kann.`
    : "Printversand empfohlen, weil noch kein sauberer digitaler Ansprechpartner bestätigt ist oder ein zusätzlicher Offline-Touchpoint sinnvoll sein kann.";
  const letterText = `Hallo,\n\nwir haben ${prospect.companyName} kurz geprüft und sehen mögliche Ansatzpunkte, operative Backoffice- oder Abstimmungsprozesse zu automatisieren.\n\nGern bereiten wir eine kurze Einschätzung vor, wo Tasklytic in Ihren Abläufen schnell Entlastung schaffen kann.`;
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="print-mailing-detail-title" className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="print-mailing-detail-title" className="text-lg font-semibold text-ink">Printversand Empfehlung</h3>
            <p className="mt-1 text-sm text-slate-500">Detailansicht für Vorbereitung und Prüfung. Es wird noch nichts versendet.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Schließen">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PrintInfo label="Warum empfohlen?" value={reason} />
          <PrintInfo label="Status" value="vorbereitet" />
          <PrintInfo label="Firmenadresse" value={address || "k. A."} />
          <PrintInfo label="Ansprechpartner" value={contact} />
        </div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Empfohlener Brieftext</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{letterText}</p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium">Nicht senden</button>
          <button type="button" className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Printversand vorbereiten
          </button>
        </div>
      </div>
    </div>
  );
}

function PrintInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function researchStatusLabel(status: string) {
  if (status === "waiting") return "Wartet";
  if (status === "running" || status === "in_progress") return "Läuft";
  if (status === "completed" || status === "enriched") return "Erfolgreich";
  if (status === "partial") return "Teilweise analysiert";
  if (status === "cookie_banner_blocked") return "Blockiert durch Cookie-Banner";
  if (status === "website_unreachable") return "Website nicht erreichbar";
  if (status === "no_website") return "Keine Website vorhanden";
  if (status === "failed") return "Fehler";
  if (status === "skipped") return "Übersprungen";
  return "Nicht gestartet";
}

function researchStatusTone(status: string) {
  if (status === "running" || status === "in_progress") return "bg-blue-50 text-blue-700 ring-blue-100";
  if (status === "completed" || status === "enriched") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "partial") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (isResearchFailureStatus(status)) return "bg-red-50 text-red-700 ring-red-100";
  if (status === "waiting") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (status === "skipped") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

function isResearchFailureStatus(status: string) {
  return status === "failed" || status === "cookie_banner_blocked" || status === "website_unreachable" || status === "no_website";
}

function researchProgressLabel(status: "waiting" | "running" | "completed" | "skipped" | "failed") {
  return researchStatusLabel(status);
}

function researchProgressTone(status: "waiting" | "running" | "completed" | "skipped" | "failed") {
  return researchStatusTone(status);
}

export function LevelBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();
  const tone = normalized === "high" || normalized === "hot"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : normalized === "medium" || normalized === "warm"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : "bg-slate-100 text-slate-600 ring-slate-200";

  return <span className={`inline-flex h-5 w-16 min-w-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold ring-1 ${tone}`}><span className="truncate">{level}</span></span>;
}

function ProspectWebsiteLink({ websiteUrl, compact }: { websiteUrl: string | null | undefined; compact?: boolean }) {
  if (!websiteUrl) return null;
  const href = normalizeExternalWebsiteHref(websiteUrl);
  if (!href) {
    return <span className="inline-flex min-h-8 items-center rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Website ungültig</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Website öffnen"
      title="Website öffnen"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] ${
        compact ? "min-h-9 px-2 py-1 text-xs" : "min-h-11 px-3 py-2 text-sm"
      }`}
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{compact ? "Website" : "Website öffnen"}</span>
    </a>
  );
}

export function LandingpageActions({ slug, landingpageUrl }: { slug: string | null; landingpageUrl?: string | null }) {
  const href = landingpageUrl || (slug ? `/p/${slug}` : "");
  const hasLandingpage = Boolean(href);

  function copyLink() {
    if (!hasLandingpage || typeof navigator === "undefined") return;
    void navigator.clipboard?.writeText(`${window.location.origin}${href}`);
  }

  function previewLink() {
    if (!hasLandingpage || typeof window === "undefined") return;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={previewLink}
        disabled={!hasLandingpage}
        aria-label="Landingpage Vorschau"
        title="Vorschau"
        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <a
        href={hasLandingpage ? href : undefined}
        aria-label="Landingpage öffnen"
        title="Öffnen"
        aria-disabled={!hasLandingpage}
        tabIndex={hasLandingpage ? undefined : -1}
        className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 ${hasLandingpage ? "" : "pointer-events-none opacity-40"}`}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={copyLink}
        disabled={!hasLandingpage}
        aria-label="Landingpage Link kopieren"
        title="Kopieren"
        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function ResearchDetailsModal({
  prospect,
  onRetry,
  onClose
}: {
  prospect: ProspectListItem;
  onRetry: () => void;
  onClose: () => void;
}) {
  const status = prospect.researchStatus ?? "not_started";
  const error = prospect.lastResearchError ?? prospect.enrichmentNotes ?? "Kein Fehlergrund gespeichert.";
  const lastAttempt = prospect.lastAttemptAt ?? prospect.lastResearchAt ?? prospect.researchedAt ?? null;
  return (
    <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Research Details</p>
            <h3 className="mt-1 break-words text-lg font-semibold text-ink">{prospect.companyName}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Schließen
          </button>
        </div>
        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Status</dt>
            <dd className="mt-1 font-medium text-slate-800">{researchStatusLabel(status)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Fehlergrund</dt>
            <dd className="mt-1 break-words text-slate-700">{error}</dd>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Website-Prüfung</dt>
              <dd className="mt-1 font-medium text-slate-700">
                {prospect.websiteVerified ? "Website geprüft" : prospect.websiteCandidate ? "Neue Website vorgeschlagen" : "Nicht bestätigt"}
                {typeof prospect.websiteConfidence === "number" ? ` (${prospect.websiteConfidence})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Website-Kandidat</dt>
              <dd className="mt-1 break-words font-medium text-slate-700">{prospect.websiteCandidate ?? "Nicht gespeichert"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">E-Mail-Prüfung</dt>
              <dd className="mt-1 font-medium text-slate-700">
                {prospect.emailVerified ? "E-Mail bestätigt" : prospect.emailCandidate ? "E-Mail aus Impressum gefunden" : "E-Mail unbestätigt"}
                {typeof prospect.emailConfidence === "number" ? ` (${prospect.emailConfidence})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Match-Quelle</dt>
              <dd className="mt-1 break-words font-medium text-slate-700">{prospect.companyMatchSource ?? "Nicht gespeichert"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Fehlercode</dt>
              <dd className="mt-1 font-medium text-slate-700">{prospect.lastResearchErrorCode ?? "Nicht gespeichert"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Letzter Versuch</dt>
              <dd className="mt-1 font-medium text-slate-700">{lastAttempt ? formatRelativeActivity(lastAttempt) : "Unbekannt"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Schritt</dt>
              <dd className="mt-1 font-medium text-slate-700">{prospect.failedStep ?? "Nicht gespeichert"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Quelle</dt>
              <dd className="mt-1 break-words font-medium text-slate-700">{prospect.sourceUrl ?? "Nicht gespeichert"}</dd>
            </div>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">
            Schließen
          </button>
          <button type="button" onClick={onRetry} className="btn-primary min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">
            Erneut analysieren
          </button>
        </div>
      </div>
    </div>
  );
}

export function BulkActionBar({
  selectedCount,
  selectionLabel,
  canSelectAllFiltered = false,
  selectedMode = "page",
  totalFiltered = selectedCount,
  bulkDeleting,
  activeAction,
  forceResearch = false,
  onForceResearchChange,
  researchProgress = {},
  researchCompletedCount = 0,
  researchTotalCount = 0,
  researchLimited = false,
  onSelectAllFiltered,
  onResearch,
  onGenerateLandingpages,
  onAddToCampaign,
  onAssignLeadList,
  onDelete
}: {
  selectedCount: number;
  selectionLabel?: string;
  canSelectAllFiltered?: boolean;
  selectedMode?: SelectionMode;
  totalFiltered?: number;
  bulkDeleting: boolean;
  activeAction?: null | "research" | "landingpages" | "campaign" | "leadlist" | "delete";
  forceResearch?: boolean;
  onForceResearchChange?: (value: boolean) => void;
  researchProgress?: Record<string, { status: "waiting" | "running" | "completed" | "skipped" | "failed"; message?: string }>;
  researchCompletedCount?: number;
  researchTotalCount?: number;
  researchLimited?: boolean;
  onSelectAllFiltered?: () => void;
  onResearch?: () => void;
  onGenerateLandingpages?: () => void;
  onAddToCampaign?: () => void;
  onAssignLeadList?: () => void;
  onDelete: () => void;
}) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="bulk-selection-bar">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-full">
          <p className="break-words text-sm font-semibold text-slate-800">
            {selectionLabel ?? getBulkSelectionLabel({ selectedCount, selectedMode })}
          </p>
          {canSelectAllFiltered && onSelectAllFiltered ? (
            <button
              type="button"
              onClick={onSelectAllFiltered}
              className="mt-1 max-w-full break-words text-left text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              Alle {totalFiltered.toLocaleString("de-DE")} Leads auswählen
            </button>
          ) : null}
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 overflow-visible sm:flex sm:flex-wrap sm:items-center sm:justify-start lg:w-auto lg:justify-end">
          {onResearch ? (
            <button type="button" onClick={onResearch} disabled={Boolean(activeAction)} className="inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-tight text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0">
              {activeAction === "research" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="min-w-0 break-words text-center">{activeAction === "research" ? "Reichert an..." : "Daten anreichern"}</span>
            </button>
          ) : null}
          {onGenerateLandingpages ? (
            <button type="button" onClick={onGenerateLandingpages} disabled={Boolean(activeAction)} className="inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-tight text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0">
              {activeAction === "landingpages" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="min-w-0 break-words text-center">{activeAction === "landingpages" ? "Landingpages werden erstellt..." : "Landingpages generieren"}</span>
            </button>
          ) : null}
          {onAddToCampaign ? (
            <button
              type="button"
              onClick={onAddToCampaign}
              disabled={Boolean(activeAction)}
              className="inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-tight text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
            >
              {activeAction === "campaign" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="min-w-0 break-words text-center">{activeAction === "campaign" ? "Wird hinzugefügt..." : "Zur Kampagne hinzufügen"}</span>
            </button>
          ) : null}
          {onAssignLeadList ? (
            <button type="button" onClick={onAssignLeadList} disabled={Boolean(activeAction)} className="inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-tight text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0">
              {activeAction === "leadlist" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="min-w-0 break-words text-center">{activeAction === "leadlist" ? "Wird vorbereitet..." : "Leadliste zuweisen"}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            disabled={selectedCount === 0 || bulkDeleting || Boolean(activeAction)}
            className="inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-semibold leading-tight text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 sm:shrink-0"
          >
            {activeAction === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
            <span className="min-w-0 break-words text-center">{activeAction === "delete" ? "Wird gelöscht..." : "Auswahl löschen"}</span>
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {onForceResearchChange ? (
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={forceResearch} onChange={(event) => onForceResearchChange(event.target.checked)} className="h-4 w-4" disabled={activeAction === "research"} />
            Bereits angereicherte erneut analysieren
          </label>
        ) : null}
        {activeAction === "research" && researchTotalCount > 0 ? (
          <span className="text-xs font-semibold text-blue-700">{researchCompletedCount} von {researchTotalCount} Leads angereichert</span>
        ) : null}
      </div>
      {Object.keys(researchProgress).length > 0 ? (
        <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto">
          {Object.entries(researchProgress).slice(0, 20).map(([id, item], index) => (
            <span key={id} title={item.message} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${researchProgressTone(item.status)}`}>
              {index + 1}: {researchProgressLabel(item.status)}
            </span>
          ))}
        </div>
      ) : null}
      {researchLimited ? (
        <p className="mt-2 text-xs font-medium text-amber-700">Datenanreicherung: max. 20 pro Lauf</p>
      ) : null}
    </div>
  );
}

export function BulkResearchLimitModal({
  selectedCount,
  onCancel,
  onRunFirstBatch
}: {
  selectedCount: number;
  onCancel: () => void;
  onRunFirstBatch: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-research-limit-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl">
        <h3 id="bulk-research-limit-title" className="text-lg font-semibold text-ink">
          Zu viele Leads ausgewählt
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Die Datenanreicherung ist auf maximal 20 Leads pro Lauf begrenzt. Aktuell sind {selectedCount.toLocaleString("de-DE")} Leads ausgewählt.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-medium sm:w-auto">
            Abbrechen
          </button>
          <button type="button" onClick={onRunFirstBatch} className="btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold sm:w-auto">
            Erste 20 Leads anreichern
          </button>
        </div>
      </div>
    </div>
  );
}

export function LeadListAssignModal({
  open,
  selectedCount,
  prospectIds,
  selectionPayload,
  leadLists,
  targetGroups = [],
  onClose,
  onSuccess,
  onError
}: {
  open: boolean;
  selectedCount: number;
  prospectIds: string[];
  selectionPayload: ProspectBulkSelectionPayload;
  leadLists: LeadListOption[];
  targetGroups?: CampaignFlowTargetGroup[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [leadListId, setLeadListId] = useState(leadLists[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLeadListId(leadLists[0]?.id ?? "");
      setName("");
      setDescription("");
      setTargetGroupId("");
      setMode(leadLists.length > 0 ? "existing" : "new");
      setSubmitting(false);
    }
  }, [leadLists, open]);

  if (!open) return null;

  async function assign() {
    setSubmitting(true);
    try {
      let listId = leadListId;
      if (mode === "new") {
        const createResponse = await fetch("/api/lead-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, targetGroupId })
        });
        const created = (await createResponse.json().catch(() => null)) as { id?: string; error?: string } | null;
        if (!createResponse.ok || !created?.id) throw new Error(created?.error ?? "Leadliste konnte nicht erstellt werden.");
        listId = created.id;
      }
      const response = await fetch(`/api/lead-lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectionPayload.selectionMode === "allFiltered" ? selectionPayload : { ...selectionPayload, prospectIds })
      });
      const body = (await response.json().catch(() => null)) as { added?: number; skipped?: number; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Leads konnten nicht zugewiesen werden.");
      onSuccess(`${body?.added ?? 0} Leads zugewiesen, ${body?.skipped ?? 0} übersprungen`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Leads konnten nicht zugewiesen werden.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="assign-lead-list-title" className="w-full max-w-lg overflow-hidden rounded-2xl bg-white p-6 shadow-2xl">
        <h3 id="assign-lead-list-title" className="text-lg font-semibold text-ink">Leadliste zuweisen</h3>
        <p className="mt-1 text-sm text-slate-500">{selectedCount} Leads ausgewählt</p>
        <div className="mt-5 space-y-4">
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button type="button" onClick={() => setMode("existing")} className={`flex-1 rounded-lg px-3 py-2 ${mode === "existing" ? "bg-white text-ink shadow-sm" : "text-slate-600"}`}>Bestehende</button>
            <button type="button" onClick={() => setMode("new")} className={`flex-1 rounded-lg px-3 py-2 ${mode === "new" ? "bg-white text-ink shadow-sm" : "text-slate-600"}`}>Neue Leadliste</button>
          </div>
          {mode === "existing" ? (
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block">Leadliste</span>
              <select value={leadListId} onChange={(event) => setLeadListId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.count ?? 0})</option>)}
              </select>
            </label>
          ) : (
            <div className="space-y-3">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Beschreibung optional" className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                <option value="">Keine Zielgruppe</option>
                {targetGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-medium sm:w-auto">Abbrechen</button>
          <button type="button" onClick={() => void assign()} disabled={submitting || (mode === "existing" ? !leadListId : !name.trim())} className="btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {submitting ? "Speichert..." : "Hinzufügen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatEngagementLabel(value: string) {
  if (value === "hot") return "Hot";
  if (value === "warm") return "Warm";
  return "Cold";
}

function formatRelativeActivity(value: string | Date | null | undefined) {
  if (!value) return "Keine Aktivität";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Keine Aktivität";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

type ProspectDetailApiResponse = ProspectCrmPanelData & {
  notes?: Array<{ id: string; text: string; createdAt: string }>;
  events?: Array<{ id: string; type: string; meta: unknown; scoreDelta: number; createdAt: string }>;
  campaignEnrollments?: Array<{
    id: string;
    status: string;
    campaign: {
      id: string;
      name: string;
      status: string;
      offerId?: string | null;
      targetGroupId?: string | null;
      offer?: { id: string; name: string } | null;
    };
  }>;
  targetGroup?: { id: string; name: string } | null;
  targetGroups?: Array<{ id: string; name: string }>;
  suggestedOffer?: { id: string; name: string } | null;
};

export function prospectDetailFromApi(prospect: ProspectDetailApiResponse): ProspectCrmPanelData {
  const activeEnrollment = prospect.campaignEnrollments?.find((enrollment) => enrollment.status === "active") ?? prospect.campaignEnrollments?.[0] ?? null;
  return {
    id: prospect.id,
    companyName: prospect.companyName,
    legalName: prospect.legalName ?? null,
    salutation: prospect.salutation ?? null,
    firstName: prospect.firstName ?? null,
    lastName: prospect.lastName ?? null,
    decisionMakerName: prospect.decisionMakerName ?? null,
    decisionMakerRole: prospect.decisionMakerRole ?? null,
    decisionMakerEmail: prospect.decisionMakerEmail ?? null,
    decisionMakerPhone: prospect.decisionMakerPhone ?? null,
    decisionMakerSourceUrl: prospect.decisionMakerSourceUrl ?? null,
    decisionMakerSourceTextSnippet: prospect.decisionMakerSourceTextSnippet ?? null,
    decisionMakerFoundAt: prospect.decisionMakerFoundAt ?? null,
    decisionMakerConfidence: prospect.decisionMakerConfidence ?? null,
    contactCandidates: prospect.contactCandidates ?? null,
    companyEmail: prospect.companyEmail ?? null,
    companyPhone: prospect.companyPhone ?? null,
    contactPageUrl: prospect.contactPageUrl ?? null,
    generalContactLabel: prospect.generalContactLabel ?? null,
    phone: prospect.phone ?? null,
    linkedinUrl: prospect.linkedinUrl ?? null,
    websiteUrl: prospect.websiteUrl ?? null,
    city: prospect.city,
    postalCode: prospect.postalCode ?? null,
    street: prospect.street ?? null,
    state: prospect.state ?? null,
    country: prospect.country,
    employeeRange: prospect.employeeRange ?? null,
    employeeCount: prospect.employeeCount ?? null,
    vehicleCount: prospect.vehicleCount ?? null,
    trailerCount: prospect.trailerCount ?? null,
    locationsCount: prospect.locationsCount ?? null,
    businessFields: prospect.businessFields ?? [],
    companyStatus: prospect.companyStatus,
    icpScore: prospect.icpScore,
    icpFitScore: prospect.icpFitScore,
    icpFitLabel: prospect.icpFitLabel,
    industry: prospect.industry ?? null,
    painScore: prospect.painScore,
    painType: prospect.painType ?? null,
    painSummary: prospect.painSummary ?? null,
    painEvidence: prospect.painEvidence ?? null,
    hiringSignal: prospect.hiringSignal ?? false,
    growthSignal: prospect.growthSignal ?? false,
    manualProcessSignal: prospect.manualProcessSignal ?? false,
    digitalWeaknessSignal: prospect.digitalWeaknessSignal ?? false,
    personalizationAngle: prospect.personalizationAngle ?? null,
    researchStatus: prospect.researchStatus,
    researchSources: prospect.researchSources ?? null,
    researchedAt: prospect.researchedAt ?? null,
    lastResearchError: prospect.lastResearchError ?? null,
    lastResearchErrorCode: prospect.lastResearchErrorCode ?? null,
    lastResearchAt: prospect.lastResearchAt ?? null,
    failedStep: prospect.failedStep ?? null,
    sourceUrl: prospect.sourceUrl ?? null,
    lastAttemptAt: prospect.lastAttemptAt ?? null,
    lastSuccessfulResearchAt: prospect.lastSuccessfulResearchAt ?? null,
    companyDescription: prospect.companyDescription ?? null,
    services: prospect.services ?? null,
    companySizeLabel: prospect.companySizeLabel ?? null,
    employeeCountEstimate: prospect.employeeCountEstimate ?? null,
    fleetSizeEstimate: prospect.fleetSizeEstimate ?? null,
    specialization: prospect.specialization ?? null,
    targetCustomers: prospect.targetCustomers ?? null,
    companyProfileSummary: prospect.companyProfileSummary ?? null,
    painSignals: prospect.painSignals,
    customPainPoint: prospect.customPainPoint ?? null,
    engagementScore: prospect.engagementScore,
    engagementLevel: prospect.engagementLevel,
    status: prospect.status,
    leadStatus: prospect.leadStatus,
    targetGroupId: prospect.targetGroupId ?? null,
    targetGroup: prospect.targetGroup ?? null,
    suggestedOfferId: prospect.suggestedOfferId ?? null,
    suggestedOffer: prospect.suggestedOffer ?? null,
    targetGroups: prospect.targetGroups ?? [],
    followUpAt: prospect.followUpAt ?? null,
    followUpReason: prospect.followUpReason ?? null,
    followUpStatus: prospect.followUpStatus ?? "open",
    lastContactedAt: prospect.lastContactedAt ?? null,
    lastEmailSentAt: prospect.lastEmailSentAt ?? null,
    assignedTo: prospect.assignedTo ?? null,
    showInCrm: prospect.showInCrm,
    source: prospect.source ?? null,
    slug: prospect.slug ?? null,
    landingpageUrl: prospect.landingpageUrl ?? null,
    landingpageReviewStatus: prospect.landingpageReviewStatus,
    personalVideoStatus: prospect.personalVideoStatus,
    personalVideoUrl: prospect.personalVideoUrl ?? null,
    videoUrl: prospect.videoUrl ?? null,
    notes: prospect.notes ?? [],
    events: prospect.events ?? [],
    activeCampaign: activeEnrollment ? {
      id: activeEnrollment.campaign.id,
      enrollmentId: activeEnrollment.id,
      name: activeEnrollment.campaign.name,
      status: activeEnrollment.campaign.status,
      offerId: activeEnrollment.campaign.offerId ?? null,
      offerName: activeEnrollment.campaign.offer?.name ?? null,
      targetGroupId: activeEnrollment.campaign.targetGroupId ?? null,
      enrollmentStatus: activeEnrollment.status
    } : null
  };
}
