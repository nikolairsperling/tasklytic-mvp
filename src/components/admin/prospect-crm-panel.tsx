"use client";

import {
  Activity,
  ArrowLeft,
  Bell,
  Briefcase,
  CalendarCheck,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Link as LinkIcon,
  Mail,
  MousePointerClick,
  Pencil,
  Play,
  Save,
  Phone,
  Trash2,
  Video,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, useTransition } from "react";
import { buildTelHref } from "@/lib/calling";
import { calculateFollowUpAt, type FollowUpStatus } from "@/lib/follow-ups";
import { prospectEventLabel } from "@/lib/prospect-events";
import { missingOfferMessage } from "@/lib/user-offer-constants";
import { useCallingSettings } from "@/components/admin/use-calling-settings";

export type ProspectCrmLeadStatus = "open" | "in_progress" | "interested" | "not_interested" | "meeting" | "customer";

export type ProspectCrmPanelData = {
  id: string;
  companyName: string;
  salutation: string | null;
  firstName: string | null;
  lastName: string | null;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  decisionMakerEmail: string | null;
  decisionMakerPhone: string | null;
  decisionMakerSourceUrl?: string | null;
  decisionMakerSourceTextSnippet?: string | null;
  decisionMakerFoundAt?: string | null;
  decisionMakerConfidence?: string | null;
  contactCandidates?: unknown;
  companyEmail: string | null;
  companyPhone: string | null;
  contactPageUrl: string | null;
  generalContactLabel: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  legalName: string | null;
  websiteUrl: string | null;
  city: string;
  postalCode: string | null;
  street: string | null;
  state: string | null;
  country: string;
  employeeRange: string | null;
  employeeCount: number | null;
  vehicleCount: number | null;
  trailerCount: number | null;
  locationsCount: number | null;
  businessFields: string[];
  companyStatus: string;
  icpScore: number;
  icpFitScore: number;
  icpFitLabel: string;
  industry: string | null;
  painScore: number;
  painType: string | null;
  painSummary: string | null;
  painEvidence: unknown;
  hiringSignal: boolean;
  growthSignal: boolean;
  manualProcessSignal: boolean;
  digitalWeaknessSignal: boolean;
  personalizationAngle: string | null;
  researchStatus: string;
  researchSources: unknown;
  researchedAt: string | null;
  websiteOriginal?: string | null;
  websiteVerified?: boolean | null;
  websiteCandidate?: string | null;
  websiteConfidence?: number | null;
  emailOriginal?: string | null;
  emailVerified?: boolean | null;
  emailCandidate?: string | null;
  emailConfidence?: number | null;
  companyMatchConfidence?: number | null;
  companyMatchSource?: string | null;
  lastResearchError?: string | null;
  lastResearchErrorCode?: string | null;
  lastResearchAt?: string | null;
  failedStep?: string | null;
  sourceUrl?: string | null;
  lastAttemptAt?: string | null;
  lastSuccessfulResearchAt?: string | null;
  enrichmentStatus?: string | null;
  enrichmentUpdatedAt?: string | null;
  enrichmentSource?: string | null;
  enrichmentConfidence?: number | null;
  enrichmentNotes?: string | null;
  enrichmentSuggestions?: unknown;
  companyDescription: string | null;
  services: unknown;
  companySizeLabel: string | null;
  employeeCountEstimate: number | null;
  fleetSizeEstimate: number | null;
  specialization: string | null;
  targetCustomers: string | null;
  companyProfileSummary: string | null;
  painSignals: unknown;
  customPainPoint: string | null;
  engagementScore: number;
  engagementLevel: string;
  status: string;
  leadStatus: string;
  followUpAt: string | null;
  followUpReason: string | null;
  followUpStatus: string;
  lastContactedAt: string | null;
  lastEmailSentAt: string | null;
  assignedTo: string | null;
  showInCrm: boolean;
  source: string | null;
  targetGroupId: string | null;
  targetGroup?: { id: string; name: string } | null;
  suggestedOfferId: string | null;
  suggestedOffer?: { id: string; name: string } | null;
  targetGroups?: Array<{ id: string; name: string }>;
  slug: string | null;
  landingpageUrl: string | null;
  landingpageReviewStatus: string;
  personalVideoStatus: string;
  personalVideoUrl: string | null;
  videoUrl: string | null;
  notes: ProspectNoteItem[];
  events: ProspectEventItem[];
  activeCampaign: ActiveCampaign | null;
};

export type ProspectNoteItem = {
  id: string;
  text: string;
  createdAt: string;
};

export type ProspectEventItem = {
  id: string;
  type: string;
  meta: unknown;
  scoreDelta: number;
  createdAt: string;
};

export type ActiveCampaign = {
  id: string;
  enrollmentId: string;
  name: string;
  status: string;
  offerId?: string | null;
  offerName?: string | null;
  targetGroupId?: string | null;
  enrollmentStatus: string;
};

type ProspectCrmPanelProps = {
  prospect: ProspectCrmPanelData;
  previousProspectId?: string | null;
  nextProspectId?: string | null;
  mode?: "page" | "drawer";
  initialTab?: "infos" | "journey" | "links";
  onClose?: () => void;
  onNavigate?: (prospectId: string) => void;
  onSaved?: (prospect: ProspectCrmPanelData) => void;
};

type EditValues = {
  salutation: string;
  firstName: string;
  lastName: string;
  decisionMakerName: string;
  decisionMakerRole: string;
  decisionMakerEmail: string;
  decisionMakerPhone: string;
  companyEmail: string;
  companyPhone: string;
  contactPageUrl: string;
  generalContactLabel: string;
  phone: string;
  linkedinUrl: string;
  companyName: string;
  legalName: string;
  websiteUrl: string;
  city: string;
  postalCode: string;
  street: string;
  state: string;
  country: string;
  employeeRange: string;
  employeeCount: string;
  vehicleCount: string;
  trailerCount: string;
  locationsCount: string;
  businessFields: string;
  companyStatus: string;
  painType: string;
  painSummary: string;
  icpScore: string;
  status: string;
  leadStatus: string;
  notes: string;
};

const leadStatusOptions: Array<{ value: ProspectCrmLeadStatus; label: string }> = [
  { value: "open", label: "Offen" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "interested", label: "Interessiert" },
  { value: "not_interested", label: "Kein Interesse" },
  { value: "meeting", label: "Termin" },
  { value: "customer", label: "Kunde" }
];

