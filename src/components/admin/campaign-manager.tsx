"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import {
  defaultProspectsPageSize,
  getCompactPaginationPages,
  normalizeProspectsPageSize,
  prospectsPageSizeOptions,
  prospectsPageSizeStorageKey,
  type PaginatedResponse,
  type Pagination
} from "@/lib/pagination";
import { canSendCampaignNow, getEffectiveCampaignSendingStatus, getNextAllowedCampaignSendAt } from "@/lib/scheduling";

export type CampaignAdminData = {
  campaigns: CampaignListItem[];
  pagination: Pagination;
  selectedCampaign: CampaignDetail | null;
  eligibleProspects: EligibleProspect[];
  targetGroups?: Array<{ id: string; name: string; defaultOfferId?: string | null }>;
  offers?: CampaignOffer[];
  initialTab?: string;
  dashboardFilter?: string;
  statusFilter?: string;
  hasSentFilter?: string;
};

type CampaignListItem = {
  id: string;
  name: string;
  status: string;
  sendingStatus: string;
  createdAt: string;
  scheduledStartAt: string | null;
  timezone: string;
  sendWindowStart: string | null;
  sendWindowEnd: string | null;
  weekdaysOnly: boolean;
  manualGoApproved: boolean;
  stepsCount: number;
  enrollmentsCount: number;
  sentCount: number;
  failedCount: number;
};

type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  sendingStatus: string;
  trackingEnabled: boolean;
  estimatedDealValue: number | null;
  estimatedCostPerLead: number | null;
  notes: string | null;
  scheduledStartAt: string | null;
  timezone: string;
  sendWindowStart: string | null;
  sendWindowEnd: string | null;
  weekdaysOnly: boolean;
  manualGoApproved: boolean;
  targetGroupId: string | null;
  offerId?: string | null;
  selectedProspectId?: string | null;
  steps: Array<{
    id: string;
    stepNumber: number;
    delayDays: number;
    subject: string;
    body: string;
    isActive: boolean;
  }>;
  emailVariants: CampaignEmailVariantDraft[];
  variantStats: CampaignVariantStats[];
  enrollments: Array<{
    id: string;
    status: string;
    prospectId: string;
    createdAt: string;
    currentStep: number;
    emailVariantId: string | null;
    emailVariantLabel: string | null;
    blockedReason: string | null;
    nextSendAt: string | null;
    lastSentAt: string | null;
    repliedAt: string | null;
    bookedAt: string | null;
    notInterestedAt: string | null;
    prospect: {
      companyName: string;
      city: string;
      decisionMakerEmail: string | null;
      slug: string | null;
      landingpageUrl: string | null;
      landingpageReviewStatus: string;
      totalScore: number;
      status: string;
    };
  }>;
  sendLogs: Array<{
    id: string;
    status: string;
    email: string;
    subject: string;
    error: string | null;
    messageId: string | null;
    sentAt: string | null;
    createdAt: string;
    openCount: number;
    clickCount: number;
    emailVariantLabel: string | null;
    prospect: {
      companyName: string;
    };
    step: {
      stepNumber: number;
    };
  }>;
};

type CampaignEmailVariantDraft = {
  id?: string;
  label: string;
  subject: string;
  bodyText: string;
  weight: number;
  landingpageUrl?: string | null;
  isActive: boolean;
};

type CampaignVariantStats = {
  id: string;
  label: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  landingpageVisited: number;
  videoStarted: number;
  replied: number;
  booked: number;
  openRate: number;
  clickRate: number;
  landingpageVisitRate: number;
  replyRate: number;
  bookingRate: number;
};

type EligibleProspect = {
  id: string;
  companyName: string;
  city: string;
  companyEmail?: string | null;
  decisionMakerEmail: string | null;
  decisionMakerName?: string | null;
  slug: string | null;
  landingpageUrl: string | null;
  landingpageReviewStatus: string;
  totalScore: number;
  status: string;
  fitScore: number;
  icpScore?: number;
  icpFitScore?: number;
  icpFitLabel?: string;
  icpCategory: string;
  engagementLevel?: string;
  leadStatus?: string;
  targetGroupId?: string | null;
  targetGroupName?: string | null;
  painType?: string | null;
  painSignals: Array<{ type: string; label: string; strength: number }>;
  videoUrl: string | null;
};

type CampaignOffer = {
  id: string;
  name: string;
  targetGroupId: string | null;
  isDefault: boolean;
};

type FormMessage = {
  type: "success" | "error";
  text: string;
} | null;

type CampaignApiItem = CampaignListItem & {
  steps?: unknown[];
  enrollments?: unknown[];
  sendLogs?: Array<{ status: string }>;
};

type LeadPickerApiResponse = { data: EligibleProspect[]; totalProspects: number; error?: string } | { error?: string };

type LeadPickerFilters = {
  search: string;
  targetGroupId: string;
  includeUntargetedWithTargetGroup: boolean;
  icpScore: string;
  engagement: string;
  status: string;
  painType: string;
};

const firstMailSubject = "Kurzer Blick auf {{companyName}}";
const firstMailVariantA = `Hallo {{firstName}},

ich habe Ihnen eine kurze persönliche Seite vorbereitet.

Dort zeige ich, wo bei Aufträgen, Abstimmung oder Übergaben möglicherweise unnötig Zeit verloren geht.

Hier ansehen:
{{landingPageUrl}}

Viele Grüße
Nikolai`;
const firstMailVariantB = `Hallo {{firstName}},

ich habe dir eine kurze persönliche Seite vorbereitet.

Dort zeige ich, wo bei Aufträgen, Abstimmung oder Übergaben möglicherweise unnötig Zeit verloren geht.

Hier ansehen:
{{landingPageUrl}}

Viele Grüße
Nikolai`;

function defaultEmailVariants(): CampaignEmailVariantDraft[] {
  return [
    { label: "A", subject: firstMailSubject, bodyText: firstMailVariantA, weight: 50, landingpageUrl: "", isActive: true },
    { label: "B", subject: firstMailSubject, bodyText: firstMailVariantB, weight: 50, landingpageUrl: "", isActive: true }
  ];
}

export function removeCampaignFromList(campaigns: CampaignListItem[], campaignId: string) {
  return campaigns.filter((campaign) => campaign.id !== campaignId);
}

export async function deleteCampaign(campaignId: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`/api/campaigns/${campaignId}`, { method: "DELETE" });
  if (!response.ok) {
    let message = "Kampagne konnte nicht gelöscht werden.";
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // Keep the fallback message when the API returns no JSON body.
    }
    throw new Error(message);
  }
}

export function getCampaignPaginationPages(totalPages: number) {
  return Array.from({ length: Math.max(1, totalPages) }, (_, index) => index + 1);
}

export function getCampaignListHref(
  campaignId?: string,
  page?: number,
  filters: { dashboardFilter?: string; statusFilter?: string; hasSentFilter?: string; tab?: string } = {}
) {
  const params = new URLSearchParams();
  if (campaignId) params.set("campaignId", campaignId);
  if (page && page > 1) params.set("page", String(page));
  if (filters.statusFilter) params.set("status", filters.statusFilter);
  if (filters.hasSentFilter) params.set("hasSent", filters.hasSentFilter);
  if (filters.dashboardFilter) params.set("dashboardFilter", filters.dashboardFilter);
  if (filters.tab && filters.tab !== "uebersicht") params.set("tab", filters.tab);
  const query = params.toString();
  return query ? `/admin/campaigns?${query}` : "/admin/campaigns";
}

export function getDefaultLeadPickerFilters(): LeadPickerFilters {
  return {
    search: "",
    targetGroupId: "",
    includeUntargetedWithTargetGroup: false,
    icpScore: "",
    engagement: "",
    status: "",
    painType: ""
  };
}

