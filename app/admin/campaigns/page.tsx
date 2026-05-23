import { CampaignManager, type CampaignAdminData } from "@/components/admin/campaign-manager";
import { buildPagination, parsePaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getEffectiveCampaignSendingStatus } from "@/lib/scheduling";
import { buildDashboardCampaignWhere, parseDashboardCampaignFilter } from "@/lib/dashboard-filters";

export const dynamic = "force-dynamic";

type AdminCampaignsPageProps = {
  searchParams?: Promise<{
    campaignId?: string;
    page?: string;
    limit?: string;
    tab?: string;
    status?: string;
    hasSent?: string;
    dashboardFilter?: string;
  }>;
};

export default async function AdminCampaignsPage({ searchParams }: AdminCampaignsPageProps) {
  const params = (await searchParams) ?? {};
  const { page, limit, skip, take } = parsePaginationParams(new URLSearchParams({
    ...(params.page ? { page: params.page } : {}),
    ...(params.limit ? { limit: params.limit } : {})
  }));
  const dashboardFilter = parseDashboardCampaignFilter(params.dashboardFilter);
  const campaignWhere = buildDashboardCampaignWhere({
    status: params.status,
    hasSent: params.hasSent,
    dashboardFilter
  });
  const [campaigns, totalCampaigns, targetGroups, offers] = await prisma.$transaction([
    prisma.campaign.findMany({
      where: campaignWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        steps: true,
        enrollments: true,
        sendLogs: {
          select: { status: true }
        }
      }
    }),
    prisma.campaign.count({ where: campaignWhere }),
    prisma.targetGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, defaultOfferId: true } }),
    prisma.offer.findMany({ where: { workspaceId: "default" }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] })
  ]);

  const selectedCampaignId = params.campaignId ?? campaigns[0]?.id;
  const selectedCampaign = selectedCampaignId
    ? await prisma.campaign.findUnique({
        where: { id: selectedCampaignId },
        include: {
          steps: { orderBy: { stepNumber: "asc" } },
          emailVariants: { orderBy: { label: "asc" } },
          enrollments: {
            include: {
              prospect: {
                include: {
                  events: {
                    where: {
                      type: { in: ["page_view", "video_started", "email_replied", "booking_opened", "booking_completed"] }
                    },
                    select: { type: true, createdAt: true }
                  }
                }
              },
              emailVariant: true
            },
            orderBy: { createdAt: "desc" }
          },
          sendLogs: {
            orderBy: { createdAt: "desc" },
            include: {
              prospect: {
                select: { companyName: true }
              },
              step: {
                select: { stepNumber: true }
              },
              emailVariant: {
                select: { label: true }
              }
            }
          }
        }
      })
    : null;

  const eligibleProspects = await prisma.prospect.findMany({
    where: {
    decisionMakerEmail: { not: null },
    slug: { not: null },
    landingpageReviewStatus: "approved",
    companyStatus: { notIn: ["inactive", "unreachable"] }
  },
  orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }]
  });

  console.info("[admin/campaigns]", {
    offersCount: offers.length,
    selectedOfferId: selectedCampaign?.offerId ?? null,
    prospectsCount: eligibleProspects.length
  });

  const variantStats = selectedCampaign ? buildVariantStats(selectedCampaign) : [];

  const data: CampaignAdminData = {
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      sendingStatus: getEffectiveCampaignSendingStatus({ status: campaign.status, sendingStatus: campaign.sendingStatus }),
      createdAt: campaign.createdAt.toISOString(),
      scheduledStartAt: campaign.scheduledStartAt?.toISOString() ?? null,
      timezone: campaign.timezone,
      sendWindowStart: campaign.sendWindowStart,
      sendWindowEnd: campaign.sendWindowEnd,
      weekdaysOnly: campaign.weekdaysOnly,
      manualGoApproved: campaign.manualGoApproved,
      stepsCount: campaign.steps.length,
      enrollmentsCount: campaign.enrollments.length,
      sentCount: campaign.sendLogs.filter((log) => log.status === "sent").length,
      failedCount: campaign.sendLogs.filter((log) => log.status === "failed").length
    })),
    pagination: buildPagination(page, limit, totalCampaigns),
    selectedCampaign: selectedCampaign
        ? {
          id: selectedCampaign.id,
          name: selectedCampaign.name,
          status: selectedCampaign.status,
          sendingStatus: getEffectiveCampaignSendingStatus({ status: selectedCampaign.status, sendingStatus: selectedCampaign.sendingStatus }),
          targetGroupId: selectedCampaign.targetGroupId,
          offerId: selectedCampaign.offerId,
          selectedProspectId: selectedCampaign.selectedProspectId,
          trackingEnabled: selectedCampaign.trackingEnabled,
          estimatedDealValue: selectedCampaign.estimatedDealValue,
          estimatedCostPerLead: selectedCampaign.estimatedCostPerLead,
          notes: selectedCampaign.notes,
          scheduledStartAt: selectedCampaign.scheduledStartAt?.toISOString() ?? null,
          timezone: selectedCampaign.timezone,
          sendWindowStart: selectedCampaign.sendWindowStart,
          sendWindowEnd: selectedCampaign.sendWindowEnd,
          weekdaysOnly: selectedCampaign.weekdaysOnly,
          manualGoApproved: selectedCampaign.manualGoApproved,
          steps: selectedCampaign.steps.map((step) => ({
            id: step.id,
            stepNumber: step.stepNumber,
            delayDays: step.delayDays,
            subject: step.subject,
            body: step.body,
            isActive: step.isActive
          })),
          emailVariants: selectedCampaign.emailVariants.map((variant) => ({
            id: variant.id,
            label: variant.label,
            subject: variant.subject,
            bodyText: variant.bodyText,
            weight: variant.weight,
            landingpageUrl: variant.landingpageUrl,
            isActive: variant.isActive
          })),
          variantStats,
          enrollments: selectedCampaign.enrollments.map((enrollment) => ({
            id: enrollment.id,
            status: enrollment.status,
            prospectId: enrollment.prospectId,
            createdAt: enrollment.createdAt.toISOString(),
            currentStep: enrollment.currentStep,
            emailVariantId: enrollment.emailVariantId,
            emailVariantLabel: enrollment.emailVariantLabel,
            blockedReason: enrollment.blockedReason,
            nextSendAt: enrollment.nextSendAt?.toISOString() ?? null,
            lastSentAt: enrollment.lastSentAt?.toISOString() ?? null,
            repliedAt: enrollment.repliedAt?.toISOString() ?? null,
            bookedAt: enrollment.bookedAt?.toISOString() ?? null,
            notInterestedAt: enrollment.notInterestedAt?.toISOString() ?? null,
            prospect: {
              companyName: enrollment.prospect.companyName,
              city: enrollment.prospect.city,
              decisionMakerEmail: enrollment.prospect.decisionMakerEmail,
              slug: enrollment.prospect.slug,
              landingpageReviewStatus: enrollment.prospect.landingpageReviewStatus,
              landingpageUrl: enrollment.prospect.landingpageUrl,
              totalScore: enrollment.prospect.totalScore,
              status: enrollment.prospect.status
            }
          })),
          sendLogs: selectedCampaign.sendLogs.map((log) => ({
            id: log.id,
            status: log.status,
            email: log.email,
            subject: log.subject,
            error: log.error,
            messageId: log.messageId,
            sentAt: log.sentAt?.toISOString() ?? null,
            createdAt: log.createdAt.toISOString(),
            openCount: log.openCount,
            clickCount: log.clickCount,
            emailVariantLabel: log.emailVariantLabel ?? log.emailVariant?.label ?? null,
            prospect: log.prospect,
            step: log.step
          }))
        }
      : null,
    eligibleProspects: eligibleProspects.map((prospect) => ({
      id: prospect.id,
      companyName: prospect.companyName,
      city: prospect.city,
      companyEmail: prospect.companyEmail,
      decisionMakerEmail: prospect.decisionMakerEmail,
      decisionMakerName: prospect.decisionMakerName,
      slug: prospect.slug,
      landingpageReviewStatus: prospect.landingpageReviewStatus,
      landingpageUrl: prospect.landingpageUrl,
      totalScore: prospect.totalScore,
      status: prospect.status,
      fitScore: prospect.fitScore,
      icpScore: prospect.icpScore,
      icpFitScore: prospect.icpFitScore,
      icpFitLabel: prospect.icpFitLabel,
      icpCategory: prospect.icpCategory,
      engagementLevel: prospect.engagementLevel,
      leadStatus: prospect.leadStatus,
      targetGroupId: prospect.targetGroupId,
      targetGroupName: targetGroups.find((group) => group.id === prospect.targetGroupId)?.name ?? null,
      painType: prospect.painType,
      painSignals: Array.isArray(prospect.painSignals) ? prospect.painSignals as Array<{ type: string; label: string; strength: number }> : [],
      videoUrl: prospect.videoUrl
    })),
    targetGroups,
    offers: offers.map((offer) => ({
      id: offer.id,
      name: offer.name,
      targetGroupId: offer.targetGroupId,
      isDefault: offer.isDefault
    })),
    initialTab: parseCampaignTab(params.tab),
    dashboardFilter,
    statusFilter: params.status ?? "",
    hasSentFilter: params.hasSent ?? ""
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <CampaignManager {...data} />
    </div>
  );
}

