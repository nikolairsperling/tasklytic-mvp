import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ProspectList } from "@/components/admin/prospect-list";
import type { ProspectCrmPanelData } from "@/components/admin/prospect-crm-panel";
import { buildPagination, parseProspectPaginationParams } from "@/lib/pagination";
import { buildContactedNoReplyWhere } from "@/lib/follow-ups";
import { isProspectStatus, type ProspectStatus } from "@/lib/prospect-status";
import { buildDashboardProspectWhere, parseDashboardProspectFilter } from "@/lib/dashboard-filters";
import { evaluateAiCallReadiness } from "@/lib/ai-calls";
import { shouldRecommendPrintMailing } from "@/lib/report-assets";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{
    prospectId?: string;
    status?: string;
    hot?: string;
    score?: string;
    q?: string;
    leadListId?: string;
    followUp?: string;
    dashboardFilter?: string;
    page?: string;
    limit?: string;
  }>;
};

export default async function AdminProspectsPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const activeStatus =
    params.status && isProspectStatus(params.status)
      ? params.status
      : "all";
  const scoreFilter =
    params.score === "hot" || params.score === "medium" || params.score === "low"
      ? params.score
      : params.hot === "1"
        ? "hot"
      : "all";
  const followUpFilter = params.followUp === "due" || params.followUp === "contacted_no_reply" ? params.followUp : "all";
  const dashboardFilter = parseDashboardProspectFilter(params.dashboardFilter);
  const { page, limit, skip, take } = parseProspectPaginationParams(new URLSearchParams({
    ...(params.page ? { page: params.page } : {}),
    ...(params.limit ? { limit: params.limit } : {})
  }));
  const searchQuery = params.q?.trim() ?? "";
  const leadListId = params.leadListId?.trim() ?? "";
  const where = {
    ...(activeStatus === "all" ? {} : { status: activeStatus }),
    ...(scoreFilter === "hot" ? { isHotLead: true } : {}),
    ...(scoreFilter === "medium" ? { fitScore: { gte: 40, lte: 70 } } : {}),
    ...(scoreFilter === "low" ? { fitScore: { lt: 40 } } : {}),
    ...(leadListId ? { leadListMembers: { some: { leadListId } } } : {}),
    ...buildDashboardProspectWhere(dashboardFilter),
    ...(followUpFilter === "due" ? {
      followUpStatus: "open",
      followUpAt: { not: null, lte: new Date() }
    } : {}),
    ...(followUpFilter === "contacted_no_reply" ? buildContactedNoReplyWhere() : {}),
    ...(searchQuery ? {
      OR: [
        { companyName: { contains: searchQuery, mode: "insensitive" as const } },
        { city: { contains: searchQuery, mode: "insensitive" as const } },
        { country: { contains: searchQuery, mode: "insensitive" as const } },
        { industry: { contains: searchQuery, mode: "insensitive" as const } },
        { painType: { contains: searchQuery, mode: "insensitive" as const } }
      ]
    } : {})
  } satisfies Prisma.ProspectWhereInput;

  const [prospects, totalProspects, targetGroups, offers, emailTemplates, campaigns, leadLists] = await prisma.$transaction([
    prisma.prospect.findMany({
      where,
      select: {
        id: true,
        companyName: true,
        city: true,
        country: true,
        totalScore: true,
        engagementScore: true,
        engagementLevel: true,
        isHotLead: true,
        icpScore: true,
        fitScore: true,
        icpCategory: true,
        icpFitScore: true,
        icpFitLabel: true,
        industry: true,
        painType: true,
        painSignals: true,
        status: true,
        leadStatus: true,
        slug: true,
        phone: true,
        companyPhone: true,
        decisionMakerEmail: true,
        decisionMakerName: true,
        decisionMakerPhone: true,
        decisionMakerRole: true,
        decisionMakerSourceUrl: true,
        decisionMakerSourceTextSnippet: true,
        decisionMakerFoundAt: true,
        decisionMakerConfidence: true,
        contactCandidates: true,
        firstName: true,
        lastName: true,
        companyEmail: true,
        websiteOriginal: true,
        websiteVerified: true,
        websiteCandidate: true,
        websiteConfidence: true,
        emailOriginal: true,
        emailVerified: true,
        emailCandidate: true,
        emailConfidence: true,
        companyMatchConfidence: true,
        companyMatchSource: true,
        landingpageUrl: true,
        landingpageReviewStatus: true,
        researchStatus: true,
        researchedAt: true,
        lastResearchError: true,
        lastResearchErrorCode: true,
        lastResearchAt: true,
        failedStep: true,
        sourceUrl: true,
        lastAttemptAt: true,
        lastSuccessfulResearchAt: true,
        enrichmentNotes: true,
        followUpAt: true,
        followUpReason: true,
        followUpStatus: true,
        lastContactedAt: true,
        lastEmailSentAt: true,
        targetGroup: { select: { id: true, name: true } },
        updatedAt: true,
        campaignEnrollments: { select: { repliedAt: true, notInterestedAt: true } },
        emailSendLogs: {
          where: { status: "sent" },
          select: { status: true, sentAt: true, repliedAt: true, step: { select: { stepNumber: true, position: true } } },
          orderBy: { sentAt: "asc" }
        },
        inboundEmails: { select: { id: true }, take: 1 },
        events: {
          where: { type: { in: ["page_view", "video_started", "video_watched", "cta_clicked", "booking_opened", "booking_completed"] } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, type: true, createdAt: true }
        },
        aiCalls: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, status: true, plannedFor: true }
        }
      },
      orderBy: [{ engagementScore: "desc" }, { createdAt: "desc" }],
      skip,
      take
    }),
    prisma.prospect.count({ where }),
    prisma.targetGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.offer.findMany({ where: { workspaceId: "default" }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { id: true, name: true, targetGroupId: true, isDefault: true } }),
    prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, subject: true, body: true } }),
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true } }),
    prisma.leadList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, targetGroupId: true, _count: { select: { members: true } } } })
  ]);

  const templates = emailTemplates.map((template) => ({ ...template, bodyText: template.body }));

  const selectedProspect = 
    params.prospectId
      ? await prisma.prospect.findUnique({
          where: { id: params.prospectId },
          include: {
            notes: { orderBy: { createdAt: "desc" } },
            events: { orderBy: { createdAt: "desc" }, take: 100 },
            campaignEnrollments: {
              include: {
                campaign: {
                  select: { id: true, name: true, status: true, offerId: true, targetGroupId: true, offer: { select: { id: true, name: true } } }
                }
              },
              orderBy: { createdAt: "desc" }
            },
            targetGroup: { select: { id: true, name: true } },
            suggestedOffer: { select: { id: true, name: true } }
          }
        })
      : null;

  return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
        <ProspectList
          prospects={prospects.map((prospect) => {
            const aiCall = evaluateAiCallReadiness(prospect);
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
              phone: prospect.phone,
              companyPhone: prospect.companyPhone,
              decisionMakerEmail: prospect.decisionMakerEmail,
              companyEmail: prospect.companyEmail,
              landingpageUrl: prospect.landingpageUrl,
              landingpageReviewStatus: prospect.landingpageReviewStatus,
              followUpAt: prospect.followUpAt?.toISOString() ?? null,
              followUpReason: prospect.followUpReason,
              followUpStatus: prospect.followUpStatus,
              lastContactedAt: prospect.lastContactedAt?.toISOString() ?? null,
              lastEmailSentAt: prospect.lastEmailSentAt?.toISOString() ?? null,
              targetGroup: prospect.targetGroup,
              aiCallStatus: aiCall.status,
              aiCallRecommended: aiCall.recommended,
              aiCallPriority: aiCall.priority,
              aiCallPlannedFor: aiCall.plannedFor?.toISOString() ?? null,
              aiCallBlockers: aiCall.blockers,
              printMailingRecommended: shouldRecommendPrintMailing(prospect),
              updatedAt: prospect.updatedAt.toISOString()
            };
          })}
          selectedProspectId={selectedProspect?.id}
          activeStatus={activeStatus}
          scoreFilter={scoreFilter}
          searchQuery={searchQuery}
          leadListId={leadListId}
          followUpFilter={followUpFilter}
          dashboardFilter={dashboardFilter}
          pagination={buildPagination(page, limit, totalProspects)}
          initialDrawerProspect={selectedProspect ? toCrmPanelData(selectedProspect, targetGroups) : null}
          targetGroups={targetGroups}
          offers={offers}
          templates={templates}
          campaigns={campaigns}
          leadLists={leadLists.map((list) => ({ id: list.id, name: list.name, targetGroupId: list.targetGroupId, count: list._count.members }))}
        />
      </div>
  );
}