export function filterLeadPickerProspects(prospects: EligibleProspect[], filters: LeadPickerFilters) {
  const search = filters.search.trim().toLowerCase();
  return prospects.filter((prospect) => {
    const haystack = [
      prospect.companyName,
      prospect.city,
      prospect.decisionMakerName,
      prospect.decisionMakerEmail,
      prospect.companyEmail
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const icpScore = prospect.icpFitScore ?? prospect.icpScore ?? prospect.fitScore ?? prospect.totalScore;
    if (search && !haystack.includes(search)) return false;
    if (filters.targetGroupId) {
      const isSelectedTargetGroup = prospect.targetGroupId === filters.targetGroupId;
      const isUntargeted = !prospect.targetGroupId;
      if (!isSelectedTargetGroup && !(filters.includeUntargetedWithTargetGroup && isUntargeted)) return false;
    }
    if (filters.icpScore === "70" && icpScore < 70) return false;
    if (filters.icpScore === "40" && (icpScore < 40 || icpScore >= 70)) return false;
    if (filters.icpScore === "0" && icpScore >= 40) return false;
    if (filters.engagement && (prospect.engagementLevel ?? "cold") !== filters.engagement) return false;
    if (filters.status && prospect.status !== filters.status && prospect.leadStatus !== filters.status) return false;
    if (filters.painType && prospect.painType !== filters.painType) return false;
    return true;
  });
}

function campaignFromApi(campaign: CampaignApiItem): CampaignListItem {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    sendingStatus: getEffectiveCampaignSendingStatus({ status: campaign.status, sendingStatus: campaign.sendingStatus }),
    createdAt: campaign.createdAt,
    scheduledStartAt: campaign.scheduledStartAt ?? null,
    timezone: campaign.timezone,
    sendWindowStart: campaign.sendWindowStart ?? null,
    sendWindowEnd: campaign.sendWindowEnd ?? null,
    weekdaysOnly: campaign.weekdaysOnly,
    manualGoApproved: campaign.manualGoApproved,
    stepsCount: campaign.stepsCount ?? campaign.steps?.length ?? 0,
    enrollmentsCount: campaign.enrollmentsCount ?? campaign.enrollments?.length ?? 0,
    sentCount: campaign.sentCount ?? campaign.sendLogs?.filter((log) => log.status === "sent").length ?? 0,
    failedCount: campaign.failedCount ?? campaign.sendLogs?.filter((log) => log.status === "failed").length ?? 0
  };
}

