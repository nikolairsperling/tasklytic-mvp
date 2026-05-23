import type { Prospect, ProspectEvent } from "@prisma/client";

export const hotLeadIntentEvents = ["booking_opened", "cta_clicked", "email_replied", "video_watched"] as const;

export type HotLeadIntentEvent = (typeof hotLeadIntentEvents)[number];

export type HotLeadItem = {
  prospectId: string;
  name: string;
  companyName: string;
  city: string;
  status: string;
  engagementScore: number;
  engagementLevel: string;
  icpFitScore: number;
  painType: string | null;
  painSummary: string | null;
  lastEvent: {
    id: string;
    type: string;
    createdAt: string;
  } | null;
  lastActivityAt: string;
  landingpageUrl: string | null;
  decisionMakerEmail: string | null;
  phone: string | null;
  companyPhone: string | null;
  linkedinUrl: string | null;
};

export type HotLeadKpis = {
  total: number;
  activeToday: number;
  ctaClicked: number;
  bookingOpened: number;
  emailReplied: number;
};

type HotLeadProspect = Pick<
  Prospect,
  | "id"
  | "companyName"
  | "city"
  | "status"
  | "decisionMakerName"
  | "firstName"
  | "lastName"
  | "engagementScore"
  | "engagementLevel"
  | "fitScore"
  | "icpFitScore"
  | "painSignals"
  | "customPainPoint"
  | "landingpageUrl"
  | "slug"
  | "decisionMakerEmail"
  | "phone"
  | "companyPhone"
  | "linkedinUrl"
  | "updatedAt"
> & {
  events?: Array<Pick<ProspectEvent, "id" | "type" | "createdAt">>;
};

const intentPriority: Record<HotLeadIntentEvent, number> = {
  email_replied: 1,
  booking_opened: 2,
  cta_clicked: 3,
  video_watched: 4
};

export function isHotLeadProspect(prospect: Pick<HotLeadProspect, "engagementLevel" | "engagementScore" | "fitScore" | "icpFitScore" | "events">) {
  return (
    prospect.engagementLevel === "hot" ||
    prospect.engagementScore >= 50 ||
    prospect.fitScore >= 70 ||
    prospect.icpFitScore >= 70 ||
    Boolean(prospect.events?.some((event) => isHotLeadIntentEvent(event.type)))
  );
}

export function toHotLeadItem(prospect: HotLeadProspect): HotLeadItem {
  const fullName = [prospect.firstName, prospect.lastName].filter(Boolean).join(" ").trim();
  const name = prospect.decisionMakerName || fullName || prospect.companyName;
  const lastEvent = getStrongestRecentEvent(prospect.events ?? []);
  const pain = getPain(prospect.painSignals, prospect.customPainPoint);

  return {
    prospectId: prospect.id,
    name,
    companyName: prospect.companyName,
    city: prospect.city,
    status: prospect.status,
    engagementScore: Math.max(0, Math.min(100, prospect.engagementScore ?? 0)),
    engagementLevel: prospect.engagementLevel || "cold",
    icpFitScore: Math.max(0, Math.min(100, prospect.icpFitScore ?? 0)),
    painType: pain.type,
    painSummary: pain.summary,
    lastEvent: lastEvent
      ? {
          id: lastEvent.id,
          type: lastEvent.type,
          createdAt: lastEvent.createdAt.toISOString()
        }
      : null,
    lastActivityAt: (lastEvent?.createdAt ?? prospect.updatedAt).toISOString(),
    landingpageUrl: prospect.landingpageUrl || (prospect.slug ? `/p/${prospect.slug}` : null),
    decisionMakerEmail: prospect.decisionMakerEmail,
    phone: prospect.phone,
    companyPhone: prospect.companyPhone,
    linkedinUrl: prospect.linkedinUrl
  };
}

export function sortHotLeads(leads: HotLeadItem[]) {
  return [...leads].sort((a, b) => {
    const priorityDelta = priorityForLead(a) - priorityForLead(b);
    if (priorityDelta !== 0) return priorityDelta;

    const scoreDelta = b.engagementScore - a.engagementScore;
    if (scoreDelta !== 0) return scoreDelta;

    return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
  });
}

export function buildHotLeadKpis(leads: HotLeadItem[], now = new Date()) {
  const dayKey = now.toISOString().slice(0, 10);
  return {
    total: leads.length,
    activeToday: leads.filter((lead) => lead.lastActivityAt.slice(0, 10) === dayKey).length,
    ctaClicked: leads.filter((lead) => lead.lastEvent?.type === "cta_clicked").length,
    bookingOpened: leads.filter((lead) => lead.lastEvent?.type === "booking_opened").length,
    emailReplied: leads.filter((lead) => lead.lastEvent?.type === "email_replied").length
  };
}

function priorityForLead(lead: HotLeadItem) {
  return isHotLeadIntentEvent(lead.lastEvent?.type) ? intentPriority[lead.lastEvent.type] : 99;
}

function getStrongestRecentEvent(events: Array<Pick<ProspectEvent, "id" | "type" | "createdAt">>) {
  return [...events]
    .filter((event) => isHotLeadIntentEvent(event.type))
    .sort((a, b) => {
      const priorityDelta = priorityForEvent(a.type) - priorityForEvent(b.type);
      if (priorityDelta !== 0) return priorityDelta;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0] ?? null;
}

function isHotLeadIntentEvent(value: string | undefined): value is HotLeadIntentEvent {
  return hotLeadIntentEvents.some((type) => type === value);
}

function priorityForEvent(type: string) {
  return isHotLeadIntentEvent(type) ? intentPriority[type] : 99;
}

function getPain(painSignals: unknown, customPainPoint: string | null) {
  const firstSignal = Array.isArray(painSignals)
    ? painSignals.find((signal): signal is { type?: string; label?: string; summary?: string } => Boolean(signal) && typeof signal === "object")
    : null;

  return {
    type: firstSignal?.type ?? null,
    summary: customPainPoint || firstSignal?.summary || firstSignal?.label || null
  };
}
