import type { Prisma } from "@prisma/client";

export type DashboardProspectFilter =
  | "campaignReady"
  | "booked"
  | "notInterested"
  | "imported"
  | "enriched"
  | "valid"
  | "invalid"
  | "landingpages";

export function parseDashboardProspectFilter(value?: string | null): DashboardProspectFilter | "" {
  return value === "campaignReady" ||
    value === "booked" ||
    value === "notInterested" ||
    value === "imported" ||
    value === "enriched" ||
    value === "valid" ||
    value === "invalid" ||
    value === "landingpages"
    ? value
    : "";
}

export function buildDashboardProspectWhere(filter: DashboardProspectFilter | ""): Prisma.ProspectWhereInput {
  if (filter === "campaignReady") return { decisionMakerEmail: { not: null }, slug: { not: null } };
  if (filter === "booked") return { campaignEnrollments: { some: { bookedAt: { not: null } } } };
  if (filter === "notInterested") return { campaignEnrollments: { some: { notInterestedAt: { not: null } } } };
  if (filter === "imported") return { leadImportRows: { some: {} } };
  if (filter === "enriched") return { researchStatus: "completed" };
  if (filter === "valid") return { companyStatus: { in: ["active", "unclear"] } };
  if (filter === "invalid") return { companyStatus: { in: ["inactive", "unreachable"] } };
  if (filter === "landingpages") return { OR: [{ landingpageUrl: { not: null } }, { slug: { not: null } }] };
  return {};
}

export type DashboardCampaignFilter = "planned" | "generatedEmails";

export function parseDashboardCampaignFilter(value?: string | null): DashboardCampaignFilter | "" {
  return value === "planned" || value === "generatedEmails" ? value : "";
}

export function buildDashboardCampaignWhere({
  status,
  hasSent,
  dashboardFilter
}: {
  status?: string | null;
  hasSent?: string | null;
  dashboardFilter?: DashboardCampaignFilter | "";
}): Prisma.CampaignWhereInput {
  return {
    ...(status === "active" || status === "draft" || status === "paused" || status === "completed" ? { status } : {}),
    ...(hasSent === "1" || hasSent === "true" ? { sendLogs: { some: { status: "sent" } } } : {}),
    ...(dashboardFilter === "planned" ? { scheduledStartAt: { not: null } } : {}),
    ...(dashboardFilter === "generatedEmails" ? { OR: [{ steps: { some: {} } }, { emailVariants: { some: {} } }] } : {})
  };
}