type ProspectWithCrm = Prisma.ProspectGetPayload<{
  include: {
    notes: true;
    events: true;
    campaignEnrollments: {
      include: {
        campaign: {
          select: { id: true; name: true; status: true; offerId: true; targetGroupId: true; offer: { select: { id: true; name: true } } };
        };
      };
    };
    targetGroup: { select: { id: true; name: true } };
    suggestedOffer: { select: { id: true; name: true } };
  };
}>;

function toCrmPanelData(prospect: ProspectWithCrm, targetGroups: Array<{ id: string; name: string }>): ProspectCrmPanelData {
  const activeEnrollment = prospect.campaignEnrollments.find((enrollment) => enrollment.status === "active") ?? prospect.campaignEnrollments[0] ?? null;
  return {
    id: prospect.id,
    companyName: prospect.companyName,
    legalName: prospect.legalName,
    salutation: prospect.salutation,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    decisionMakerName: prospect.decisionMakerName,
    decisionMakerRole: prospect.decisionMakerRole,
    decisionMakerEmail: prospect.decisionMakerEmail,
    decisionMakerPhone: prospect.decisionMakerPhone,
    decisionMakerSourceUrl: prospect.decisionMakerSourceUrl,
    decisionMakerSourceTextSnippet: prospect.decisionMakerSourceTextSnippet,
    decisionMakerFoundAt: prospect.decisionMakerFoundAt?.toISOString() ?? null,
    decisionMakerConfidence: prospect.decisionMakerConfidence,
    contactCandidates: prospect.contactCandidates,
    companyEmail: prospect.companyEmail,
    companyPhone: prospect.companyPhone,
    contactPageUrl: prospect.contactPageUrl,
    generalContactLabel: prospect.generalContactLabel,
    phone: prospect.phone,
    linkedinUrl: prospect.linkedinUrl,
    websiteUrl: prospect.websiteUrl,
    city: prospect.city,
    postalCode: prospect.postalCode,
    street: prospect.street,
    state: prospect.state,
    country: prospect.country,
    employeeRange: prospect.employeeRange,
    employeeCount: prospect.employeeCount,
    vehicleCount: prospect.vehicleCount,
    trailerCount: prospect.trailerCount,
    locationsCount: prospect.locationsCount,
    businessFields: prospect.businessFields,
    companyStatus: prospect.companyStatus,
    icpScore: prospect.icpScore,
    icpFitScore: prospect.icpFitScore,
    icpFitLabel: prospect.icpFitLabel,
    industry: prospect.industry,
    painScore: prospect.painScore,
    painType: prospect.painType,
    painSummary: prospect.painSummary,
    painEvidence: prospect.painEvidence,
    hiringSignal: prospect.hiringSignal,
    growthSignal: prospect.growthSignal,
    manualProcessSignal: prospect.manualProcessSignal,
    digitalWeaknessSignal: prospect.digitalWeaknessSignal,
    personalizationAngle: prospect.personalizationAngle,
    researchStatus: prospect.researchStatus,
    researchSources: prospect.researchSources,
    researchedAt: prospect.researchedAt?.toISOString() ?? null,
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
    lastResearchError: prospect.lastResearchError,
    lastResearchErrorCode: prospect.lastResearchErrorCode,
    lastResearchAt: prospect.lastResearchAt?.toISOString() ?? null,
    failedStep: prospect.failedStep,
    sourceUrl: prospect.sourceUrl,
    lastAttemptAt: prospect.lastAttemptAt?.toISOString() ?? null,
    lastSuccessfulResearchAt: prospect.lastSuccessfulResearchAt?.toISOString() ?? null,
    companyDescription: prospect.companyDescription,
    services: prospect.services,
    companySizeLabel: prospect.companySizeLabel,
    employeeCountEstimate: prospect.employeeCountEstimate,
    fleetSizeEstimate: prospect.fleetSizeEstimate,
    specialization: prospect.specialization,
    targetCustomers: prospect.targetCustomers,
    companyProfileSummary: prospect.companyProfileSummary,
    painSignals: prospect.painSignals,
    customPainPoint: prospect.customPainPoint,
    engagementScore: prospect.engagementScore,
    engagementLevel: prospect.engagementLevel,
    status: prospect.status,
    leadStatus: prospect.leadStatus,
    targetGroupId: prospect.targetGroupId,
    targetGroup: prospect.targetGroup ?? null,
    suggestedOfferId: prospect.suggestedOfferId,
    suggestedOffer: prospect.suggestedOffer ?? null,
    targetGroups,
    followUpAt: prospect.followUpAt?.toISOString() ?? null,
    followUpReason: prospect.followUpReason ?? null,
    followUpStatus: prospect.followUpStatus,
    lastContactedAt: prospect.lastContactedAt?.toISOString() ?? null,
    lastEmailSentAt: prospect.lastEmailSentAt?.toISOString() ?? null,
    assignedTo: prospect.assignedTo,
    showInCrm: prospect.showInCrm,
    source: prospect.source,
    slug: prospect.slug,
    landingpageUrl: prospect.landingpageUrl,
    landingpageReviewStatus: prospect.landingpageReviewStatus,
    printMailingRecommended: shouldRecommendPrintMailing(prospect),
    personalVideoStatus: prospect.personalVideoStatus,
    personalVideoUrl: prospect.personalVideoUrl,
    videoUrl: prospect.videoUrl,
    notes: prospect.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
    events: prospect.events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    activeCampaign: activeEnrollment ? {
      id: activeEnrollment.campaign.id,
      enrollmentId: activeEnrollment.id,
      name: activeEnrollment.campaign.name,
      status: activeEnrollment.campaign.status,
      offerId: activeEnrollment.campaign.offerId,
      offerName: activeEnrollment.campaign.offer.name,
      targetGroupId: activeEnrollment.campaign.targetGroupId,
      enrollmentStatus: activeEnrollment.status
    } : null
  };
}