export function ProspectCrmPanel({ prospect, previousProspectId, nextProspectId, mode = "page", initialTab = "infos", onClose, onNavigate, onSaved }: ProspectCrmPanelProps) {
  const router = useRouter();
  const callingSettings = useCallingSettings();
  const safeInitialProspect = useMemo(() => normalizeProspectCrmPanelData(prospect), [prospect]);
  const [currentProspect, setCurrentProspect] = useState(safeInitialProspect);
  const [activeTab, setActiveTab] = useState<"infos" | "journey" | "links">(initialTab);
  const [leadStatus, setLeadStatus] = useState(normalizeLeadStatus(currentProspect.leadStatus));
  const [assignedTo, setAssignedTo] = useState(currentProspect.assignedTo ?? "");
  const [source, setSource] = useState(currentProspect.source ?? "");
  const [targetGroupId, setTargetGroupId] = useState(currentProspect.targetGroupId ?? "");
  const [selectedOfferId, setSelectedOfferId] = useState(currentProspect.suggestedOfferId ?? "");
  const [offers, setOffers] = useState<Array<{ id: string; name: string; targetGroupId: string | null; isDefault: boolean }>>([]);
  const [showInCrm, setShowInCrm] = useState(currentProspect.showInCrm);
  const [notes, setNotes] = useState<ProspectNoteItem[]>(() => safeArray(currentProspect.notes));
  const [noteText, setNoteText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [offerStatus, setOfferStatus] = useState<"loading" | "present" | "missing">("loading");
  const [isResearching, setIsResearching] = useState(false);
  const [editValues, setEditValues] = useState<EditValues>(() => getEditValues(currentProspect));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEnrichmentDebug, setShowEnrichmentDebug] = useState(false);
  const [showContactCandidates, setShowContactCandidates] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [followUpAtDraft, setFollowUpAtDraft] = useState(() => toDateTimeLocalValue(currentProspect.followUpAt));
  const [followUpReasonDraft, setFollowUpReasonDraft] = useState(currentProspect.followUpReason ?? "");
  const contactPersonFallback = getContactPersonFallback(currentProspect);
  const reliableContact = getReliableContactDisplay(currentProspect, contactPersonFallback);
  const displayName = reliableContact?.name || currentProspect.companyName;
  const initials = getInitials(displayName);
  const hasLandingpage = Boolean(currentProspect.slug);
  const landingpagePath = currentProspect.slug ? `/p/${currentProspect.slug}` : null;
  const landingpageUrl = hasLandingpage && landingpagePath ? buildAssetUrl(landingpagePath) : null;
  const landingpageOpenUrl = hasLandingpage ? getExternalOrPublicLandingpageUrl(currentProspect.landingpageUrl, landingpagePath) : null;
  const videoUrl = currentProspect.personalVideoUrl || currentProspect.videoUrl;
  const hasVideo = Boolean(videoUrl);
  const publicVideoUrl = videoUrl ? buildAssetUrl(videoUrl) : null;
  const callNumber = currentProspect.phone ?? currentProspect.companyPhone;
  const callHref = buildTelHref(callNumber, callingSettings);
  const painSignal = useMemo(() => getPrimaryPainSignal(currentProspect.painSignals), [currentProspect.painSignals]);
  const contactCandidates = safeArray(getContactCandidates(currentProspect));
  const hasContactPerson = Boolean(reliableContact);

  useEffect(() => {
    const safeProspect = normalizeProspectCrmPanelData(prospect);
    setCurrentProspect(safeProspect);
    setLeadStatus(normalizeLeadStatus(safeProspect.leadStatus));
    setAssignedTo(safeProspect.assignedTo ?? "");
    setSource(safeProspect.source ?? "");
    setTargetGroupId(safeProspect.targetGroupId ?? "");
    setSelectedOfferId(safeProspect.suggestedOfferId ?? "");
    setShowInCrm(safeProspect.showInCrm);
    setNotes(safeArray(safeProspect.notes));
    setEditValues(getEditValues(safeProspect));
    setIsEditing(false);
    setFollowUpAtDraft(toDateTimeLocalValue(safeProspect.followUpAt));
    setFollowUpReasonDraft(safeProspect.followUpReason ?? "");
  }, [prospect]);

  useEffect(() => {
    let cancelled = false;

    async function checkOffer() {
      setOfferStatus("loading");
      try {
        const response = await fetch("/api/offers", { method: "GET", cache: "no-store" });
        const data = await response.json().catch(() => []);
        if (!cancelled) setOfferStatus(response.ok && Array.isArray(data) && data.length > 0 ? "present" : "missing");
      } catch {
        if (!cancelled) setOfferStatus("missing");
      }
    }

    void checkOffer();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadOffers() {
      try {
        const response = await fetch("/api/offers", { method: "GET", cache: "no-store" });
        const data = await response.json().catch(() => []);
        if (!cancelled && response.ok && Array.isArray(data)) {
          setOffers(data.map((offer) => ({
            id: String(offer.id),
            name: String(offer.name ?? "Angebot"),
            targetGroupId: offer.targetGroupId ?? null,
            isDefault: Boolean(offer.isDefault)
          })));
        }
      } catch {
        if (!cancelled) setOffers([]);
      }
    }
    void loadOffers();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveCrmPatch(patch: Record<string, unknown>, successText: string) {
    setMessage(null);
    const response = await fetch(`/api/prospects/${currentProspect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const body = (await response.json().catch(() => null)) as Partial<ProspectCrmPanelData> & { error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? "Änderung konnte nicht gespeichert werden.");
    }
    setMessage({ type: "success", text: successText });
    return body;
  }

  async function saveFollowUpPatch(patch: { followUpAt?: string | null; followUpReason?: string | null; followUpStatus?: FollowUpStatus }, successText: string) {
    setMessage(null);
    const response = await fetch(`/api/prospects/${currentProspect.id}/follow-up`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const body = (await response.json().catch(() => null)) as Partial<ProspectCrmPanelData> & { error?: string } | null;
    if (!response.ok || !body || body.error) {
      throw new Error(body?.error ?? "Wiedervorlage konnte nicht gespeichert werden.");
    }
    const updated = mergeProspectUpdate(currentProspect, body);
    setCurrentProspect(updated);
    setFollowUpAtDraft(toDateTimeLocalValue(updated.followUpAt));
    setFollowUpReasonDraft(updated.followUpReason ?? "");
    setMessage({ type: "success", text: successText });
    onSaved?.(updated);
    return updated;
  }

  async function runRecalculate() {
    if (offerStatus !== "present") {
      throw new Error(missingOfferMessage);
    }
    setMessage({ type: "success", text: "Lead wird neu analysiert..." });
    const response = await fetch(`/api/prospects/${currentProspect.id}/recalculate`, {
      method: "POST"
    });
    const body = (await response.json().catch(() => null)) as Partial<ProspectCrmPanelData> & { error?: string } | null;
    if (!response.ok || !body || body.error) {
      throw new Error(body?.error ?? "Analyse konnte nicht aktualisiert werden.");
    }
    const updated = mergeProspectUpdate(currentProspect, body);
    console.log("TargetGroup", updated.targetGroupId ?? "default");
    console.log("ICP Score", updated.icpFitScore);
    console.log("Pain", updated.painType, updated.painSummary);
    setCurrentProspect(updated);
    setLeadStatus(normalizeLeadStatus(updated.leadStatus));
    setNotes(safeArray(updated.notes));
    setEditValues(getEditValues(updated));
    setMessage({ type: "success", text: "Analyse aktualisiert" });
    onSaved?.(updated);
  }

  async function saveLeadEdit() {
    setMessage(null);
    const payload = buildEditPayload(editValues);
    const response = await fetch(`/api/prospects/${currentProspect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = (await response.json().catch(() => null)) as Partial<ProspectCrmPanelData> & { error?: string } | null;
    if (!response.ok || !body || body.error) {
      throw new Error(body?.error ?? "Lead konnte nicht gespeichert werden.");
    }
    const updated = mergeProspectUpdate(currentProspect, body);
    setCurrentProspect(updated);
    setLeadStatus(normalizeLeadStatus(updated.leadStatus));
    setNotes(safeArray(updated.notes));
    setEditValues(getEditValues(updated));
    setIsEditing(false);
    onSaved?.(updated);
    await runRecalculate();
  }

  async function runResearch() {
    if (offerStatus !== "present") {
      throw new Error(missingOfferMessage);
    }
    setMessage(null);
    setResearchError(null);
    setIsResearching(true);
    setMessage({ type: "success", text: "Website wird analysiert..." });
    try {
      const { prospect: refreshed, updatedFieldCount } = await enrichProspectFromApi(currentProspect);
      const updated = mergeProspectUpdate(currentProspect, refreshed);
      setCurrentProspect(updated);
      setLeadStatus(normalizeLeadStatus(updated.leadStatus));
      setNotes(safeArray(updated.notes));
      setEditValues(getEditValues(updated));
      setMessage({
        type: "success",
        text: updatedFieldCount > 0
          ? `Datenanreicherung abgeschlossen. ${updatedFieldCount} Vorschläge gefunden.`
          : "Analyse abgeschlossen, aber keine neuen Daten gefunden."
      });
      onSaved?.(updated);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Website konnte nicht analysiert werden.";
      setResearchError(text);
      setMessage({ type: "error", text: "Website konnte nicht analysiert werden." });
      throw error;
    } finally {
      setIsResearching(false);
    }
  }

  async function applySuggestions(fields?: string[], overwrite = false) {
    const patch = await updateEnrichmentSuggestions(currentProspect.id, "apply", fields, overwrite);
    const updated = mergeProspectUpdate(currentProspect, patch);
    setCurrentProspect(updated);
    setEditValues(getEditValues(updated));
    setMessage({ type: "success", text: "Vorschläge übernommen." });
    onSaved?.(updated);
  }

  async function rejectSuggestions(fields?: string[]) {
    const patch = await updateEnrichmentSuggestions(currentProspect.id, "reject", fields);
    const updated = mergeProspectUpdate(currentProspect, patch);
    setCurrentProspect(updated);
    setEditValues(getEditValues(updated));
    setMessage({ type: "success", text: "Vorschläge abgelehnt." });
    onSaved?.(updated);
  }

async function applyContactCandidate(candidate: UiContactCandidate) {
    if (!candidate.fullName || !isReliableContactName(candidate.fullName)) {
      throw new Error("Kontaktkandidat ist keine verlässliche Kontaktperson.");
    }
    const [firstName, ...lastParts] = (candidate.fullName ?? "").split(/\s+/);
    const body = await saveCrmPatch({
      firstName: firstName || null,
      lastName: lastParts.join(" ") || null,
      decisionMakerName: candidate.fullName ?? null,
      decisionMakerRole: candidate.role ?? null,
      decisionMakerEmail: candidate.email ?? null,
      decisionMakerPhone: candidate.phone ?? null,
      decisionMakerSourceUrl: candidate.sourceUrl ?? null,
      decisionMakerConfidence: candidate.confidenceLabel ?? null
    }, "Kontaktperson übernommen.");
    if (!body) throw new Error("Kontaktperson konnte nicht übernommen werden.");
    const updated = mergeProspectUpdate(currentProspect, body);
    setCurrentProspect(updated);
    setEditValues(getEditValues(updated));
    onSaved?.(updated);
  }

  function runAction(action: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Aktion fehlgeschlagen" });
      }
    });
  }

  function updateLeadStatus(value: ProspectCrmLeadStatus) {
    setLeadStatus(value);
    runAction(() => saveCrmPatch({ leadStatus: value }, "Status gespeichert."));
  }

  function saveAssignment() {
    const shouldRecalculate = targetGroupId !== (currentProspect.targetGroupId ?? "");
    runAction(async () => {
      await saveCrmPatch({ assignedTo, source, showInCrm, targetGroupId }, "CRM-Zuweisung gespeichert.");
      if (shouldRecalculate) await runRecalculate();
    });
  }

  function updateTargetGroup(value: string) {
    setTargetGroupId(value);
    runAction(async () => {
      await saveCrmPatch({ targetGroupId: value }, "Zielgruppe gespeichert.");
      const updated = normalizeProspectCrmPanelData({ ...currentProspect, targetGroupId: value || null, researchStatus: "not_started" });
      setCurrentProspect(updated);
      onSaved?.(updated);
      await runRecalculate();
    });
  }

  function updateSuggestedOffer(value: string) {
    setSelectedOfferId(value);
    runAction(async () => {
      const body = await saveCrmPatch({ suggestedOfferId: value || null }, "Angebot gespeichert.");
      if (!body) return;
      const updated = mergeProspectUpdate(currentProspect, body);
      setCurrentProspect(updated);
      onSaved?.(updated);
    });
  }

  function campaignFromRecommendation() {
    const offer = offers.find((item) => item.id === selectedOfferId);
    const params = new URLSearchParams();
    if (targetGroupId) params.set("targetGroupId", targetGroupId);
    if (selectedOfferId) params.set("offerId", selectedOfferId);
    if (offer?.name) params.set("name", offer.name);
    router.push(`/admin/campaigns?${params.toString()}`);
  }

  function setFollowUpTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    runAction(() => saveFollowUpPatch({ followUpAt: tomorrow.toISOString(), followUpReason: followUpReasonDraft || "Später erinnern", followUpStatus: "open" }, "Wiedervorlage gesetzt."));
  }

  function markFollowUpDone() {
    runAction(() => saveFollowUpPatch({ followUpStatus: "done" }, "Wiedervorlage erledigt."));
  }

  function snoozeFollowUp() {
    const reminderAt = calculateFollowUpAt(new Date());
    runAction(() => saveFollowUpPatch({ followUpAt: reminderAt.toISOString(), followUpReason: followUpReasonDraft || "Später erinnern", followUpStatus: "snoozed" }, "Wiedervorlage verschoben."));
  }

  function saveFollowUp() {
    runAction(() => saveFollowUpPatch({
      followUpAt: followUpAtDraft ? new Date(followUpAtDraft).toISOString() : null,
      followUpReason: followUpReasonDraft || null,
      followUpStatus: "open"
    }, "Wiedervorlage gespeichert."));
  }

  async function addNote() {
    const response = await fetch(`/api/prospects/${currentProspect.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteText })
    });
    const body = (await response.json().catch(() => null)) as ProspectNoteItem | { error?: string } | null;
    if (!response.ok || !body || !("id" in body)) {
      throw new Error(body && "error" in body ? body.error : "Notiz konnte nicht gespeichert werden.");
    }
    setNotes((current) => [body, ...current]);
    setNoteText("");
    setMessage({ type: "success", text: "Notiz gespeichert." });
  }

  async function deleteProspect() {
    const response = await fetch(`/api/prospects/${currentProspect.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Prospect konnte nicht gelöscht werden.");
    }
    router.push("/admin/prospects");
    router.refresh();
  }

  return (
    <div className={mode === "drawer" ? "space-y-4" : "lead-detail-page space-y-5"}>
      <div className={mode === "drawer" ? "detail-panel-header" : "detail-panel-header detail-panel-header-page"}>
        <div className="mobile-detail-back">
          {mode === "page" ? (
            <Link href="/admin/prospects" className="detail-nav-button">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Zurück
            </Link>
          ) : (
            <button type="button" onClick={onClose} className="detail-nav-button">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Zurück
            </button>
          )}
        </div>
        <div className="mobile-detail-title">Lead</div>
        <div className="detail-panel-actions detail-panel-actions-desktop">
          {mode === "page" ? (
            <Link href="/admin/prospects" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Zurück
            </Link>
          ) : null}
          <NavButton id={previousProspectId} label="Vorheriger" onNavigate={onNavigate} />
          <NavButton id={nextProspectId} label="Nächster" onNavigate={onNavigate} />
        </div>
        {mode === "drawer" ? (
          <button type="button" onClick={onClose} className="detail-close-button rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            Schließen
          </button>
        ) : (
          <Link href="/admin/prospects" className="detail-close-button rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            Schließen
          </Link>
        )}
      </div>
      <div className="mobile-detail-bottom-actions" aria-label="Lead Navigation">
        <NavButton id={previousProspectId} label="Vorheriger" onNavigate={onNavigate} />
        <NavButton id={nextProspectId} label="Nächster" onNavigate={onNavigate} />
      </div>

      <section className="lead-detail-card rounded-2xl bg-white p-5 shadow-panel">
        <div className="lead-detail-header flex flex-wrap items-start justify-between gap-4">
          <div className="lead-detail-info flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-base font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-ink">{displayName}</h1>
              <p className="mt-1 text-sm text-slate-500">{currentProspect.companyName}</p>
            </div>
          </div>
          <div className="lead-actions">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              Engagement {currentProspect.engagementScore}
            </span>
            <select value={leadStatus} onChange={(event) => updateLeadStatus(event.target.value as ProspectCrmLeadStatus)} disabled={isPending} className="w-auto min-w-44 max-w-full">
              {leadStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="button" onClick={setFollowUpTomorrow} disabled={isPending} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium">
              <Bell className="h-4 w-4" aria-hidden="true" />
              Wiedervorlage
            </button>
            {callHref ? (
              <a href={callHref} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Anrufen
              </a>
            ) : (
              <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-300" title="Keine Telefonnummer vorhanden">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Anrufen
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditValues(getEditValues(currentProspect));
                setIsEditing(true);
                setActiveTab("infos");
              }}
              disabled={isEditing || isPending}
              className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Bearbeiten
            </button>
            {currentProspect.linkedinUrl ? (
              <a href={currentProspect.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#0a66c2] px-3 py-2 text-sm font-medium text-white">
                <LinkIcon className="h-4 w-4" aria-hidden="true" />
                LinkedIn
              </a>
            ) : null}
          </div>
        </div>
        {message ? (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {message.text}
          </div>
        ) : null}
      </section>

      <section className="lead-detail-card rounded-2xl bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Aktive Kampagne</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{currentProspect.activeCampaign?.name ?? "Keine aktive Kampagne"}</h2>
            <p className="mt-1 text-sm text-slate-500">{currentProspect.activeCampaign ? `${currentProspect.activeCampaign.status} · ${currentProspect.activeCampaign.enrollmentStatus}` : "Lead ist aktuell keiner aktiven Kampagne zugeordnet."}</p>
            {currentProspect.activeCampaign ? (
              <p className="mt-2 text-sm font-medium text-slate-700">
                Angebot: {currentProspect.activeCampaign.offerName ?? "Bitte Angebot auswählen"}
              </p>
            ) : null}
          </div>
          {currentProspect.activeCampaign ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                Austragen
              </button>
              <Link href={`/admin/campaigns?campaignId=${currentProspect.activeCampaign.id}`} className="btn-primary rounded-xl px-3 py-2 text-sm font-medium">
                Zur Kampagne
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <div className="lead-tabs rounded-2xl bg-white p-2 shadow-panel">
        {[
          ["infos", "Infos"],
          ["journey", "Journey"],
          ["links", "Links"]
        ].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key as typeof activeTab)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "infos" ? (
        <div className={mode === "drawer" ? "space-y-5" : "lead-detail-layout"}>
          <div className="space-y-5">
            <Panel title="Datenanreicherung">
              <div className="space-y-3">
                {offerStatus === "missing" ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                    {missingOfferMessage}
                  </p>
                ) : null}
                <div className="lead-enrichment-status">
                  <div className="text-sm text-slate-600">
                    <WebsiteExternalLink url={currentProspect.websiteUrl} emptyText="Keine Website vorhanden" />
                    <p className="mt-1 text-xs text-slate-500">
                      Status: {formatEnrichmentStatus(currentProspect.enrichmentStatus ?? currentProspect.researchStatus)}
                      {currentProspect.enrichmentUpdatedAt ? ` · ${formatAbsoluteDate(currentProspect.enrichmentUpdatedAt)}` : ""}
                      {typeof currentProspect.enrichmentConfidence === "number" ? ` · Confidence ${currentProspect.enrichmentConfidence}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runAction(runResearch)}
                    disabled={isPending || isResearching || !currentProspect.websiteUrl || offerStatus !== "present"}
                    className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <Activity className="h-4 w-4" aria-hidden="true" />
                    {isResearching ? "Website wird analysiert..." : "Daten anreichern"}
                  </button>
                </div>
                <EnrichmentSuggestionsView
                  prospect={currentProspect}
                  onApply={(fields, overwrite) => runAction(() => applySuggestions(fields, overwrite))}
                  onReject={(fields) => runAction(() => rejectSuggestions(fields))}
                />
                <button
                  type="button"
                  onClick={() => setShowEnrichmentDebug((value) => !value)}
                  className="btn-secondary inline-flex rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  {showEnrichmentDebug ? "Debug ausblenden" : "Debug anzeigen"}
                </button>
                {showEnrichmentDebug ? <EnrichmentDebugView value={currentProspect.researchSources} /> : null}
              </div>
            </Panel>
            <Panel title="Empfehlung">
              <div className="space-y-4">
                <InfoGrid emptyText="Nicht gefunden" items={[
                  ["Zielgruppe", currentProspect.targetGroup?.name ?? (targetGroupId ? safeArray(currentProspect.targetGroups).find((group) => group.id === targetGroupId)?.name : "Spedition")],
                  ["passendes Angebot", offers.find((offer) => offer.id === selectedOfferId)?.name ?? currentProspect.activeCampaign?.offerName ?? currentProspect.suggestedOffer?.name ?? "Bitte Angebot auswählen"],
                  ["ICP Score", String(currentProspect.icpFitScore ?? currentProspect.icpScore ?? 0)],
                  ["Schmerzpunkt-Hypothese", currentProspect.painSummary ?? currentProspect.painType],
                  ["Kampagnenvorschlag", currentProspect.activeCampaign?.name ?? "Neue Kampagne aus Empfehlung"]
                ]} />
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">Angebot auswählen</span>
                  <select value={selectedOfferId} onChange={(event) => updateSuggestedOffer(event.target.value)}>
                    <option value="">Bitte Angebot auswählen</option>
                    {offers.map((offer) => (
                      <option key={offer.id} value={offer.id}>{offer.name}{offer.isDefault ? " (Default)" : ""}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => runAction(runRecalculate)} disabled={isPending} className="btn-secondary rounded-xl px-4 py-2 text-sm font-semibold">
                    Mit diesem Angebot analysieren
                  </button>
                  <button type="button" onClick={campaignFromRecommendation} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
                    Kampagne daraus erstellen
                  </button>
                </div>
              </div>
            </Panel>
            {isEditing ? (
              <Panel title="Lead bearbeiten">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <EditInput label="Anrede" field="salutation" values={editValues} onChange={setEditValues} />
                    <EditInput label="Vorname" field="firstName" values={editValues} onChange={setEditValues} />
                    <EditInput label="Nachname" field="lastName" values={editValues} onChange={setEditValues} />
                    <EditInput label="Entscheider Name" field="decisionMakerName" values={editValues} onChange={setEditValues} />
                    <EditInput label="Rolle" field="decisionMakerRole" values={editValues} onChange={setEditValues} />
                    <EditInput label="persönliche E-Mail" field="decisionMakerEmail" type="email" values={editValues} onChange={setEditValues} />
                    <EditInput label="persönliche Telefonnummer" field="decisionMakerPhone" values={editValues} onChange={setEditValues} />
                    <EditInput label="LinkedIn URL" field="linkedinUrl" values={editValues} onChange={setEditValues} />
                    <EditInput label="allgemeine E-Mail" field="companyEmail" type="email" values={editValues} onChange={setEditValues} />
                    <EditInput label="allgemeine Telefonnummer" field="companyPhone" values={editValues} onChange={setEditValues} />
                    <EditInput label="Kontaktseite" field="contactPageUrl" values={editValues} onChange={setEditValues} />
                    <EditInput label="Kontakt-Label" field="generalContactLabel" values={editValues} onChange={setEditValues} />
                    <EditInput label="Firmenname" field="companyName" values={editValues} onChange={setEditValues} />
                    <EditInput label="rechtlicher Name" field="legalName" values={editValues} onChange={setEditValues} />
                    <EditInput label="Website" field="websiteUrl" values={editValues} onChange={setEditValues} />
                    <EditInput label="Stadt" field="city" values={editValues} onChange={setEditValues} />
                    <EditInput label="PLZ" field="postalCode" values={editValues} onChange={setEditValues} />
                    <EditInput label="Straße" field="street" values={editValues} onChange={setEditValues} />
                    <EditInput label="Bundesland" field="state" values={editValues} onChange={setEditValues} />
                    <EditInput label="Land" field="country" values={editValues} onChange={setEditValues} />
                    <EditInput label="Mitarbeiterzahl" field="employeeCount" type="number" values={editValues} onChange={setEditValues} />
                    <EditInput label="Fahrzeuge" field="vehicleCount" type="number" values={editValues} onChange={setEditValues} />
                    <EditInput label="Trailer" field="trailerCount" type="number" values={editValues} onChange={setEditValues} />
                    <EditInput label="Standorte" field="locationsCount" type="number" values={editValues} onChange={setEditValues} />
                    <EditInput label="Business Fields" field="businessFields" values={editValues} onChange={setEditValues} />
                    <EditSelect label="Firmenstatus" field="companyStatus" values={editValues} onChange={setEditValues} options={[
                      ["active", "Aktiv"],
                      ["inactive", "Inaktiv"],
                      ["unclear", "Unklar"],
                      ["unreachable", "Nicht erreichbar"]
                    ]} />
                    <EditInput label="Pain Type" field="painType" values={editValues} onChange={setEditValues} />
                    <EditInput label="ICP Score optional" field="icpScore" type="number" values={editValues} onChange={setEditValues} />
                  </div>
                  <EditTextarea label="Pain Summary" field="painSummary" values={editValues} onChange={setEditValues} />
                  <EditTextarea label="Notizen" field="notes" values={editValues} onChange={setEditValues} />
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditValues(getEditValues(currentProspect));
                        setIsEditing(false);
                        setMessage(null);
                      }}
                      disabled={isPending}
                      className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Abbrechen
                    </button>
                    <button type="button" onClick={() => runAction(saveLeadEdit)} disabled={isPending} className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Speichern
                    </button>
                  </div>
                </div>
              </Panel>
            ) : null}
            <Panel title="Kontaktperson">
              {hasContactPerson && reliableContact ? (
                <div className="space-y-4">
                  <InfoGrid emptyText="Nicht gefunden" items={[
                    ["Name", reliableContact.name],
                    ["Rolle", reliableContact.role],
                    ["E-Mail", reliableContact.email],
                    ["Telefonnummer", reliableContact.phone],
                    ["Quelle", reliableContact.sourceUrl]
                  ]} />
                  {reliableContact.sourceUrl ? (
                    <a href={reliableContact.sourceUrl} target="_blank" rel="noreferrer" className="btn-secondary inline-flex rounded-xl px-3 py-2 text-sm font-semibold">
                      Quelle öffnen
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Keine verlässliche Kontaktperson gefunden</p>
                </div>
              )}
              {contactCandidates.length > 0 ? (
                <button type="button" onClick={() => setShowContactCandidates((value) => !value)} className="btn-secondary mt-4 inline-flex rounded-xl px-3 py-2 text-sm font-semibold">
                  {showContactCandidates ? "Kontaktkandidaten ausblenden" : "Kontaktkandidaten prüfen"}
                </button>
              ) : null}
              {showContactCandidates && contactCandidates.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-ink">Gefundene Kontaktkandidaten</h3>
                  {contactCandidates.map((candidate, index) => (
                    <div key={`${candidate.fullName}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-ink">{candidate.fullName}</p>
                      <p className="text-slate-600">{[candidate.role, candidate.email, candidate.phone].filter(Boolean).join(" · ")}</p>
                      <p className="mt-1 text-xs text-slate-500">{[formatContactConfidence(candidate.confidenceLabel), candidate.sourceArea ? formatSourceArea(candidate.sourceArea) : null, candidate.sourceUrl].filter(Boolean).join(" · ")}</p>
                      <button type="button" onClick={() => runAction(() => applyContactCandidate(candidate))} className="btn-primary mt-2 rounded-xl px-3 py-2 text-xs font-semibold">
                        Als Hauptkontakt übernehmen
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
            <Panel title="Firmenkontakt">
              <InfoGrid emptyText="Nicht gefunden" items={[
                ["allgemeine E-Mail", currentProspect.companyEmail],
                ["allgemeine Telefonnummer", currentProspect.companyPhone ?? currentProspect.phone],
                ["Kontaktseite", currentProspect.contactPageUrl],
                ["Website", currentProspect.websiteUrl]
              ]} />
            </Panel>
            <Panel title="Unternehmen">
              <InfoGrid items={[
                ["Firma", currentProspect.companyName],
                ["rechtlicher Name", currentProspect.legalName],
                ["Website", currentProspect.websiteUrl],
                ["Stadt", currentProspect.city],
                ["PLZ", currentProspect.postalCode],
                ["Straße", currentProspect.street],
                ["Bundesland", currentProspect.state],
                ["Land", currentProspect.country],
                ["Mitarbeiterzahl", currentProspect.employeeRange ?? (currentProspect.employeeCount ? String(currentProspect.employeeCount) : null)],
                ["Fahrzeuge", currentProspect.vehicleCount ? String(currentProspect.vehicleCount) : null],
                ["Trailer", currentProspect.trailerCount ? String(currentProspect.trailerCount) : null],
                ["Standorte", currentProspect.locationsCount ? String(currentProspect.locationsCount) : null],
                ["Business Fields", safeArray(currentProspect.businessFields).join(", ")],
                ["Firmenstatus", currentProspect.companyStatus],
                ["ICP Score", String(currentProspect.icpScore)],
                ["Pain Type", painSignal.type],
                ["Pain Summary", currentProspect.customPainPoint ?? painSignal.label ?? (currentProspect.painScore > 0 ? "Pain-Signale erkannt." : null)]
              ]} />
            </Panel>
            <Panel title="Firmenprofil">
              <InfoGrid emptyText="Nicht gefunden" items={[
                ["Was macht die Firma?", currentProspect.companyDescription],
                ["Branche", currentProspect.industry],
                ["Leistungen", formatList(currentProspect.services)],
                ["Größe", formatCompanySize(currentProspect.companySizeLabel)],
                ["Mitarbeiter geschätzt", currentProspect.employeeCountEstimate ? String(currentProspect.employeeCountEstimate) : null],
                ["Fahrzeuge geschätzt", currentProspect.fleetSizeEstimate ? String(currentProspect.fleetSizeEstimate) : null],
                ["Standorte", currentProspect.locationsCount ? String(currentProspect.locationsCount) : null],
                ["Spezialisierung", currentProspect.specialization]
              ]} />
            </Panel>
            <Panel title="ICP & Schmerzpunkt">
              <div className="space-y-4">
                <InfoGrid emptyText="Nicht gefunden" items={[
                  ["ICP Score", String(currentProspect.icpFitScore ?? currentProspect.icpScore ?? 0)],
                  ["ICP Label", formatIcpLabel(currentProspect.icpFitLabel)],
                  ["Pain Score", String(currentProspect.painScore ?? 0)],
                  ["Signal erkannt", currentProspect.hiringSignal ? "Personalbedarf erkannt" : null],
                  ["Schmerzpunkt-Hypothese", currentProspect.painType],
                  ["Hypothese-Zusammenfassung", currentProspect.painSummary],
                  ["Begründung / Hinweise", formatEvidence(currentProspect.painEvidence)],
                  ["Quellen", formatSources(currentProspect.researchSources)],
                  ["Research Status", formatResearchStatus(currentProspect.researchStatus)],
                  ["Letzter Versuch", currentProspect.lastResearchAt ? formatAbsoluteDate(currentProspect.lastResearchAt) : null],
                  ["Letzte erfolgreiche Analyse", currentProspect.lastSuccessfulResearchAt || currentProspect.researchedAt ? formatAbsoluteDate((currentProspect.lastSuccessfulResearchAt ?? currentProspect.researchedAt) as string) : null],
                  ["Letzter Fehler", currentProspect.lastResearchError],
                  ["Fehlercode", currentProspect.lastResearchErrorCode],
                  ["Fehlgeschlagener Schritt", currentProspect.failedStep],
                  ["Quelle", currentProspect.sourceUrl],
                  ["Letzter Analyseversuch", currentProspect.lastAttemptAt ? formatAbsoluteDate(currentProspect.lastAttemptAt) : null]
                ]} />
                <ResearchSourcesView value={currentProspect.researchSources} />
                {researchError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{researchError}</div>
                ) : null}
                {!currentProspect.websiteUrl ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Keine Website vorhanden</p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => runAction(runRecalculate)}
                    disabled={isPending}
                    className="btn-secondary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Neu analysieren
                  </button>
                </div>
              </div>
            </Panel>
          </div>
          <div className="space-y-5">
            <Panel title="Zuweisung & CRM">
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">Zugewiesen an</span>
                  <input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={showInCrm} onChange={(event) => setShowInCrm(event.target.checked)} className="h-4 w-4" />
                  Im CRM anzeigen
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">Liste/Segment</span>
                  <input value={currentProspect.engagementLevel} readOnly />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">Quelle</span>
                  <input value={source} onChange={(event) => setSource(event.target.value)} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">Zielgruppe</span>
                  <select value={targetGroupId} onChange={(event) => updateTargetGroup(event.target.value)}>
                    <option value="">Spedition (Standard)</option>
                    {(currentProspect.targetGroups ?? []).map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={saveAssignment} disabled={isPending} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
                  Speichern
                </button>
              </div>
            </Panel>
            <Panel title="Wiedervorlage">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoGrid emptyText="Nicht gesetzt" items={[
                    ["Status", currentProspect.followUpStatus],
                    ["Letzte E-Mail", currentProspect.lastEmailSentAt ? formatAbsoluteDate(currentProspect.lastEmailSentAt) : null],
                    ["Fällig", currentProspect.followUpAt ? formatAbsoluteDate(currentProspect.followUpAt) : null],
                    ["Grund", currentProspect.followUpReason]
                  ]} />
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">Datum / Uhrzeit</span>
                  <input
                    type="datetime-local"
                    value={followUpAtDraft}
                    onChange={(event) => setFollowUpAtDraft(event.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">Grund</span>
                  <textarea
                    rows={3}
                    value={followUpReasonDraft}
                    onChange={(event) => setFollowUpReasonDraft(event.target.value)}
                    placeholder="Warum soll der Lead wieder vorgelegt werden?"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={saveFollowUp} disabled={isPending} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
                    Wiedervorlage setzen
                  </button>
                  <button type="button" onClick={markFollowUpDone} disabled={isPending} className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium">
                    Erledigt
                  </button>
                  <button type="button" onClick={snoozeFollowUp} disabled={isPending} className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium">
                    Später erinnern
                  </button>
                  {callHref ? (
                    <a href={callHref} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      Anrufen
                    </a>
                  ) : (
                    <button type="button" disabled title="Keine Telefonnummer vorhanden" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-300">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      Anrufen
                    </button>
                  )}
                </div>
              </div>
            </Panel>
            <Panel title="Notizen">
              <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={4} placeholder="Notiz erfassen..." />
              <button type="button" onClick={() => runAction(addNote)} disabled={isPending || !noteText.trim()} className="btn-primary mt-3 rounded-xl px-4 py-2 text-sm font-semibold">
                Notiz speichern
              </button>
              <div className="mt-4 space-y-3">
                {notes.length === 0 ? <p className="text-sm text-slate-500">Noch keine Notizen gespeichert.</p> : notes.map((note) => (
                  <div key={note.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{note.text}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatAbsoluteDate(note.createdAt)}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {activeTab === "journey" ? (
        <Panel title="Journey">
          {safeArray(currentProspect.events).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Noch keine Activity Events vorhanden.
            </div>
          ) : (
            <div className="space-y-3">
              {safeArray(currentProspect.events).map((event) => (
                <div key={event.id} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                    <EventIcon type={event.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-ink">{prospectEventLabel(event.type)}</p>
                        <p className="mt-1 text-sm text-slate-500">{eventDescription(event)}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {event.scoreDelta >= 0 ? "+" : ""}{event.scoreDelta}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{formatRelativeDate(event.createdAt)} · {formatAbsoluteDate(event.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {activeTab === "links" ? (
        <div className="space-y-5">
          <Panel title="Personalisierte Assets">
            <div className="grid gap-4 lg:grid-cols-2">
              <AssetCard
                title="Personalisierte Landingpage"
                status={hasLandingpage ? `erstellt · ${currentProspect.landingpageReviewStatus}` : "Landingpage noch nicht generiert"}
                url={landingpageUrl}
                openHref={landingpageOpenUrl}
                previewHref={landingpageUrl}
                disabledText="Landingpage noch nicht generiert"
              />
              <AssetCard
                title="Personalisiertes Video"
                status={hasVideo ? currentProspect.personalVideoStatus : "Video noch nicht erstellt"}
                url={publicVideoUrl}
                previewHref={publicVideoUrl}
                createHref={`/admin/impact/videos?prospectId=${currentProspect.id}`}
                disabledText="Video noch nicht erstellt"
              />
              <AssetCard title="Brief / sonstige Assets" status="vorbereitet" url={null} />
            </div>
          </Panel>
          <Panel title="Gefahrenzone">
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                Personalisierung löschen
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Prospect löschen
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-prospect-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="delete-prospect-title" className="text-lg font-semibold text-ink">Prospect löschen?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Dieser Prospect wird dauerhaft gelöscht. Diese Aktion ist nicht rückgängig zu machen.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Abbrechen</button>
              <button type="button" onClick={() => runAction(deleteProspect)} disabled={isPending} className="btn-danger rounded-xl px-4 py-2 text-sm font-semibold">Endgültig löschen</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavButton({ id, label, onNavigate }: { id?: string | null; label: string; onNavigate?: (prospectId: string) => void }) {
  if (!id) {
    return <span className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-300">{label}</span>;
  }
  if (onNavigate) {
    return <button type="button" onClick={() => onNavigate(id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">{label}</button>;
  }
  return <Link href={`/admin/prospects/${id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">{label}</Link>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="lead-detail-card rounded-2xl bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoGrid({ items, emptyText = "k. A." }: { items: Array<[string, string | null | undefined]>; emptyText?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
          {label.toLowerCase() === "website" ? (
            <WebsiteExternalLink url={value} emptyText={emptyText} />
          ) : (
            <p className="mt-1 break-words text-sm font-medium text-ink">{value || emptyText}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function WebsiteExternalLink({ url, emptyText = "k. A." }: { url: string | null | undefined; emptyText?: string }) {
  const href = normalizeExternalWebsiteHref(url);
  if (!url) return <p className="mt-1 break-words text-sm font-medium text-ink">{emptyText}</p>;
  if (!href) return <p className="mt-1 break-words text-sm font-medium text-red-700">Website ungültig</p>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99]"
    >
      <span className="min-w-0 break-all">{url}</span>
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">Website öffnen</span>
    </a>
  );
}

function normalizeExternalWebsiteHref(value: string | null | undefined) {
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

function EditInput({
  label,
  field,
  values,
  onChange,
  type = "text"
}: {
  label: string;
  field: keyof EditValues;
  values: EditValues;
  onChange: React.Dispatch<React.SetStateAction<EditValues>>;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input type={type} value={values[field]} onChange={(event) => onChange((current) => ({ ...current, [field]: event.target.value }))} />
    </label>
  );
}

function EditTextarea({
  label,
  field,
  values,
  onChange
}: {
  label: string;
  field: keyof EditValues;
  values: EditValues;
  onChange: React.Dispatch<React.SetStateAction<EditValues>>;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <textarea value={values[field]} onChange={(event) => onChange((current) => ({ ...current, [field]: event.target.value }))} rows={4} />
    </label>
  );
}

function EditSelect({
  label,
  field,
  values,
  onChange,
  options
}: {
  label: string;
  field: keyof EditValues;
  values: EditValues;
  onChange: React.Dispatch<React.SetStateAction<EditValues>>;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <select value={values[field]} onChange={(event) => onChange((current) => ({ ...current, [field]: event.target.value }))}>
        {options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
      </select>
    </label>
  );
}

function getEditValues(prospect: ProspectCrmPanelData): EditValues {
  const painSignal = getPrimaryPainSignal(prospect.painSignals);
  return {
    salutation: prospect.salutation ?? "",
    firstName: prospect.firstName ?? "",
    lastName: prospect.lastName ?? "",
    decisionMakerName: prospect.decisionMakerName ?? "",
    decisionMakerRole: prospect.decisionMakerRole ?? "",
    decisionMakerEmail: prospect.decisionMakerEmail ?? "",
    decisionMakerPhone: prospect.decisionMakerPhone ?? "",
    companyEmail: prospect.companyEmail ?? "",
    companyPhone: prospect.companyPhone ?? prospect.phone ?? "",
    contactPageUrl: prospect.contactPageUrl ?? "",
    generalContactLabel: prospect.generalContactLabel ?? "",
    phone: prospect.phone ?? "",
    linkedinUrl: prospect.linkedinUrl ?? "",
    companyName: prospect.companyName,
    legalName: prospect.legalName ?? "",
    websiteUrl: prospect.websiteUrl ?? "",
    city: prospect.city,
    postalCode: prospect.postalCode ?? "",
    street: prospect.street ?? "",
    state: prospect.state ?? "",
    country: prospect.country,
    employeeRange: prospect.employeeRange ?? "",
    employeeCount: prospect.employeeCount === null ? "" : String(prospect.employeeCount),
    vehicleCount: prospect.vehicleCount === null ? "" : String(prospect.vehicleCount),
    trailerCount: prospect.trailerCount === null ? "" : String(prospect.trailerCount),
    locationsCount: prospect.locationsCount === null ? "" : String(prospect.locationsCount),
    businessFields: safeArray(prospect.businessFields).join(", "),
    companyStatus: prospect.companyStatus,
    painType: prospect.painType ?? painSignal.type ?? "",
    painSummary: prospect.painSummary ?? prospect.customPainPoint ?? painSignal.label ?? "",
    icpScore: String(prospect.icpScore),
    status: prospect.status,
    leadStatus: normalizeLeadStatus(prospect.leadStatus),
    notes: ""
  };
}

function buildEditPayload(values: EditValues) {
  const payload: Record<string, unknown> = {
    salutation: values.salutation,
    firstName: values.firstName,
    lastName: values.lastName,
    decisionMakerName: values.decisionMakerName,
    decisionMakerRole: values.decisionMakerRole,
    decisionMakerEmail: values.decisionMakerEmail,
    decisionMakerPhone: values.decisionMakerPhone,
    companyEmail: values.companyEmail,
    companyPhone: values.companyPhone,
    contactPageUrl: values.contactPageUrl,
    generalContactLabel: values.generalContactLabel,
    phone: values.companyPhone || values.phone,
    linkedinUrl: values.linkedinUrl,
    companyName: values.companyName,
    legalName: values.legalName,
    websiteUrl: values.websiteUrl,
    city: values.city,
    postalCode: values.postalCode,
    street: values.street,
    state: values.state,
    country: values.country,
    employeeRange: values.employeeRange,
    employeeCount: values.employeeCount,
    vehicleCount: values.vehicleCount,
    trailerCount: values.trailerCount,
    locationsCount: values.locationsCount,
    businessFields: values.businessFields,
    companyStatus: values.companyStatus,
    painType: values.painType,
    painSummary: values.painSummary,
    icpScore: values.icpScore
  };
  if (values.notes.trim()) {
    payload.notes = values.notes;
  }
  return payload;
}

function mergeProspectUpdate(current: ProspectCrmPanelData, patch: Partial<ProspectCrmPanelData>): ProspectCrmPanelData {
  return normalizeProspectCrmPanelData({
    ...current,
    ...patch,
    legalName: patch.legalName ?? current.legalName,
    state: patch.state ?? current.state,
    country: patch.country ?? current.country,
    businessFields: patch.businessFields ?? current.businessFields,
    notes: patch.notes ?? current.notes,
    events: patch.events ?? current.events,
    activeCampaign: patch.activeCampaign ?? current.activeCampaign,
    targetGroups: patch.targetGroups ?? current.targetGroups
  });
}

function normalizeProspectCrmPanelData(prospect: ProspectCrmPanelData): ProspectCrmPanelData {
  return {
    ...prospect,
    businessFields: safeArray(prospect.businessFields),
    notes: safeArray(prospect.notes),
    events: safeArray(prospect.events),
    targetGroups: safeArray(prospect.targetGroups),
    contactCandidates: Array.isArray(prospect.contactCandidates) ? prospect.contactCandidates : []
  };
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export async function enrichProspectFromApi(current: ProspectCrmPanelData, fetcher: typeof fetch = fetch) {
  const researchResponse = await fetcher(`/api/prospects/${current.id}/enrich`, { method: "POST" });
  const researchBody = (await researchResponse.json().catch(() => null)) as ({ error?: string; suggestions?: Record<string, unknown> }) | null;
  if (!researchResponse.ok || !researchBody || researchBody.error) {
    throw new Error(researchBody?.error ?? "Website konnte nicht analysiert werden.");
  }

  const detailResponse = await fetcher(`/api/prospects/${current.id}`);
  const detailBody = (await detailResponse.json().catch(() => null)) as (Partial<ProspectCrmPanelData> & { error?: string }) | null;
  if (!detailResponse.ok || !detailBody || detailBody.error) {
    throw new Error(detailBody?.error ?? "Lead konnte nach der Analyse nicht neu geladen werden.");
  }

  return {
    prospect: mergeProspectUpdate(current, detailBody),
    updatedFieldCount: Object.keys(researchBody.suggestions ?? {}).length
  };
}

async function updateEnrichmentSuggestions(prospectId: string, action: "apply" | "reject", fields?: string[], overwrite = false) {
  const response = await fetch(`/api/prospects/${prospectId}/enrichment-suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, fields, overwrite, minConfidence: fields?.length ? 0 : 80 })
  });
  const body = await response.json().catch(() => null) as { prospect?: Partial<ProspectCrmPanelData>; error?: string } | null;
  if (!response.ok || body?.error) throw new Error(body?.error ?? "Vorschläge konnten nicht verarbeitet werden.");
  return body?.prospect ?? {};
}

function EnrichmentSuggestionsView({
  prospect,
  onApply,
  onReject
}: {
  prospect: ProspectCrmPanelData;
  onApply: (fields?: string[], overwrite?: boolean) => void;
  onReject: (fields?: string[]) => void;
}) {
  const suggestions = parseSuggestionEntries(prospect.enrichmentSuggestions);
  if (suggestions.length === 0) {
    return <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Keine offenen Vorschläge.</p>;
  }
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">Vorschläge prüfen</p>
        <button type="button" onClick={() => onApply(undefined, false)} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">Alle sicheren Werte übernehmen</button>
      </div>
      {suggestions.map(({ field, suggestion }) => (
        <div key={field} className="rounded-xl bg-white p-3 text-sm shadow-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-400">Aktueller Wert</p>
              <p className="mt-1 text-slate-700">{formatSuggestionValue((prospect as unknown as Record<string, unknown>)[field]) || "leer"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Neuer Vorschlag</p>
              <p className="mt-1 font-medium text-slate-900">{formatSuggestionValue(suggestion.value)}</p>
              <p className="mt-1 text-xs text-slate-500">Quelle {suggestion.source} · Confidence {suggestion.confidence}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onApply([field], true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Übernehmen</button>
            <button type="button" onClick={() => onReject([field])} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Ablehnen</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResearchSourcesView({ value }: { value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as { pages?: unknown; fields?: unknown };
  const pages = Array.isArray(data.pages) ? data.pages.slice(0, 12) as Array<{ url?: unknown; title?: unknown }> : [];
  const fields = data.fields && typeof data.fields === "object"
    ? Object.entries(data.fields as Record<string, { sourceUrl?: unknown; extractedTextSnippet?: unknown; confidence?: unknown }>)
        .filter(([, source]) => source?.sourceUrl)
        .slice(0, 10)
    : [];
  if (pages.length === 0 && fields.length === 0) return null;
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-700">Quellenbereich</p>
      {pages.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs uppercase text-slate-400">Gefundene Seiten</p>
          <div className="space-y-1">
            {pages.map((page, index) => (
              <p key={`${String(page.url)}-${index}`} className="break-words text-xs text-slate-600">
                {String(page.title || page.url || "Website-Seite")}
              </p>
            ))}
          </div>
        </div>
      ) : null}
      {fields.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-400">Feldquellen</p>
          {fields.map(([field, source]) => {
            const confidence = typeof source.confidence === "number" ? source.confidence : Number(source.confidence ?? 0);
            return (
              <div key={field} className="rounded-xl bg-white p-2 text-xs text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">{field}</span>
                  <span className={confidence < 0.7 ? "text-amber-700" : "text-emerald-700"}>
                    {confidence < 0.7 ? "Unsicher" : "Sicher"} · {Math.round(confidence * 100)}%
                  </span>
                </div>
                <p className="mt-1 break-words">{String(source.sourceUrl)}</p>
                {source.extractedTextSnippet ? <p className="mt-1 text-slate-500">{String(source.extractedTextSnippet)}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function getContactPersonFallback(prospect: ProspectCrmPanelData) {
  const fromDirect = readContactPersonLike((prospect as unknown as { contactPerson?: unknown }).contactPerson);
  if (fromDirect.fullName) return fromDirect;
  const fromResearchResult = readContactPersonLike((prospect as unknown as { researchResult?: { contactPerson?: unknown } }).researchResult?.contactPerson);
  if (fromResearchResult.fullName) return fromResearchResult;
  const sources = prospect.researchSources;
  if (sources && typeof sources === "object" && !Array.isArray(sources)) {
    const contactSource = (sources as { fields?: Record<string, unknown> }).fields?.contactPerson;
    if (contactSource && typeof contactSource === "object") {
      const source = contactSource as { sourceUrl?: unknown; extractedTextSnippet?: unknown };
      const parsed = readContactPersonLike(source.extractedTextSnippet);
      return { ...parsed, sourceUrl: typeof source.sourceUrl === "string" ? source.sourceUrl : parsed.sourceUrl };
    }
  }
  return {};
}

function getReliableContactDisplay(prospect: ProspectCrmPanelData, fallback: ReturnType<typeof getContactPersonFallback>) {
  const derivedName = [prospect.firstName ?? fallback.firstName, prospect.lastName ?? fallback.lastName].filter(Boolean).join(" ");
  const name = prospect.decisionMakerName ?? fallback.fullName ?? (derivedName || null);
  const role = prospect.decisionMakerRole ?? fallback.role ?? null;
  const email = prospect.decisionMakerEmail ?? fallback.email ?? null;
  const phone = prospect.decisionMakerPhone ?? fallback.phone ?? null;
  const sourceUrl = prospect.decisionMakerSourceUrl ?? fallback.sourceUrl ?? null;
  if (!name || !isReliableContactName(name)) return null;
  const hasFirstLast = name.trim().split(/\s+/).length >= 2;
  const hasRole = Boolean(role?.trim());
  const hasPersonalEmail = Boolean(email && !/^(info|kontakt|contact|office|service|zentrale|verwaltung|disposition|bewerbung|jobs|karriere|sales|vertrieb)@/i.test(email));
  if (!hasFirstLast && !hasRole && !hasPersonalEmail) return null;
  return { name, role, email, phone, sourceUrl };
}

function isReliableContactName(value: string) {
  const normalized = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const invalidTerms = [
    "datenschutz",
    "datenschutzerklarung",
    "impressum",
    "kontakt",
    "zum inhalt",
    "amtsgericht",
    "handelsregister",
    "umsatzsteuer",
    "cookie",
    "privacy",
    "legal",
    "telefon",
    "e-mail",
    "email",
    "vertrieb",
    "bewerbung",
    "info"
  ];
  if (invalidTerms.some((term) => normalized.includes(term))) return false;
  const parts = value.trim().split(/\s+/);
  return parts.length >= 2 && parts.length <= 3 && parts.every((part) => /^[A-ZÄÖÜ][a-zäöüß-]{1,}$/.test(part));
}

type UiContactCandidate = {
  fullName?: string;
  role?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  sourceArea?: string;
  score?: number;
  selectedAsPrimary?: boolean;
  confidenceLabel?: string;
};

function EnrichmentDebugView({ value }: { value: unknown }) {
  const debug = readEnrichmentDebug(value);
  if (!debug) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-ink">Enrichment Debug</h3>
      <div className="mt-3 grid gap-3 text-xs text-slate-600">
        <DebugBlock title="Gecrawlte URLs" values={debug.urls} />
        <DebugBlock title="Gefundene E-Mails" values={debug.emails} />
        <DebugBlock title="Gefundene Telefonnummern" values={debug.phones} />
        <DebugBlock title="Fehler je URL" values={debug.errors} />
        <DebugBlock title="Gespeicherte Felder" values={debug.savedFields} />
      </div>
    </div>
  );
}

function DebugBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <p className="font-semibold text-ink">{title}</p>
      {values.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {values.slice(0, 12).map((value, index) => <li key={`${title}-${index}`}>{value}</li>)}
        </ul>
      ) : (
        <p className="mt-1">Keine Einträge</p>
      )}
    </div>
  );
}

function getContactCandidates(prospect: ProspectCrmPanelData): UiContactCandidate[] {
  const fromField = readContactCandidates(prospect.contactCandidates);
  if (fromField.length > 0) return fromField;
  const sources = prospect.researchSources;
  if (sources && typeof sources === "object" && !Array.isArray(sources)) {
    return readContactCandidates((sources as { contactCandidates?: unknown }).contactCandidates);
  }
  return [];
}

function readEnrichmentDebug(value: unknown): { urls: string[]; emails: string[]; phones: string[]; errors: string[]; savedFields: string[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const debug = (value as { enrichmentDebug?: unknown }).enrichmentDebug;
  if (!debug || typeof debug !== "object" || Array.isArray(debug)) return null;
  const steps = (debug as { steps?: Record<string, unknown> }).steps;
  if (!steps) return null;
  const crawl = steps.crawl as { urls?: unknown; errors?: unknown } | undefined;
  const raw = steps.rawExtraction as { emails?: unknown; phones?: unknown } | undefined;
  const persistence = steps.persistence as { savedFields?: unknown } | undefined;
  return {
    urls: arrayToStrings(crawl?.urls),
    emails: arrayToStrings(raw?.emails),
    phones: arrayToStrings(raw?.phones),
    errors: Array.isArray(crawl?.errors) ? crawl.errors.map((entry) => typeof entry === "object" && entry ? `${String((entry as { url?: unknown }).url ?? "")}: ${String((entry as { error?: unknown }).error ?? "")}` : String(entry)) : [],
    savedFields: persistence?.savedFields && typeof persistence.savedFields === "object" && !Array.isArray(persistence.savedFields) ? Object.keys(persistence.savedFields) : []
  };
}

function arrayToStrings(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

function readContactCandidates(value: unknown): UiContactCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readContactPersonLike(entry))
    .filter((entry) => entry.fullName);
}

function normalizeContactName(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? "";
}

function formatContactConfidence(value: string | undefined | null) {
  if (value === "high") return "hoch";
  if (value === "medium") return "mittel";
  if (value === "low") return "niedrig";
  return value ?? null;
}

function readContactPersonLike(value: unknown): {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  phone?: string;
  email?: string;
  sourceUrl?: string;
  sourceArea?: string;
  score?: number;
  selectedAsPrimary?: boolean;
  confidenceLabel?: string;
} {
  if (typeof value === "string") return parseContactPersonText(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const text = [record.fullName, record.name, record.role, record.phone, record.personalPhone, record.email, record.personalEmail].filter(Boolean).join(" ");
  const parsed = parseContactPersonText(text);
  return {
    fullName: typeof record.fullName === "string" ? record.fullName : typeof record.name === "string" ? record.name : parsed.fullName,
    firstName: typeof record.firstName === "string" ? record.firstName : parsed.firstName,
    lastName: typeof record.lastName === "string" ? record.lastName : parsed.lastName,
    role: typeof record.role === "string" ? record.role : parsed.role,
    phone: typeof record.phone === "string" ? record.phone : typeof record.personalPhone === "string" ? record.personalPhone : parsed.phone,
    email: typeof record.email === "string" ? record.email : typeof record.personalEmail === "string" ? record.personalEmail : parsed.email,
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : parsed.sourceUrl,
    sourceArea: typeof record.sourceArea === "string" ? record.sourceArea : undefined,
    score: typeof record.score === "number" ? record.score : undefined,
    selectedAsPrimary: typeof record.selectedAsPrimary === "boolean" ? record.selectedAsPrimary : undefined,
    confidenceLabel: typeof record.confidenceLabel === "string" ? record.confidenceLabel : typeof record.decisionMakerConfidence === "string" ? record.decisionMakerConfidence : undefined
  };
}

function formatSourceArea(value: string) {
  if (value === "footer") return "Footer/Kontaktbereich";
  if (value === "contact-card") return "Kontaktkarte";
  if (value === "kontaktbereich") return "Kontaktbereich";
  if (value === "impressum") return "Impressum";
  if (value === "team") return "Team";
  return value;
}

function parseContactPersonText(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const fullName = text.match(/\b([A-ZÄÖÜ][a-zäöüß-]{2,}\s+[A-ZÄÖÜ][a-zäöüß-]{2,})\b/)?.[1];
  const [firstName, ...lastParts] = fullName?.split(/\s+/) ?? [];
  return {
    fullName,
    firstName,
    lastName: lastParts.join(" ") || undefined,
    role: text.match(/\b(Geschäftsführer|Geschaeftsfuehrer|Geschäftsführung|Geschaeftsfuehrung|Inhaber(?:in)?|Managing Director|CEO|Ansprechpartner|Leitung|Management|Vertrieb|Disposition)\b/i)?.[1],
    phone: text.match(/(?:\+49|0049|0)\s?(?:\(?\d{1,5}\)?[\s./-]?){2,8}\d/i)?.[0]?.trim(),
    email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
    sourceUrl: text.match(/https?:\/\/[^\s)]+/i)?.[0]
  };
}

function parseSuggestionEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, { value: unknown; source: string; confidence: number }>)
    .filter(([, suggestion]) => suggestion && "value" in suggestion && "confidence" in suggestion)
    .map(([field, suggestion]) => ({ field, suggestion }));
}

function formatSuggestionValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value ?? "").trim();
}

function formatIcpLabel(value: string | null | undefined) {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  return "Low";
}

function formatResearchStatus(value: string | null | undefined) {
  if (value === "completed") return "Erfolgreich";
  if (value === "running") return "Läuft";
  if (value === "failed") return "Fehler";
  if (value === "cookie_banner_blocked") return "Blockiert durch Cookie-Banner";
  if (value === "website_unreachable") return "Website nicht erreichbar";
  if (value === "no_website") return "Keine Website vorhanden";
  return "Nicht gestartet";
}

function formatEnrichmentStatus(value: string | null | undefined) {
  if (value === "in_progress") return "Läuft";
  if (value === "enriched") return "Angereichert";
  if (value === "partial") return "Teilweise";
  if (value === "failed") return "Fehlgeschlagen";
  return "Nicht gestartet";
}

function formatCompanySize(value: string | null | undefined) {
  if (value === "small") return "klein";
  if (value === "medium") return "mittel";
  if (value === "large") return "groß";
  return "unbekannt";
}

function formatBooleanSignal(value: boolean | null | undefined) {
  return value ? "Ja" : "Nicht gefunden";
}

function formatList(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return null;
}

function formatEvidence(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 4).map((item) => {
    if (item && typeof item === "object" && "keyword" in item) {
      const evidence = item as { keyword: unknown; source?: unknown; excerpt?: unknown };
      return [evidence.keyword, evidence.source, evidence.excerpt].filter(Boolean).map(String).join(" | ");
    }
    return String(item);
  }).join(", ");
}

function formatSources(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const data = value as { pages?: unknown; fields?: unknown };
    const pages = Array.isArray(data.pages) ? data.pages : [];
    const fields = data.fields && typeof data.fields === "object" ? Object.values(data.fields as Record<string, unknown>) : [];
    const confident = fields.filter((item) => item && typeof item === "object" && "confidence" in item && Number((item as { confidence: unknown }).confidence) >= 0.7).length;
    const uncertain = fields.filter((item) => item && typeof item === "object" && "confidence" in item && Number((item as { confidence: unknown }).confidence) > 0 && Number((item as { confidence: unknown }).confidence) < 0.7).length;
    return pages.length ? `${pages.length} Website-Seiten ausgewertet${confident ? ` · ${confident} Feldquellen` : ""}${uncertain ? ` · ${uncertain} unsicher` : ""}` : null;
  }
  if (!Array.isArray(value)) return null;
  const okSources = value.filter((item) => item && typeof item === "object" && "ok" in item && (item as { ok: unknown }).ok);
  return okSources.length ? `${okSources.length} Website-Seiten ausgewertet` : null;
}

function AssetCard({
  title,
  status,
  url,
  openHref,
  previewHref,
  createHref,
  disabledText
}: {
  title: string;
  status: string;
  url: string | null;
  openHref?: string | null;
  previewHref?: string | null;
  createHref?: string;
  disabledText?: string;
}) {
  async function copyUrl() {
    if (url) await navigator.clipboard?.writeText(url);
  }

  const href = openHref || url;

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{status}</p>
        </div>
        <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-3 break-all rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{url ?? "Noch keine URL vorhanden."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {url ? (
          <>
            <button type="button" onClick={copyUrl} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              <Copy className="h-4 w-4" aria-hidden="true" />
              Kopieren
            </button>
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Öffnen
              </a>
            ) : null}
          </>
        ) : (
          <>
            <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-300">
              <Copy className="h-4 w-4" aria-hidden="true" />
              Kopieren
            </button>
            <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-300">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Öffnen
            </button>
          </>
        )}
        {previewHref ? (
          <Link href={previewHref} className="btn-primary rounded-xl px-3 py-2 text-sm font-medium">Vorschau</Link>
        ) : disabledText ? (
          <button type="button" disabled className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-400">Vorschau</button>
        ) : null}
        {!url && createHref ? <Link href={createHref} className="btn-primary rounded-xl px-3 py-2 text-sm font-medium">Erstellen</Link> : null}
      </div>
      {!url && disabledText ? <p className="mt-3 text-sm text-slate-500">{disabledText}</p> : null}
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  const className = "h-4 w-4";
  if (type === "page_view") return <Eye className={className} aria-hidden="true" />;
  if (type === "video_started") return <Play className={className} aria-hidden="true" />;
  if (type === "video_watched") return <Video className={className} aria-hidden="true" />;
  if (type === "cta_clicked" || type === "email_clicked") return <MousePointerClick className={className} aria-hidden="true" />;
  if (type === "booking_opened" || type === "booking_completed") return <CalendarCheck className={className} aria-hidden="true" />;
  if (type === "email_opened" || type === "email_replied") return <Mail className={className} aria-hidden="true" />;
  if (type === "campaign_enrolled" || type === "campaign_unenrolled") return <Briefcase className={className} aria-hidden="true" />;
  return <Activity className={className} aria-hidden="true" />;
}

function eventDescription(event: ProspectEventItem) {
  if (event.meta && typeof event.meta === "object" && !Array.isArray(event.meta)) {
    const meta = event.meta as Record<string, unknown>;
    const value = meta.url || meta.href || meta.subject || meta.campaignName;
    if (value) return String(value);
  }
  return "Lead-Aktivität wurde erfasst.";
}

export function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function formatAbsoluteDate(value: string) {
  return new Date(value).toLocaleString("de-DE");
}

export function formatRelativeDate(value: string, now = new Date()) {
  const deltaMs = new Date(value).getTime() - now.getTime();
  const absMinutes = Math.round(Math.abs(deltaMs) / 60000);
  if (absMinutes < 1) return "gerade eben";
  if (absMinutes < 60) return deltaMs < 0 ? `vor ${absMinutes} Min.` : `in ${absMinutes} Min.`;
  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) return deltaMs < 0 ? `vor ${absHours} Std.` : `in ${absHours} Std.`;
  const absDays = Math.round(absHours / 24);
  return deltaMs < 0 ? `vor ${absDays} Tagen` : `in ${absDays} Tagen`;
}

function normalizeLeadStatus(value: string): ProspectCrmLeadStatus {
  return leadStatusOptions.some((option) => option.value === value) ? value as ProspectCrmLeadStatus : "open";
}

function getPrimaryPainSignal(value: unknown): { type: string | null; label: string | null } {
  const first = Array.isArray(value) ? value[0] as { type?: string; label?: string } | undefined : undefined;
  return {
    type: first?.type ?? null,
    label: first?.label ?? null
  };
}

export function getPublicBaseUrl() {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
}

export function buildAssetUrl(pathOrUrl: string, baseUrl = getPublicBaseUrl()) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}${path}` : path;
}

export function getExternalOrPublicLandingpageUrl(landingpageUrl: string | null | undefined, publicLandingpagePath: string | null) {
  if (landingpageUrl && /^https?:\/\//i.test(landingpageUrl) && !isAdminPreviewUrl(landingpageUrl)) return landingpageUrl;
  return publicLandingpagePath ? buildAssetUrl(publicLandingpagePath) : null;
}

function isAdminPreviewUrl(value: string) {
  try {
    return new URL(value, "https://tasklytic.local").pathname.startsWith("/admin/preview/");
  } catch {
    return false;
  }
}
