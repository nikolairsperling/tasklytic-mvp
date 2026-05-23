import type { Prisma } from "@prisma/client";
import { buildAnalyticsOverview, dateFromRange, type AnalyticsDateRange, type AnalyticsFilters, type AnalyticsOverview } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export function parseAnalyticsFilters(searchParams: URLSearchParams): Required<AnalyticsFilters> {
  const dateRange = searchParams.get("dateRange");
  const event = searchParams.get("event");
  return {
    dateRange: dateRange === "7d" || dateRange === "30d" || dateRange === "90d" || dateRange === "all" ? dateRange : "30d",
    campaignId: searchParams.get("campaignId")?.trim() ?? "",
    targetGroupId: searchParams.get("targetGroupId")?.trim() ?? "",
    offerId: searchParams.get("offerId")?.trim() ?? "",
    leadListId: searchParams.get("leadListId")?.trim() ?? "",
    event: event === "open" || event === "click" ? event : ""
  };
}

export async function getAnalyticsOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
  const normalized = {
    dateRange: filters.dateRange ?? "30d",
    campaignId: filters.campaignId ?? "",
    targetGroupId: filters.targetGroupId ?? "",
    offerId: filters.offerId ?? "",
    leadListId: filters.leadListId ?? "",
    event: filters.event ?? ""
  };
  const since = dateFromRange(normalized.dateRange as AnalyticsDateRange);
  const prospectWhere = buildProspectWhere(normalized, since);
  const logWhere = buildEmailLogWhere(normalized, since);
  const enrollmentWhere = buildEnrollmentWhere(normalized, since);
  const eventWhere = buildEventWhere(normalized, since);
  const campaignWhere = buildCampaignWhere(normalized);

  const [prospects, emailLogs, enrollments, events, campaigns] = await prisma.$transaction([
    prisma.prospect.findMany({
      where: prospectWhere,
      select: {
        id: true,
        researchStatus: true,
        researchedAt: true,
        landingpageUrl: true,
        slug: true,
        isHotLead: true,
        engagementLevel: true,
        icpFitLabel: true,
        icpCategory: true
      }
    }),
    prisma.emailSendLog.findMany({
      where: logWhere,
      select: {
        campaignId: true,
        prospectId: true,
        status: true,
        openCount: true,
        clickCount: true,
        openedAt: true,
        clickedAt: true,
        repliedAt: true,
        sentAt: true,
        createdAt: true
      }
    }),
    prisma.campaignEnrollment.findMany({
      where: enrollmentWhere,
      select: {
        campaignId: true,
        prospectId: true,
        repliedAt: true,
        bookedAt: true,
        createdAt: true
      }
    }),
    prisma.prospectEvent.findMany({
      where: eventWhere,
      select: { prospectId: true, type: true, createdAt: true }
    }),
    prisma.campaign.findMany({
      where: campaignWhere,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
    })
  ]);

  return buildAnalyticsOverview({ prospects, emailLogs, enrollments, events, campaigns });
}

export async function getAnalyticsFilterOptions() {
  const [campaigns, targetGroups, offers, leadLists] = await prisma.$transaction([
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    prisma.targetGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.offer.findMany({ where: { workspaceId: "default" }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.leadList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
  ]);

  return { campaigns, targetGroups, offers, leadLists };
}

function buildProspectWhere(filters: Required<AnalyticsFilters>, since: Date | null): Prisma.ProspectWhereInput {
  return {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filters.targetGroupId ? { targetGroupId: filters.targetGroupId } : {}),
    ...(filters.offerId ? { suggestedOfferId: filters.offerId } : {}),
    ...(filters.leadListId ? { leadListMembers: { some: { leadListId: filters.leadListId } } } : {}),
    ...(filters.campaignId ? { campaignEnrollments: { some: { campaignId: filters.campaignId } } } : {})
  };
}

function buildCampaignWhere(filters: Required<AnalyticsFilters>): Prisma.CampaignWhereInput {
  return {
    ...(filters.campaignId ? { id: filters.campaignId } : {}),
    ...(filters.targetGroupId ? { targetGroupId: filters.targetGroupId } : {}),
    ...(filters.offerId ? { offerId: filters.offerId } : {})
  };
}

function buildEmailLogWhere(filters: Required<AnalyticsFilters>, since: Date | null): Prisma.EmailSendLogWhereInput {
  return {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filters.event === "open" ? { OR: [{ openCount: { gt: 0 } }, { openedAt: { not: null } }] } : {}),
    ...(filters.event === "click" ? { OR: [{ clickCount: { gt: 0 } }, { clickedAt: { not: null } }] } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.leadListId || filters.targetGroupId || filters.offerId ? {
      prospect: {
        ...(filters.targetGroupId ? { targetGroupId: filters.targetGroupId } : {}),
        ...(filters.offerId ? { suggestedOfferId: filters.offerId } : {}),
        ...(filters.leadListId ? { leadListMembers: { some: { leadListId: filters.leadListId } } } : {})
      }
    } : {}),
    ...(filters.targetGroupId || filters.offerId ? {
      campaign: {
        ...(filters.targetGroupId ? { targetGroupId: filters.targetGroupId } : {}),
        ...(filters.offerId ? { offerId: filters.offerId } : {})
      }
    } : {})
  };
}

function buildEnrollmentWhere(filters: Required<AnalyticsFilters>, since: Date | null): Prisma.CampaignEnrollmentWhereInput {
  return {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.leadListId || filters.targetGroupId || filters.offerId ? {
      prospect: {
        ...(filters.targetGroupId ? { targetGroupId: filters.targetGroupId } : {}),
        ...(filters.offerId ? { suggestedOfferId: filters.offerId } : {}),
        ...(filters.leadListId ? { leadListMembers: { some: { leadListId: filters.leadListId } } } : {})
      }
    } : {}),
    ...(filters.targetGroupId || filters.offerId ? {
      campaign: {
        ...(filters.targetGroupId ? { targetGroupId: filters.targetGroupId } : {}),
        ...(filters.offerId ? { offerId: filters.offerId } : {})
      }
    } : {})
  };
}

function buildEventWhere(filters: Required<AnalyticsFilters>, since: Date | null): Prisma.ProspectEventWhereInput {
  return {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filters.leadListId || filters.targetGroupId || filters.offerId || filters.campaignId ? {
      prospect: {
        ...(filters.targetGroupId ? { targetGroupId: filters.targetGroupId } : {}),
        ...(filters.offerId ? { suggestedOfferId: filters.offerId } : {}),
        ...(filters.leadListId ? { leadListMembers: { some: { leadListId: filters.leadListId } } } : {}),
        ...(filters.campaignId ? { campaignEnrollments: { some: { campaignId: filters.campaignId } } } : {})
      }
    } : {})
  };
}
