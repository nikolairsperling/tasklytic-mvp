import { prisma } from "@/lib/prisma";

export async function getDashboardMetrics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [prospects, campaignReady, activeCampaigns, plannedCampaigns, logs, enrollments, campaigns, importedLeads, enrichedLeads, validLeads, invalidCompanies, generatedLandingpages, generatedEmails, clickUpSyncedTotal, clickUpSyncedToday, clickUpUpdates, clickUpOpenErrors] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { decisionMakerEmail: { not: null }, slug: { not: null } } }),
    prisma.campaign.count({ where: { status: "active" } }),
    prisma.campaign.count({ where: { scheduledStartAt: { not: null } } }),
    prisma.emailSendLog.findMany(),
    prisma.campaignEnrollment.findMany(),
    prisma.campaign.findMany({ include: { enrollments: true } }),
    prisma.prospect.count({ where: { leadImportRows: { some: {} } } }),
    prisma.prospect.count({ where: { researchStatus: "completed" } }),
    prisma.prospect.count({ where: { companyStatus: { in: ["active", "unclear"] } } }),
    prisma.prospect.count({ where: { companyStatus: { in: ["inactive", "unreachable"] } } }),
    prisma.prospect.count({ where: { OR: [{ landingpageUrl: { not: null } }, { slug: { not: null } }] } }),
    prisma.campaign.count({ where: { OR: [{ steps: { some: {} } }, { emailVariants: { some: {} } }] } }),
    prisma.clickUpSyncLog.count({ where: { status: "success" } }),
    prisma.clickUpSyncLog.count({ where: { status: "success", createdAt: { gte: startOfToday } } }),
    prisma.clickUpSyncLog.count({ where: { action: "updated", status: "success" } }),
    prisma.clickUpSyncLog.count({ where: { status: "failed" } })
  ]);

  const sent = logs.filter((log) => log.status === "sent").length;
  const opens = logs.reduce((sum, log) => sum + log.openCount, 0);
  const clicks = logs.reduce((sum, log) => sum + log.clickCount, 0);
  const replies = enrollments.filter((entry) => entry.repliedAt).length;
  const booked = enrollments.filter((entry) => entry.bookedAt).length;
  const notInterested = enrollments.filter((entry) => entry.notInterestedAt).length;
  const pipelineValue = campaigns.reduce((sum, campaign) => {
    const campaignBooked = campaign.enrollments.filter((entry) => entry.bookedAt).length;
    return sum + campaignBooked * (campaign.estimatedDealValue ?? 0);
  }, 0);
  const roiInputs = campaigns.reduce(
    (acc, campaign) => {
      acc.enrollments += campaign.enrollments.length;
      acc.booked += campaign.enrollments.filter((entry) => entry.bookedAt).length;
      acc.replies += campaign.enrollments.filter((entry) => entry.repliedAt).length;
      acc.cost += campaign.enrollments.length * (campaign.estimatedCostPerLead ?? 0);
      acc.value += campaign.enrollments.filter((entry) => entry.bookedAt).length * (campaign.estimatedDealValue ?? 0);
      return acc;
    },
    { enrollments: 0, booked: 0, replies: 0, cost: 0, value: 0 }
  );
  const roi = roiInputs.cost > 0 ? ((roiInputs.value - roiInputs.cost) / roiInputs.cost) * 100 : null;

  return {
    prospects,
    campaignReady,
    activeCampaigns,
    plannedCampaigns,
    sent,
    opens,
    clicks,
    replies,
    booked,
    notInterested,
    pipelineValue,
    roi,
    importedLeads,
    enrichedLeads,
    validLeads,
    invalidCompanies,
    generatedLandingpages,
    generatedEmails,
    clickUpSyncedTotal,
    clickUpSyncedToday,
    clickUpUpdates,
    clickUpOpenErrors
  };
}