export function CampaignManager({
  campaigns,
  pagination,
  selectedCampaign,
  eligibleProspects,
  targetGroups = [],
  offers = [],
  initialTab = "uebersicht",
  dashboardFilter = "",
  statusFilter = "",
  hasSentFilter = ""
}: CampaignAdminData) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [message, setMessage] = useState<FormMessage>(null);
  const [isPending, startTransition] = useTransition();
  const [visibleCampaigns, setVisibleCampaigns] = useState(campaigns);
  const [currentPagination, setCurrentPagination] = useState(pagination);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [confirmCampaign, setConfirmCampaign] = useState<CampaignListItem | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [stepCount, setStepCount] = useState(4);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [aiProspectId, setAiProspectId] = useState("");
  const [aiProspects, setAiProspects] = useState<EligibleProspect[]>(eligibleProspects);
  const [loadingAiProspects, setLoadingAiProspects] = useState(false);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadProspects, setLeadProspects] = useState<EligibleProspect[]>(eligibleProspects);
  const [totalLeadProspects, setTotalLeadProspects] = useState(eligibleProspects.length);
  const [leadPickerPage, setLeadPickerPage] = useState(1);
  const [leadPickerLimit, setLeadPickerLimit] = useState(defaultProspectsPageSize);
  const [campaignSendLimit, setCampaignSendLimit] = useState(20);
  const [leadFilters, setLeadFilters] = useState<LeadPickerFilters>(() => getDefaultLeadPickerFilters());
  const [newCampaignTargetGroupId, setNewCampaignTargetGroupId] = useState("");
  const [newCampaignOfferId, setNewCampaignOfferId] = useState("");
  const [aiTone, setAiTone] = useState("direkt");
  const [aiVariants, setAiVariants] = useState<Array<{ label: "A" | "B"; subject: string; body: string }>>([]);
  const [selectedVariant, setSelectedVariant] = useState<"A" | "B">("A");
  const [stepDrafts, setStepDrafts] = useState<CampaignDetail["steps"]>(selectedCampaign?.steps ?? []);
  const [newEmailVariants, setNewEmailVariants] = useState<CampaignEmailVariantDraft[]>(() => defaultEmailVariants());
  const [emailVariantDrafts, setEmailVariantDrafts] = useState<CampaignEmailVariantDraft[]>(selectedCampaign?.emailVariants ?? []);
  const enrolledProspectIds = useMemo(
    () => new Set(selectedCampaign?.enrollments.map((entry) => entry.prospectId) ?? []),
    [selectedCampaign]
  );
  const selectedRecipientSet = useMemo(() => new Set(recipientIds), [recipientIds]);
  const painTypes = useMemo(
    () => [...new Set(leadProspects.map((prospect) => prospect.painType).filter(Boolean) as string[])].sort(),
    [leadProspects]
  );
  const selectedCampaignTargetGroupName = useMemo(
    () => targetGroups.find((group) => group.id === selectedCampaign?.targetGroupId)?.name ?? null,
    [selectedCampaign?.targetGroupId, targetGroups]
  );
  const filteredLeadProspects = useMemo(() => {
    return filterLeadPickerProspects(leadProspects, leadFilters);
  }, [leadFilters, leadProspects]);
  const leadPickerTotalPages = Math.max(1, Math.ceil(filteredLeadProspects.length / leadPickerLimit));
  const visibleLeadPickerProspects = useMemo(() => {
    const normalizedPage = Math.min(leadPickerPage, leadPickerTotalPages);
    const start = (normalizedPage - 1) * leadPickerLimit;
    return filteredLeadProspects.slice(start, start + leadPickerLimit);
  }, [filteredLeadProspects, leadPickerLimit, leadPickerPage, leadPickerTotalPages]);

  useEffect(() => {
    setStepDrafts(selectedCampaign?.steps ?? []);
    setEmailVariantDrafts(selectedCampaign?.emailVariants ?? []);
  }, [selectedCampaign?.id, selectedCampaign?.steps, selectedCampaign?.emailVariants]);

  useEffect(() => {
    const storedLimit = normalizeProspectsPageSize(window.localStorage.getItem(prospectsPageSizeStorageKey));
    setLeadPickerLimit(storedLimit);
  }, []);

  useEffect(() => {
    if (!selectedCampaign?.id) return;
    const storedLimit = Number(window.localStorage.getItem(`campaignSendLimit:${selectedCampaign.id}`));
    setCampaignSendLimit(Number.isInteger(storedLimit) && storedLimit > 0 ? Math.min(storedLimit, 20) : 20);
  }, [selectedCampaign?.id]);

  useEffect(() => {
    setLeadPickerPage(1);
  }, [leadFilters, leadPickerLimit]);

  useEffect(() => {
    if (leadPickerPage > leadPickerTotalPages) {
      setLeadPickerPage(leadPickerTotalPages);
    }
  }, [leadPickerPage, leadPickerTotalPages]);

  useEffect(() => {
    setVisibleCampaigns(campaigns);
    setSelectedCampaignIds([]);
  }, [campaigns]);

  useEffect(() => {
    setCurrentPagination(pagination);
  }, [pagination]);

  useEffect(() => {
    setLoadingAiProspects(true);
    fetch("/api/campaigns/lead-picker", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as LeadPickerApiResponse | null;
        if (!response.ok || !body) {
          throw new Error(body && "error" in body ? body.error : "Prospects konnten nicht geladen werden.");
        }
        const prospects = "data" in body ? body.data : [];
        setLeadProspects(prospects);
        setTotalLeadProspects("totalProspects" in body ? body.totalProspects : prospects.length);
        setAiProspects(prospects);
        if (!aiProspectId && selectedCampaign?.selectedProspectId && prospects.some((prospect) => prospect.id === selectedCampaign.selectedProspectId)) {
          setAiProspectId(selectedCampaign.selectedProspectId);
        }
      })
      .catch((error) => {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Prospects konnten nicht geladen werden."
        });
      })
      .finally(() => setLoadingAiProspects(false));
  }, [selectedCampaign?.selectedProspectId]);

  function resetLeadFilters() {
    setLeadFilters(getDefaultLeadPickerFilters());
  }

  function openLeadModal() {
    resetLeadFilters();
    setLeadPickerPage(1);
    setLeadModalOpen(true);
  }

  function handleLeadPickerPageSizeChange(limit: number) {
    const nextLimit = normalizeProspectsPageSize(limit);
    window.localStorage.setItem(prospectsPageSizeStorageKey, String(nextLimit));
    setLeadPickerLimit(nextLimit);
    setLeadPickerPage(1);
  }

  async function loadCampaignPage(page: number) {
    if (page === currentPagination.page || loadingPage) return;

    setLoadingPage(page);
    setMessage(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(currentPagination.limit));
    if (statusFilter) params.set("status", statusFilter);
    if (hasSentFilter) params.set("hasSent", hasSentFilter);
    if (dashboardFilter) params.set("dashboardFilter", dashboardFilter);

    try {
      const response = await fetch(`/api/campaigns?${params.toString()}`);
      const body = (await response.json().catch(() => null)) as PaginatedResponse<CampaignApiItem> | { error?: string } | null;
      if (!response.ok || !body || !("data" in body)) {
        throw new Error(body && "error" in body ? body.error : "Kampagnen konnten nicht geladen werden.");
      }
      setVisibleCampaigns(body.data.map(campaignFromApi));
      setCurrentPagination(body.pagination);
      setSelectedCampaignIds([]);
      window.history.pushState(null, "", getCampaignListHref(undefined, page, { dashboardFilter, statusFilter, hasSentFilter, tab: activeTab }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Kampagnen konnten nicht geladen werden."
      });
    } finally {
      setLoadingPage(null);
    }
  }

  async function createCampaign(formData: FormData) {
    const offerId = String(formData.get("offerId") ?? "").trim();
    if (!offerId) {
      throw new Error("Bitte Angebot auswählen");
    }

    const steps = Array.from({ length: stepCount })
      .map((_, index) => ({
        delayDays: formData.get(`step-${index}-delayDays`),
        subject: index === 0 ? newEmailVariants[0]?.subject : formData.get(`step-${index}-subject`),
        bodyText: index === 0 ? newEmailVariants[0]?.bodyText : formData.get(`step-${index}-bodyText`)
      }))
      .filter((step) => String(step.subject ?? "").trim() && String(step.bodyText ?? "").trim());

    if (newEmailVariants.filter((variant) => variant.isActive).length < 2) {
      throw new Error("Bitte mindestens zwei Varianten für Mail 1 aktivieren.");
    }

    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        status: "active",
        targetGroupId: formData.get("targetGroupId") || undefined,
        offerId,
        selectedProspectId: formData.get("selectedProspectId") || undefined,
        steps,
        emailVariants: newEmailVariants
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Kampagne konnte nicht erstellt werden.");
    }

    const campaign = (await response.json()) as { id: string };
    if (recipientIds.length > 0) {
      const enrollmentResponse = await fetch(`/api/campaigns/${campaign.id}/prospects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: recipientIds })
      });
      if (!enrollmentResponse.ok) {
        const data = (await enrollmentResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Kampagne wurde erstellt, aber Leads konnten nicht hinzugefügt werden.");
      }
    }

    window.location.href = "/admin/campaigns";
  }

  async function handleDeleteCampaign() {
    if (!confirmCampaign) {
      return;
    }

    setDeletingCampaignId(confirmCampaign.id);
    setMessage(null);

    try {
      await deleteCampaign(confirmCampaign.id);
      setVisibleCampaigns((current) => removeCampaignFromList(current, confirmCampaign.id));
      setMessage({ type: "success", text: "Kampagne gelöscht" });
      setConfirmCampaign(null);

      if (selectedCampaign?.id === confirmCampaign.id) {
        router.push("/admin/campaigns");
      }
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Kampagne konnte nicht gelöscht werden."
      });
    } finally {
      setDeletingCampaignId(null);
    }
  }

  async function handleBulkDeleteCampaigns() {
    if (selectedCampaignIds.length === 0) return;

    setBulkDeleting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/campaigns/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedCampaignIds })
      });
      const body = (await response.json().catch(() => null)) as { deleted?: number; failed?: number; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Ausgewählte Kampagnen konnten nicht gelöscht werden.");
      setVisibleCampaigns((current) => current.filter((campaign) => !selectedCampaignIds.includes(campaign.id)));
      setSelectedCampaignIds([]);
      setConfirmBulkDelete(false);
      setMessage({ type: "success", text: `${body?.deleted ?? 0} gelöscht, ${body?.failed ?? 0} fehlgeschlagen.` });
      if (selectedCampaign && selectedCampaignIds.includes(selectedCampaign.id)) {
        router.push("/admin/campaigns");
      }
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Ausgewählte Kampagnen konnten nicht gelöscht werden." });
    } finally {
      setBulkDeleting(false);
    }
  }

  async function generateAiCopy() {
    if (!aiProspectId) {
      throw new Error("Bitte zuerst einen Prospect auswählen.");
    }

    const response = await fetch("/api/ai/generate-campaign-copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: aiProspectId,
        campaignId: selectedCampaign?.id,
        tone: aiTone,
        variantCount: 2,
        numberOfSteps: 3,
        offerId: selectedCampaign?.offerId ?? newCampaignOfferId
      })
    });
    const data = (await response.json().catch(() => null)) as
      | { error?: string; variants?: Array<{ label: "A" | "B"; subject: string; body: string }>; steps?: Array<{ subject: string; body: string; delayDays: number }> }
      | null;

    if (!response.ok || !data?.variants?.length) {
      throw new Error(data?.error ?? "KI-Texte konnten nicht erzeugt werden.");
    }

    setAiVariants(data.variants);
    setSelectedVariant(data.variants[0]?.label ?? "A");
  }

  function applyAiVariant() {
    const variant = aiVariants.find((item) => item.label === selectedVariant) ?? aiVariants[0];
    if (!variant) return;
    setNewEmailVariants((current) =>
      current.map((item) => item.label === variant.label ? { ...item, subject: variant.subject, bodyText: variant.body } : item)
    );
    const subject = document.querySelector<HTMLInputElement>('input[name="step-0-subject"]');
    const body = document.querySelector<HTMLTextAreaElement>('textarea[name="step-0-bodyText"]');
    if (subject) subject.value = variant.subject;
    if (body) body.value = variant.body;
    setMessage({ type: "success", text: `Variante ${variant.label} wurde in Step 1 übernommen.` });
  }

  async function addProspectsByIds(prospectIds: string[]) {
    if (!selectedCampaign) {
      throw new Error("Keine Kampagne ausgewählt.");
    }

    const response = await fetch(`/api/campaigns/${selectedCampaign.id}/prospects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectIds })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Prospects konnten nicht hinzugefügt werden.");
    }

    const result = (await response.json()) as { added: number; skipped: number; failed: number };
    setMessage({
      type: "success",
      text: `${result.added} Leads hinzugefügt, ${result.skipped} übersprungen, ${result.failed} fehlgeschlagen.`
    });
    setRecipientIds([]);
    setLeadModalOpen(false);
    router.refresh();
  }

  async function confirmLeadSelection() {
    if (selectedCampaign) {
      await addProspectsByIds(recipientIds);
      return;
    }

    setLeadModalOpen(false);
  }

  async function sendDue() {
    if (!selectedCampaign) {
      throw new Error("Keine Kampagne ausgewählt.");
    }

    const response = await fetch(`/api/campaigns/${selectedCampaign.id}/send-due`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: campaignSendLimit })
    });

    const data = (await response.json().catch(() => null)) as
      | { error?: string; attempted?: number; sent?: number; failed?: number; skipped?: number; remainingDue?: number; blockedReason?: string; reason?: string }
      | null;

    if (!response.ok) {
      throw new Error(data?.error ?? "Fällige Mails konnten nicht gesendet werden.");
    }

    setMessage({
      type: data?.blockedReason || data?.reason ? "error" : "success",
      text:
        data?.blockedReason ??
        data?.reason ??
        `${data?.sent ?? 0} gesendet, ${data?.failed ?? 0} fehlgeschlagen, ${data?.skipped ?? 0} übersprungen, ${data?.remainingDue ?? 0} weitere fällig.`
    });
    router.refresh();
  }

  function runAction(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        setMessage(null);
        await action();
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Aktion fehlgeschlagen"
        });
      }
    });
  }

  async function updateEnrollmentStatus(enrollmentId: string, action: string) {
    if (!selectedCampaign) {
      return;
    }

    const response = await fetch(`/api/campaigns/${selectedCampaign.id}/enrollments/${enrollmentId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Status konnte nicht aktualisiert werden.");
    }

    router.refresh();
  }

  async function updateLandingpageReviewStatus(prospectId: string, landingpageReviewStatus: "draft" | "needs_review" | "approved") {
    const response = await fetch(`/api/prospects/${prospectId}/landingpage-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landingpageReviewStatus })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Landingpage-Status konnte nicht aktualisiert werden.");
    }

    router.refresh();
  }

  function buildSchedulePayload(formData: FormData, overrides: Partial<{ scheduledStartAt: string | null; timezone: string; sendWindowStart: string | null; sendWindowEnd: string | null; weekdaysOnly: boolean; manualGoApproved: boolean; sendingStatus: string; }> = {}) {
    return {
      scheduledStartAt: buildScheduledStart(formData),
      timezone: String(formData.get("timezone") || "Europe/Berlin"),
      sendWindowStart: String(formData.get("sendWindowStart") || "") || null,
      sendWindowEnd: String(formData.get("sendWindowEnd") || "") || null,
      weekdaysOnly: formData.get("weekdaysOnly") === "on",
      manualGoApproved: formData.get("manualGoApproved") === "on",
      sendingStatus: "draft",
      ...overrides
    };
  }

  async function saveCampaignSettings(formData: FormData, scheduleOverrides: Partial<ReturnType<typeof buildSchedulePayload>> = {}) {
    if (!selectedCampaign) {
      return;
    }
    const offerId = String(formData.get("offerId") ?? "").trim();
    if (!offerId) {
      throw new Error("Bitte Angebot auswählen");
    }

    const steps = stepDrafts
      .map((step, index) => ({
        stepNumber: Number(step.stepNumber || index + 1),
        delayDays: Number(step.delayDays || 0),
        subject: step.subject.trim(),
        body: (step.body ?? "").trim(),
        isActive: step.isActive
      }))
      .filter((step) => step.subject && step.body);

    const schedulePayload = buildSchedulePayload(formData, scheduleOverrides);
    const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        status: formData.get("status"),
        sendingStatus: schedulePayload.sendingStatus,
        trackingEnabled: formData.get("trackingEnabled") === "on",
        estimatedDealValue: formData.get("estimatedDealValue") || null,
        estimatedCostPerLead: formData.get("estimatedCostPerLead") || null,
        notes: formData.get("notes") || null,
        targetGroupId: formData.get("targetGroupId") || null,
        offerId,
        selectedProspectId: formData.get("selectedProspectId") || null,
        scheduledStartAt: schedulePayload.scheduledStartAt,
        timezone: schedulePayload.timezone,
        sendWindowStart: schedulePayload.sendWindowStart,
        sendWindowEnd: schedulePayload.sendWindowEnd,
        weekdaysOnly: schedulePayload.weekdaysOnly,
        manualGoApproved: schedulePayload.manualGoApproved,
        steps,
        emailVariants: emailVariantDrafts
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Kampagne konnte nicht gespeichert werden.");
    }

    window.localStorage.setItem(`campaignSendLimit:${selectedCampaign.id}`, String(campaignSendLimit));

    setMessage({ type: "success", text: "Kampagne gespeichert." });
    router.refresh();
  }

  async function duplicateCampaign(campaignId: string) {
    const response = await fetch(`/api/campaigns/${campaignId}/duplicate`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!response.ok || !data?.id) {
      throw new Error(data?.error ?? "Kampagne konnte nicht dupliziert werden.");
    }
    window.location.href = `/admin/campaigns?campaignId=${data.id}`;
  }

  async function saveCampaignSteps() {
    if (!selectedCampaign) {
      return;
    }

    const steps = stepDrafts.map((step, index) => ({
      stepNumber: Number(step.stepNumber || index + 1),
      delayDays: Number(step.delayDays || 0),
      subject: step.subject.trim(),
      body: (step.body ?? "").trim(),
      isActive: step.isActive
    }));

    const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Sequenz konnte nicht gespeichert werden.");
    }

    setMessage({ type: "success", text: "Sequenz gespeichert." });
    router.refresh();
  }

  async function saveEmailVariants() {
    if (!selectedCampaign) {
      return;
    }
    if (emailVariantDrafts.filter((variant) => variant.isActive).length < 2) {
      throw new Error("Bitte mindestens zwei aktive Varianten speichern.");
    }

    const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailVariants: emailVariantDrafts })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Varianten konnten nicht gespeichert werden.");
    }

    setMessage({ type: "success", text: "Varianten gespeichert." });
    router.refresh();
  }

  async function saveCampaignAction(overrides: Partial<ReturnType<typeof buildSchedulePayload>>) {
    if (!formRef.current) {
      throw new Error("Kampagnenformular ist nicht verfügbar.");
    }

    await saveCampaignSettings(new FormData(formRef.current), overrides);
  }

  function describeNextCampaignSendTime(campaign: CampaignListItem) {
    const effectiveSendingStatus = getEffectiveCampaignSendingStatus({
      status: campaign.status,
      sendingStatus: campaign.sendingStatus
    });
    const schedule = {
      status: campaign.status,
      sendingStatus: effectiveSendingStatus,
      scheduledStartAt: campaign.scheduledStartAt ? new Date(campaign.scheduledStartAt) : null,
      timezone: campaign.timezone,
      sendWindowStart: campaign.sendWindowStart,
      sendWindowEnd: campaign.sendWindowEnd,
      weekdaysOnly: campaign.weekdaysOnly,
      manualGoApproved: campaign.manualGoApproved
    };

    if (!campaign.manualGoApproved) {
      return "wartet auf Freigabe";
    }

    if (!["active", "scheduled"].includes(effectiveSendingStatus)) {
      return effectiveSendingStatus;
    }

    if (schedule.scheduledStartAt && schedule.scheduledStartAt > new Date()) {
      return schedule.scheduledStartAt.toLocaleString("de-DE", {
        dateStyle: "short",
        timeStyle: "short"
      });
    }

    if (canSendCampaignNow(schedule, new Date()).allowed) {
      return "sofort";
    }

    return getNextAllowedCampaignSendAt(schedule, new Date()).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <AdminBackButton href="/admin/dashboard" />
      <div className="grid w-full min-w-0 max-w-full gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="w-full min-w-0 max-w-full space-y-4 overflow-hidden rounded-3xl bg-white p-6 shadow-panel">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-ink">Kampagnen</h1>
            <p className="mt-1 text-sm text-slate-500">Manueller SMTP-Versand in Batches bis 20.</p>
          </div>
          <Link href="/admin/prospects" className="text-sm font-medium">
            Prospects
          </Link>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0"
                checked={visibleCampaigns.length > 0 && visibleCampaigns.every((campaign) => selectedCampaignIds.includes(campaign.id))}
                onChange={(event) => {
                  const visibleIds = visibleCampaigns.map((campaign) => campaign.id);
                  setSelectedCampaignIds((current) => {
                    const next = new Set(current);
                    if (event.target.checked) visibleIds.forEach((id) => next.add(id));
                    else visibleIds.forEach((id) => next.delete(id));
                    return [...next];
                  });
                }}
              />
              <span className="min-w-0 break-words">Alle auf dieser Seite auswählen</span>
            </label>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-600">{selectedCampaignIds.length} ausgewählt</span>
              <button type="button" onClick={() => setConfirmBulkDelete(true)} disabled={selectedCampaignIds.length === 0 || bulkDeleting} className="btn-danger w-full rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                Ausgewählte löschen
              </button>
            </div>
          </div>
          {loadingPage ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Lädt Seite {loadingPage}...
            </div>
          ) : null}
          {visibleCampaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              Noch keine Kampagnen.
            </div>
          ) : (
            visibleCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`w-full min-w-0 max-w-full overflow-hidden rounded-2xl border p-4 transition ${
                  selectedCampaign?.id === campaign.id
                    ? "border-brand bg-accent/40"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0"
                      aria-label={`${campaign.name} auswählen`}
                      checked={selectedCampaignIds.includes(campaign.id)}
                      onChange={(event) =>
                        setSelectedCampaignIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, campaign.id])]
                            : current.filter((id) => id !== campaign.id)
                        )
                      }
                    />
                    <div className="min-w-0">
                    <Link href={getCampaignListHref(campaign.id, currentPagination.page, { dashboardFilter, statusFilter, hasSentFilter, tab: activeTab })} className="break-words font-medium text-ink hover:text-brand">
                      {campaign.name}
                    </Link>
                    <p className="text-sm text-slate-500">{getEffectiveCampaignSendingStatus({ status: campaign.status, sendingStatus: campaign.sendingStatus })}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {campaign.stepsCount} Steps
                    </span>
                    <Link
                      href={getCampaignListHref(campaign.id, currentPagination.page, { dashboardFilter, statusFilter, hasSentFilter, tab: "einstellungen" })}
                      aria-label={`${campaign.name} bearbeiten`}
                      title="Bearbeiten"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => runAction(() => duplicateCampaign(campaign.id))}
                      aria-label={`${campaign.name} duplizieren`}
                      title="Duplizieren"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCampaign(campaign)}
                      aria-label={`${campaign.name} löschen`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {campaign.enrollmentsCount} Prospects
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    {campaign.sentCount} sent
                  </span>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                    {campaign.failedCount} failed
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    Start: {campaign.scheduledStartAt ? new Date(campaign.scheduledStartAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "offen"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    Freigabe: {campaign.manualGoApproved ? "ja" : "nein"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    Nächster Versand: {describeNextCampaignSendTime(campaign)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => loadCampaignPage(currentPagination.page - 1)}
            disabled={currentPagination.page <= 1 || Boolean(loadingPage)}
            className="btn-secondary rounded-full px-3 py-2 text-sm font-medium"
          >
            Zurück
          </button>
          <div className="flex flex-wrap gap-2">
            {getCompactPaginationPages(currentPagination.page, currentPagination.totalPages).map((page, index) => (
              page === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="grid h-9 min-w-9 place-items-center text-sm font-semibold text-slate-400">...</span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => loadCampaignPage(page)}
                  disabled={Boolean(loadingPage)}
                  aria-current={currentPagination.page === page ? "page" : undefined}
                  className={`h-9 min-w-9 rounded-full px-3 text-sm font-semibold ${
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
            onClick={() => loadCampaignPage(currentPagination.page + 1)}
            disabled={currentPagination.page >= currentPagination.totalPages || Boolean(loadingPage)}
            className="btn-secondary rounded-full px-3 py-2 text-sm font-medium"
          >
            Weiter
          </button>
        </div>
      </aside>

      <div className="space-y-6">
        {message ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-panel">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Neue Kampagne</h2>
              <p className="mt-1 text-sm text-slate-500">
                Platzhalter: {"{{companyName}}"}, {"{{city}}"}, {"{{decisionMakerName}}"}, {"{{landingpageUrl}}"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStepCount((current) => Math.min(current + 1, 6))}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate"
            >
              Step hinzufügen
            </button>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block w-full min-w-0 flex-1 space-y-2 md:min-w-64">
                <span className="text-sm font-medium text-slate">Beispiel-Prospect für KI-Texte</span>
                <select name="selectedProspectId" value={aiProspectId} onChange={(event) => setAiProspectId(event.target.value)}>
                  <option value="">{loadingAiProspects ? "Prospects werden geladen..." : "Prospect auswählen"}</option>
                  {aiProspects.map((prospect) => (
                    <option key={prospect.id} value={prospect.id}>
                      {prospect.companyName} · {prospect.city}{prospect.decisionMakerName ? ` · ${prospect.decisionMakerName}` : ""}
                    </option>
                  ))}
                </select>
                {!loadingAiProspects && aiProspects.length === 0 ? (
                  <span className="block text-xs text-slate-500">Keine Prospects vorhanden</span>
                ) : null}
              </label>
              <label className="block w-full min-w-0 space-y-2 md:min-w-44">
                <span className="text-sm font-medium text-slate">Tonalität</span>
                <select value={aiTone} onChange={(event) => setAiTone(event.target.value)}>
                  <option value="direkt">direkt</option>
                  <option value="freundlich">freundlich</option>
                  <option value="sehr kurz">sehr kurz</option>
                  <option value="beratend">beratend</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => runAction(generateAiCopy)}
                className="btn-primary rounded-full px-4 py-2.5 text-sm font-medium"
                disabled={isPending}
              >
                E-Mail mit KI erstellen
              </button>
            </div>
            {aiVariants.length > 0 ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {aiVariants.map((variant) => (
                    <button
                      key={variant.label}
                      type="button"
                      onClick={() => setSelectedVariant(variant.label)}
                      className={`rounded-full px-3 py-2 text-xs font-medium ${
                        selectedVariant === variant.label ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Variante {variant.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {aiVariants.map((variant) => (
                    <div key={variant.label} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Variante {variant.label}
                        </p>
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="radio"
                            name="aiVariant"
                            checked={selectedVariant === variant.label}
                            onChange={() => setSelectedVariant(variant.label)}
                          />
                          Auswählen
                        </label>
                      </div>
                      <label className="mt-3 block space-y-2">
                        <span className="text-sm font-medium text-slate">Betreff</span>
                        <input
                          value={variant.subject}
                          onChange={(event) =>
                            setAiVariants((current) =>
                              current.map((item) =>
                                item.label === variant.label ? { ...item, subject: event.target.value } : item
                              )
                            )
                          }
                        />
                      </label>
                      <label className="mt-3 block space-y-2">
                        <span className="text-sm font-medium text-slate">Text</span>
                        <textarea
                          rows={8}
                          value={variant.body}
                          onChange={(event) =>
                            setAiVariants((current) =>
                              current.map((item) =>
                                item.label === variant.label ? { ...item, body: event.target.value } : item
                              )
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyAiVariant}
                    className="btn-primary rounded-full px-4 py-2 text-sm font-medium"
                  >
                    Ausgewählte Variante übernehmen
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiVariants([])}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate"
                  >
                    Verwerfen
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              runAction(() => createCampaign(formData));
            }}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Name</span>
              <input name="name" required placeholder="April Outreach Speditionen" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Zielgruppe</span>
              <select
                name="targetGroupId"
                value={newCampaignTargetGroupId}
                onChange={(event) => setNewCampaignTargetGroupId(event.target.value)}
              >
                <option value="">Keine Zielgruppe</option>
                {targetGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Angebot</span>
              <select name="offerId" required value={newCampaignOfferId} onChange={(event) => setNewCampaignOfferId(event.target.value)}>
                <option value="">Bitte Angebot auswählen</option>
                {offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.name}{offer.isDefault ? " (Standard)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="selectedProspectId" value={aiProspectId} />

            <EmailVariantEditor
              variants={newEmailVariants}
              onChange={setNewEmailVariants}
              allowThirdVariant
            />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-ink">Leads zur Kampagne hinzufügen</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {recipientIds.length} Leads ausgewählt. Versand startet erst über "Fällige Mails senden".
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openLeadModal}
                  className="btn-secondary rounded-full px-4 py-2 text-sm font-medium"
                >
                  Leads hinzufügen
                </button>
              </div>
              {recipientIds.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {eligibleProspects
                    .filter((prospect) => selectedRecipientSet.has(prospect.id))
                    .slice(0, 8)
                    .map((prospect) => (
                      <span key={prospect.id} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                        {prospect.companyName}
                      </span>
                    ))}
                  {recipientIds.length > 8 ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">+{recipientIds.length - 8}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              {Array.from({ length: stepCount }).map((_, index) => (
                <div key={index} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[120px_minmax(0,1fr)]">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate">Tage</span>
                    <input
                      name={`step-${index}-delayDays`}
                      type="number"
                      min={0}
                      defaultValue={[0, 2, 4, 7][index] ?? index * 3}
                    />
                  </label>
                  <div className="space-y-3">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate">Betreff Step {index + 1}</span>
                      <input
                        name={`step-${index}-subject`}
                        placeholder={`Kurzer Impuls für {{companyName}}`}
                        defaultValue={index === 0 ? newEmailVariants[0]?.subject : undefined}
                        required={index === 0}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate">Text</span>
                      <textarea
                        name={`step-${index}-bodyText`}
                        rows={5}
                        required={index === 0}
                        defaultValue={index === 0 ? newEmailVariants[0]?.bodyText : undefined}
                        placeholder={"Hallo {{decisionMakerName}},\n\nich habe eine kurze Seite für {{companyName}} vorbereitet:\n{{landingpageUrl}}"}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary rounded-full px-5 py-3 text-sm font-medium"
                disabled={isPending}
              >
                Kampagne erstellen
              </button>
            </div>
          </form>
        </section>

        {selectedCampaign ? (
          <>
            <section className="rounded-3xl bg-white p-6 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-ink">{selectedCampaign.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedCampaign.sendingStatus} · {selectedCampaign.enrollments.length} Prospects
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runAction(sendDue)}
                  className="btn-primary rounded-full px-5 py-3 text-sm font-medium"
                  disabled={isPending}
                >
                  Fällige Mails senden
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {selectedCampaign.steps.map((step) => (
                  <div key={step.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Step {step.stepNumber} · +{step.delayDays} Tage
                    </p>
                    <p className="mt-2 font-medium text-ink">{step.subject}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-500">{step.body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-ink">Follow-up Sequenz</h3>
                    <p className="mt-1 text-sm text-slate-500">Reihenfolge, Aktivierung und Verzögerung pro Step.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setStepDrafts((current) => [
                        ...current,
                        {
                          id: `draft-${Date.now()}`,
                          stepNumber: current.length ? Math.max(...current.map((entry) => entry.stepNumber)) + 1 : 1,
                          delayDays: current.length ? 7 : 0,
                          subject: "",
                          body: "",
                          isActive: true
                        }
                      ])
                    }
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Step hinzufügen
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  {stepDrafts
                    .slice()
                    .sort((left, right) => left.stepNumber - right.stepNumber)
                    .map((step, index) => (
                      <div key={step.id ?? `${step.stepNumber}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-ink">Step {step.stepNumber}</p>
                          <label className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={step.isActive}
                              onChange={(event) =>
                                setStepDrafts((current) =>
                                  current.map((item) => (item.id === step.id ? { ...item, isActive: event.target.checked } : item))
                                )
                              }
                              className="h-5 w-5 shrink-0"
                            />
                            <span className="min-w-0 break-words">Aktiv</span>
                          </label>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-600">Reihenfolge</span>
                            <input
                              type="number"
                              min={1}
                              value={step.stepNumber}
                              onChange={(event) =>
                                setStepDrafts((current) =>
                                  current.map((item) =>
                                    item.id === step.id ? { ...item, stepNumber: Number(event.target.value || 1) } : item
                                  )
                                )
                              }
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-600">Delay Tage</span>
                            <input
                              type="number"
                              min={0}
                              value={step.delayDays}
                              onChange={(event) =>
                                setStepDrafts((current) =>
                                  current.map((item) =>
                                    item.id === step.id ? { ...item, delayDays: Number(event.target.value || 0) } : item
                                  )
                                )
                              }
                            />
                          </label>
                          <label className="block space-y-2 md:col-span-2">
                            <span className="text-sm font-medium text-slate-600">Betreff</span>
                            <input
                              value={step.subject}
                              onChange={(event) =>
                                setStepDrafts((current) =>
                                  current.map((item) => (item.id === step.id ? { ...item, subject: event.target.value } : item))
                                )
                              }
                              placeholder="Betreff der Mail"
                            />
                          </label>
                          <label className="block space-y-2 md:col-span-4">
                            <span className="text-sm font-medium text-slate-600">Text</span>
                            <textarea
                              rows={6}
                              value={step.body}
                              onChange={(event) =>
                                setStepDrafts((current) =>
                                  current.map((item) => (item.id === step.id ? { ...item, body: event.target.value } : item))
                                )
                              }
                              placeholder={"Hallo {{decisionMakerName}},\n\nich habe eine kurze Seite für {{companyName}} vorbereitet:\n{{landingpageUrl}}"}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => runAction(saveCampaignSteps)}
                    className="btn-primary rounded-full px-5 py-3 text-sm font-medium"
                    disabled={isPending}
                  >
                    Sequenz speichern
                  </button>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["uebersicht", "steps", "kontakte", "sendelog", "analytics", "einstellungen"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-3 py-2 text-xs font-medium ${
                      activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </section>

            {activeTab === "kontakte" || activeTab === "uebersicht" ? (
            <section className="rounded-3xl bg-white p-6 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Leads zur Kampagne hinzufügen</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Angezeigt werden nur Prospects mit E-Mail und vorbereiteter Landingpage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openLeadModal}
                  className="btn-secondary rounded-full px-4 py-2 text-sm font-medium"
                >
                  Leads hinzufügen
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-500">{selectedCampaign.enrollments.length} Leads sind aktuell in dieser Kampagne.</p>
            </section>
            ) : null}

            {activeTab === "kontakte" ? (
              <section className="rounded-3xl bg-white p-6 shadow-panel">
                <h2 className="text-xl font-semibold text-ink">Kampagnenkontakte</h2>
                <div className="mt-4 space-y-3">
                  {selectedCampaign.enrollments.map((enrollment) => (
                    <div key={enrollment.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{enrollment.prospect.companyName}</p>
                          <p className="text-sm text-slate-500">{enrollment.prospect.decisionMakerEmail}</p>
                          <p className="mt-1 text-xs text-slate-500">Landingpage: {reviewLabel(enrollment.prospect.landingpageReviewStatus)}</p>
                          <p className="mt-1 text-xs text-slate-500">Variante: {enrollment.emailVariantLabel ?? "-"}</p>
                          {enrollment.blockedReason ? <p className="mt-1 text-xs font-semibold text-red-700">{enrollment.blockedReason}</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {enrollment.prospect.slug ? <Link href={`/p/${enrollment.prospect.slug}`} target="_blank" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Vorschau</Link> : null}
                          {enrollment.prospect.slug ? <Link href={`/p/${enrollment.prospect.slug}`} target="_blank" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Mobile Preview</Link> : null}
                          {enrollment.prospect.slug ? <Link href={`/p/${enrollment.prospect.slug}`} target="_blank" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Desktop Preview</Link> : null}
                          <button type="button" onClick={() => runAction(() => updateLandingpageReviewStatus(enrollment.prospectId, "approved"))} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Freigeben</button>
                          <button type="button" onClick={() => runAction(() => updateLandingpageReviewStatus(enrollment.prospectId, "draft"))} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600">Zurück auf Entwurf</button>
                          <button type="button" onClick={() => runAction(() => updateEnrollmentStatus(enrollment.id, "replied"))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Antwort erhalten</button>
                          <button type="button" onClick={() => runAction(() => updateEnrollmentStatus(enrollment.id, "booked"))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Termin vereinbart</button>
                          <button type="button" onClick={() => runAction(() => updateEnrollmentStatus(enrollment.id, "not_interested"))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Kein Interesse</button>
                          <button type="button" onClick={() => runAction(() => updateEnrollmentStatus(enrollment.id, "reset"))} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600">Zurücksetzen</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === "analytics" ? (
              <section className="rounded-3xl bg-white p-6 shadow-panel">
                <h2 className="text-xl font-semibold text-ink">Analytics</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Metric label="Sent" value={selectedCampaign.sendLogs.filter((log) => log.status === "sent").length} />
                  <Metric label="Opened" value={selectedCampaign.sendLogs.filter((log) => log.openCount > 0).length} />
                  <Metric label="Clicked" value={selectedCampaign.sendLogs.filter((log) => log.clickCount > 0).length} />
                  <Metric label="Replied" value={selectedCampaign.enrollments.filter((entry) => entry.repliedAt).length} />
                  <Metric label="Booked" value={selectedCampaign.enrollments.filter((entry) => entry.bookedAt).length} />
                  <Metric label="Tracking" value={selectedCampaign.trackingEnabled ? "aktiv" : "aus"} />
                </div>
                <VariantPerformanceTable stats={selectedCampaign.variantStats} />
              </section>
            ) : null}

            {activeTab === "steps" ? (
              <section className="rounded-3xl bg-white p-6 shadow-panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-ink">Varianten Mail 1</h2>
                  <button type="button" onClick={() => runAction(saveEmailVariants)} disabled={isPending} className="btn-primary rounded-full px-5 py-3 text-sm font-medium">
                    Varianten speichern
                  </button>
                </div>
                <div className="mt-5">
                  <EmailVariantEditor variants={emailVariantDrafts} onChange={setEmailVariantDrafts} allowThirdVariant />
                </div>
              </section>
            ) : null}

            {activeTab === "einstellungen" ? (
              <section className="rounded-3xl bg-white p-6 shadow-panel">
                <h2 className="text-xl font-semibold text-ink">Kampagnen-Einstellungen</h2>
                <form
                  ref={formRef}
                  className="mt-5 grid gap-4 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runAction(() => saveCampaignSettings(new FormData(event.currentTarget), { sendingStatus: "draft", manualGoApproved: false }));
                  }}
                >
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate">Kampagnenname</span>
                    <input name="name" required defaultValue={selectedCampaign.name} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate">Status</span>
                    <select name="status" defaultValue={selectedCampaign.status === "paused" ? "paused" : "active"}>
                      <option value="active">aktiv</option>
                      <option value="paused">pausiert</option>
                    </select>
                  </label>
                  <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 p-4">
                    <input name="trackingEnabled" type="checkbox" defaultChecked={selectedCampaign.trackingEnabled} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 break-words text-sm font-medium text-ink">Tracking aktivieren</span>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate">Zielgruppe</span>
                    <select name="targetGroupId" defaultValue={selectedCampaign.targetGroupId ?? ""}>
                      <option value="">Keine Zielgruppe</option>
                      {targetGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate">Angebot</span>
                    <select name="offerId" required defaultValue={selectedCampaign.offerId ?? ""}>
                      <option value="">Bitte Angebot auswählen</option>
                      {offers.map((offer) => (
                        <option key={offer.id} value={offer.id}>
                          {offer.name}{offer.isDefault ? " (Standard)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate">Prospect für KI-Texte</span>
                    <select name="selectedProspectId" defaultValue={selectedCampaign.selectedProspectId ?? aiProspectId}>
                      <option value="">Kein Prospect ausgewählt</option>
                      {aiProspects.map((prospect) => (
                        <option key={prospect.id} value={prospect.id}>
                          {prospect.companyName} · {prospect.city}{prospect.decisionMakerName ? ` · ${prospect.decisionMakerName}` : ""}
                        </option>
                      ))}
                    </select>
                    {!loadingAiProspects && aiProspects.length === 0 ? (
                      <span className="text-xs text-slate-500">Keine Prospects vorhanden</span>
                    ) : null}
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate">Geschätzter Dealwert</span>
                    <input name="estimatedDealValue" type="number" min={0} defaultValue={selectedCampaign.estimatedDealValue ?? ""} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate">Kosten pro Lead</span>
                    <input name="estimatedCostPerLead" type="number" min={0} defaultValue={selectedCampaign.estimatedCostPerLead ?? ""} />
                  </label>
                  <label className="block space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate">Notizen</span>
                    <textarea name="notes" rows={4} defaultValue={selectedCampaign.notes ?? ""} />
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-ink">Start & Versand</h3>
                      <p className="text-sm text-slate-500">
                        E-Mails werden erst versendet, wenn die Kampagne freigegeben ist und die Zeitregeln passen.
                      </p>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate">Startdatum</span>
                        <input name="scheduledDate" type="date" defaultValue={selectedCampaign.scheduledStartAt?.slice(0, 10) ?? ""} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate">Startuhrzeit</span>
                        <input name="scheduledTime" type="time" defaultValue={selectedCampaign.scheduledStartAt?.slice(11, 16) ?? ""} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate">Versandlimit</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={campaignSendLimit}
                          onChange={(event) => setCampaignSendLimit(Math.max(1, Math.min(20, Number(event.target.value || 20))))}
                        />
                        <span className="text-xs text-slate-500">Mails pro manuellem Versandlauf</span>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate">Zeitzone</span>
                        <input name="timezone" defaultValue={selectedCampaign.timezone ?? "Europe/Berlin"} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate">Versandfenster von</span>
                        <input name="sendWindowStart" type="time" defaultValue={selectedCampaign.sendWindowStart ?? ""} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate">Versandfenster bis</span>
                        <input name="sendWindowEnd" type="time" defaultValue={selectedCampaign.sendWindowEnd ?? ""} />
                      </label>
                      <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 p-4">
                        <input name="weekdaysOnly" type="checkbox" defaultChecked={selectedCampaign.weekdaysOnly} className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 break-words text-sm font-medium text-ink">Nur werktags senden</span>
                      </label>
                      <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 p-4 md:col-span-2">
                        <input name="manualGoApproved" type="checkbox" defaultChecked={selectedCampaign.manualGoApproved} className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 break-words text-sm font-medium text-ink">Kampagne freigeben</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 md:col-span-2">
                    <button type="submit" className="btn-secondary rounded-full px-5 py-3 text-sm font-medium">
                      Als Entwurf speichern
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(() => saveCampaignAction({ sendingStatus: "scheduled", manualGoApproved: false }))}
                      className="btn-primary rounded-full px-5 py-3 text-sm font-medium"
                    >
                      Planen
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(() => saveCampaignAction({ sendingStatus: "active", manualGoApproved: true }))}
                      className="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700"
                    >
                      Kampagne freigeben
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(() => saveCampaignAction({ sendingStatus: "paused", manualGoApproved: false }))}
                      className="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700"
                    >
                      Pausieren
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            {activeTab === "sendelog" || activeTab === "uebersicht" ? (
            <section className="rounded-3xl bg-white p-6 shadow-panel">
              <h2 className="text-xl font-semibold text-ink">EmailSendLog</h2>
              <div className="mt-5 space-y-3 md:hidden">
                {selectedCampaign.sendLogs.length === 0 ? (
                  <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Noch keine Versandversuche.</p>
                ) : selectedCampaign.sendLogs.map((log) => (
                  <article key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="min-w-0 flex-1 truncate font-semibold text-ink">{log.prospect.companyName}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs ${log.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{new Date(log.createdAt).toLocaleString("de-DE")} · Step {log.step.stepNumber} · Variante {log.emailVariantLabel ?? "-"}</p>
                    <p className="mt-3 break-words text-sm font-medium text-slate-700">{log.subject}</p>
                    {log.error ? <p className="mt-2 break-words text-sm text-red-700">{log.error}</p> : null}
                  </article>
                ))}
              </div>
              <div className="mt-5 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="py-3">Zeit</th>
                      <th className="py-3">Prospect</th>
                      <th className="py-3">Step</th>
                      <th className="py-3">Variante</th>
                      <th className="py-3">Status</th>
                      <th className="py-3">Betreff</th>
                      <th className="py-3">Fehler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedCampaign.sendLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-5 text-slate-500">
                          Noch keine Versandversuche.
                        </td>
                      </tr>
                    ) : (
                      selectedCampaign.sendLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="py-3 text-slate-500">
                            {new Date(log.createdAt).toLocaleString("de-DE")}
                          </td>
                          <td className="py-3">{log.prospect.companyName}</td>
                          <td className="py-3">Step {log.step.stepNumber}</td>
                          <td className="py-3">{log.emailVariantLabel ?? "-"}</td>
                          <td className="py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs ${
                                log.status === "sent"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3">{log.subject}</td>
                          <td className="py-3 text-red-700">{log.error ?? ""}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            ) : null}
          </>
        ) : null}
      </div>
      </div>

      {leadModalOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="lead-picker-title" className="mx-auto flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="lead-picker-title" className="text-lg font-semibold text-ink">Leads hinzufügen</h3>
                  <p className="mt-1 text-sm text-slate-500">{recipientIds.length} Leads ausgewählt</p>
                  {selectedCampaignTargetGroupName ? (
                    <p className="mt-1 text-sm text-slate-500">Kampagne ist auf Zielgruppe {selectedCampaignTargetGroupName} eingestellt</p>
                  ) : null}
                </div>
                <button type="button" onClick={() => setLeadModalOpen(false)} className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium">
                  Schließen
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-6">
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-slate-500">Suche</span>
                  <input
                    value={leadFilters.search}
                    onChange={(event) => setLeadFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Firma, Stadt, Kontakt, E-Mail"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">Zielgruppe</span>
                  <select
                    value={leadFilters.targetGroupId}
                    onChange={(event) => setLeadFilters((current) => ({ ...current, targetGroupId: event.target.value, includeUntargetedWithTargetGroup: false }))}
                  >
                    <option value="">Alle</option>
                    {targetGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">ICP Score</span>
                  <select value={leadFilters.icpScore} onChange={(event) => setLeadFilters((current) => ({ ...current, icpScore: event.target.value }))}>
                    <option value="">Alle</option>
                    <option value="70">70+</option>
                    <option value="40">40-69</option>
                    <option value="0">0-39</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">Hot/Warm/Cold</span>
                  <select value={leadFilters.engagement} onChange={(event) => setLeadFilters((current) => ({ ...current, engagement: event.target.value }))}>
                    <option value="">Alle</option>
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">Status</span>
                  <select value={leadFilters.status} onChange={(event) => setLeadFilters((current) => ({ ...current, status: event.target.value }))}>
                    <option value="">Alle</option>
                    <option value="draft">Draft</option>
                    <option value="qualified">Qualified</option>
                    <option value="contacted">Contacted</option>
                    <option value="responded">Responded</option>
                    <option value="open">Open</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">Pain Type</span>
                  <select value={leadFilters.painType} onChange={(event) => setLeadFilters((current) => ({ ...current, painType: event.target.value }))}>
                    <option value="">Alle</option>
                    {painTypes.map((painType) => <option key={painType} value={painType}>{painType}</option>)}
                  </select>
                </label>
                {leadFilters.targetGroupId ? (
                  <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0"
                      checked={leadFilters.includeUntargetedWithTargetGroup}
                      onChange={(event) => setLeadFilters((current) => ({ ...current, includeUntargetedWithTargetGroup: event.target.checked }))}
                    />
                    <span className="min-w-0 break-words">Leads ohne Zielgruppe ebenfalls anzeigen</span>
                  </label>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={visibleLeadPickerProspects.length > 0 && visibleLeadPickerProspects.every((prospect) => selectedRecipientSet.has(prospect.id) || enrolledProspectIds.has(prospect.id))}
                    onChange={(event) => {
                      const visibleIds = visibleLeadPickerProspects
                        .filter((prospect) => !enrolledProspectIds.has(prospect.id))
                        .map((prospect) => prospect.id);
                      setRecipientIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) {
                          visibleIds.forEach((id) => next.add(id));
                        } else {
                          visibleIds.forEach((id) => next.delete(id));
                        }
                        return [...next];
                      });
                    }}
                  />
                  <span className="min-w-0 break-words">Alle sichtbaren auswählen</span>
                </label>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>Leads pro Seite</span>
                    <select
                      value={leadPickerLimit}
                      onChange={(event) => handleLeadPickerPageSizeChange(Number(event.target.value))}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                    >
                      {prospectsPageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <span className="text-sm text-slate-500">
                    {filteredLeadProspects.length} Treffer · Seite {leadPickerPage} von {leadPickerTotalPages}
                  </span>
                </div>
              </div>
              <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Auswahl</th>
                      <th className="p-3">Lead</th>
                      <th className="p-3">Zielgruppe</th>
                      <th className="p-3">ICP</th>
                      <th className="p-3">Hot/Warm/Cold</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Pain Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleLeadPickerProspects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-5 text-slate-500">
                          <div className="flex flex-col items-start gap-3">
                            <span>Keine Leads für diese Filter.</span>
                            <button type="button" onClick={resetLeadFilters} className="btn-secondary rounded-full px-4 py-2 text-sm font-medium">
                              Filter zurücksetzen
                            </button>
                            <span>Insgesamt vorhandene Leads: {totalLeadProspects}</span>
                          </div>
                        </td>
                      </tr>
                    ) : visibleLeadPickerProspects.map((prospect) => {
                      const enrolled = enrolledProspectIds.has(prospect.id);
                      const checked = selectedRecipientSet.has(prospect.id);
                      return (
                        <tr key={prospect.id} className={enrolled ? "bg-slate-50 text-slate-400" : undefined}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              className="h-5 w-5 shrink-0"
                              checked={checked}
                              disabled={enrolled}
                              onChange={(event) =>
                                setRecipientIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, prospect.id])]
                                    : current.filter((id) => id !== prospect.id)
                                )
                              }
                            />
                          </td>
                          <td className="p-3">
                            <span className="block font-medium text-ink">{prospect.companyName}</span>
                            <span className="block text-xs text-slate-500">{prospect.city} · {prospect.decisionMakerEmail}</span>
                            {enrolled ? <span className="mt-1 block text-xs text-slate-500">bereits in Kampagne</span> : null}
                          </td>
                          <td className="p-3">{prospect.targetGroupName ?? "-"}</td>
                          <td className="p-3">{prospect.icpFitScore ?? prospect.icpScore ?? prospect.fitScore}</td>
                          <td className="p-3">{prospect.engagementLevel ?? "cold"}</td>
                          <td className="p-3">{prospect.leadStatus ?? prospect.status}</td>
                          <td className="p-3">{prospect.painType ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setLeadPickerPage((current) => Math.max(1, current - 1))}
                  disabled={leadPickerPage <= 1}
                  className="btn-secondary rounded-xl px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Zurück
                </button>
                <div className="flex flex-wrap gap-2">
                  {getCompactPaginationPages(leadPickerPage, leadPickerTotalPages).map((page, index) => (
                    page === "ellipsis" ? (
                      <span key={`lead-picker-ellipsis-${index}`} className="grid h-9 min-w-9 place-items-center text-sm font-semibold text-slate-400">...</span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setLeadPickerPage(page)}
                        aria-current={leadPickerPage === page ? "page" : undefined}
                        className={`h-9 min-w-9 rounded-xl px-3 text-sm font-semibold ${
                          leadPickerPage === page ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setLeadPickerPage((current) => Math.min(leadPickerTotalPages, current + 1))}
                  disabled={leadPickerPage >= leadPickerTotalPages}
                  className="btn-secondary rounded-xl px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Weiter
                </button>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white p-5">
              <span className="text-sm font-medium text-slate-700">{recipientIds.length} Leads ausgewählt</span>
              <button
                type="button"
                onClick={() => runAction(confirmLeadSelection)}
                disabled={isPending || recipientIds.length === 0}
                className="btn-primary rounded-full px-5 py-3 text-sm font-medium"
              >
                Ausgewählte Leads hinzufügen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmCampaign ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-campaign-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="delete-campaign-title" className="text-lg font-semibold text-ink">
              Kampagne löschen?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Diese Kampagne wird dauerhaft gelöscht. Zugehörige Steps, Empfänger, Versandlogs und geplante Follow-ups können entfernt werden.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmCampaign(null)}
                disabled={deletingCampaignId === confirmCampaign.id}
                className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleDeleteCampaign}
                disabled={deletingCampaignId === confirmCampaign.id}
                className="btn-danger rounded-xl px-4 py-2 text-sm font-semibold"
              >
                {deletingCampaignId === confirmCampaign.id ? "Löscht..." : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmBulkDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="bulk-delete-campaign-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="bulk-delete-campaign-title" className="text-lg font-semibold text-ink">
              Ausgewählte Einträge löschen?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting} className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium">
                Abbrechen
              </button>
              <button type="button" onClick={handleBulkDeleteCampaigns} disabled={bulkDeleting} className="btn-danger rounded-xl px-4 py-2 text-sm font-semibold">
                {bulkDeleting ? "Löscht..." : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildScheduledStart(formData: FormData): string | null {
  const date = String(formData.get("scheduledDate") ?? "");
  const time = String(formData.get("scheduledTime") ?? "");
  if (!date) return null;
  return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function EmailVariantEditor({
  variants,
  onChange,
  allowThirdVariant
}: {
  variants: CampaignEmailVariantDraft[];
  onChange: (variants: CampaignEmailVariantDraft[]) => void;
  allowThirdVariant?: boolean;
}) {
  function updateVariant(label: string, patch: Partial<CampaignEmailVariantDraft>) {
    onChange(variants.map((variant) => (variant.label === label ? { ...variant, ...patch } : variant)));
  }

  function addThirdVariant() {
    if (variants.some((variant) => variant.label === "C")) return;
    onChange([
      ...variants.map((variant, index) => ({ ...variant, weight: index === 0 ? 34 : 33 })),
      { label: "C", subject: firstMailSubject, bodyText: firstMailVariantA, weight: 33, landingpageUrl: "", isActive: true }
    ]);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">A/B-Test Mail 1</h3>
          <p className="mt-1 text-sm text-slate-500">Pflicht: {"{{landingPageUrl}}"}</p>
        </div>
        {allowThirdVariant && variants.length < 3 ? (
          <button type="button" onClick={addThirdVariant} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate">
            Variante C hinzufügen
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {variants.map((variant) => (
          <div key={variant.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-ink">Variante {variant.label}</p>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(variant.label, { isActive: event.target.checked })} />
                Aktiv
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate">Verteilung %</span>
                <input type="number" min={0} max={100} value={variant.weight} onChange={(event) => updateVariant(variant.label, { weight: Number(event.target.value || 0) })} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate">Betreff</span>
                <input value={variant.subject} onChange={(event) => updateVariant(variant.label, { subject: event.target.value })} />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate">Landingpage Override optional</span>
                <input value={variant.landingpageUrl ?? ""} onChange={(event) => updateVariant(variant.label, { landingpageUrl: event.target.value })} placeholder="leer = Lead-Landingpage" />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate">Text</span>
                <textarea rows={9} value={variant.bodyText} onChange={(event) => updateVariant(variant.label, { bodyText: event.target.value })} />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VariantPerformanceTable({ stats }: { stats: CampaignVariantStats[] }) {
  const minimum = 50;
  const eligible = stats.filter((item) => item.sent >= minimum);
  const winner = eligible.length >= 2
    ? eligible.slice().sort((left, right) =>
        (right.clickRate + right.replyRate + right.bookingRate) - (left.clickRate + left.replyRate + left.bookingRate)
      )[0]
    : null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">Varianten-Performance</h3>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-600">
          {winner ? `Variante ${winner.label} performt besser` : "Noch nicht ausreichend Daten"}
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="py-3">Variante</th>
              <th className="py-3">Gesendet</th>
              <th className="py-3">Zugestellt</th>
              <th className="py-3">Open Rate</th>
              <th className="py-3">Click Rate</th>
              <th className="py-3">Landingpage Visit</th>
              <th className="py-3">Reply Rate</th>
              <th className="py-3">Booking Rate</th>
              <th className="py-3">Video Starts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {stats.map((item) => (
              <tr key={item.id}>
                <td className="py-3 font-semibold text-ink">Variante {item.label}</td>
                <td className="py-3">{item.sent}</td>
                <td className="py-3">{item.delivered}</td>
                <td className="py-3">{item.openRate}%</td>
                <td className="py-3">{item.clickRate}%</td>
                <td className="py-3">{item.landingpageVisitRate}%</td>
                <td className="py-3">{item.replyRate}%</td>
                <td className="py-3">{item.bookingRate}%</td>
                <td className="py-3">{item.videoStarted}</td>
              </tr>
            ))}
            {stats.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-5 text-slate-500">Noch keine Varianten vorhanden.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function reviewLabel(status: string) {
  if (status === "approved") return "freigegeben";
  if (status === "needs_review") return "geprüft";
  return "Entwurf";
}
