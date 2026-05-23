import type { Prospect, ProspectEvent } from "@prisma/client";

export const leadActivityTypes = ["video_watched", "page_view", "cta_clicked"] as const;

export type LeadActivityType = (typeof leadActivityTypes)[number];

export type LeadListItem = {
  id: string;
  name: string;
  company: string;
  status: string;
  leadStatus: string;
  icpFitScore: number;
  icpFitLabel: string;
  industry: string | null;
  painType: string | null;
  warmth: string;
  score: number;
  lastEvent: {
    id: string;
    type: LeadActivityType;
    createdAt: string;
  } | null;
  landingpageUrl: string | null;
  slug: string | null;
  decisionMakerEmail?: string | null;
  companyEmail?: string | null;
  landingpageReviewStatus?: string | null;
};

type LeadProspect = Pick<
  Prospect,
  | "id"
  | "companyName"
  | "decisionMakerName"
  | "firstName"
  | "lastName"
  | "status"
  | "leadStatus"
  | "icpFitScore"
  | "icpFitLabel"
  | "industry"
  | "painType"
  | "engagementLevel"
  | "engagementScore"
  | "landingpageUrl"
  | "slug"
  | "decisionMakerEmail"
  | "companyEmail"
  | "landingpageReviewStatus"
> & {
  events?: Array<Pick<ProspectEvent, "id" | "type" | "createdAt">>;
};

export function toLeadListItem(prospect: LeadProspect): LeadListItem {
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
          createdAt: event.createdAt.toISOString()
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
  return leadActivityTypes.some((type) => type === value);
}