function buildVariantStats(campaign: {
  emailVariants: Array<{ id: string; label: string }>;
  enrollments: Array<{
    emailVariantId: string | null;
    emailVariantLabel: string | null;
    createdAt: Date;
    repliedAt: Date | null;
    bookedAt: Date | null;
    prospect: { events: Array<{ type: string; createdAt: Date }> };
  }>;
  sendLogs: Array<{ status: string; emailVariantId: string | null; emailVariantLabel: string | null; openCount: number; clickCount: number }>;
}) {
  const variants = campaign.emailVariants;
  const enrollments = campaign.enrollments;
  const logs = campaign.sendLogs;

  return variants.map((variant) => {
    const variantEnrollments = enrollments.filter((enrollment) => enrollment.emailVariantId === variant.id || enrollment.emailVariantLabel === variant.label);
    const variantLogs = logs.filter((log) => log.emailVariantId === variant.id || log.emailVariantLabel === variant.label);
    const sentLogs = variantLogs.filter((log) => log.status === "sent");
    const sent = sentLogs.length;
    const opened = sentLogs.filter((log) => log.openCount > 0).length;
    const clicked = sentLogs.filter((log) => log.clickCount > 0).length;
    const landingpageVisited = variantEnrollments.filter((enrollment) =>
      enrollment.prospect.events.some((event) => event.type === "page_view" && event.createdAt >= enrollment.createdAt)
    ).length;
    const videoStarted = variantEnrollments.filter((enrollment) =>
      enrollment.prospect.events.some((event) => event.type === "video_started" && event.createdAt >= enrollment.createdAt)
    ).length;
    const replied = variantEnrollments.filter((enrollment) => Boolean(enrollment.repliedAt)).length;
    const booked = variantEnrollments.filter((enrollment) =>
      Boolean(enrollment.bookedAt) ||
      enrollment.prospect.events.some((event) => (event.type === "booking_opened" || event.type === "booking_completed") && event.createdAt >= enrollment.createdAt)
    ).length;

    return {
      id: variant.id,
      label: variant.label,
      sent,
      delivered: sent,
      opened,
      clicked,
      landingpageVisited,
      videoStarted,
      replied,
      booked,
      openRate: rate(opened, sent),
      clickRate: rate(clicked, sent),
      landingpageVisitRate: rate(landingpageVisited, sent),
      replyRate: rate(replied, sent),
      bookingRate: rate(booked, sent)
    };
  });
}

function rate(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

function parseCampaignTab(tab?: string) {
  return tab === "neu" ||
    tab === "steps" ||
    tab === "kontakte" ||
    tab === "sendelog" ||
    tab === "analytics" ||
    tab === "einstellungen"
    ? tab
    : "uebersicht";
}
