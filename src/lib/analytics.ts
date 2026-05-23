export type RoiInput = {
  enrollments: number;
  booked: number;
  replies: number;
  estimatedDealValue?: number | null;
  estimatedCostPerLead?: number | null;
};

export type RoiResult = {
  pipelineValue: number;
  cost: number;
  roiPercent: number | null;
  costPerBooking: number | null;
  costPerReply: number | null;
};

export function calculateCampaignRoi({
  enrollments,
  booked,
  replies,
  estimatedDealValue,
  estimatedCostPerLead
}: RoiInput): RoiResult {
  const dealValue = estimatedDealValue ?? 0;
  const costPerLead = estimatedCostPerLead ?? 0;
  const pipelineValue = booked * dealValue;
  const cost = enrollments * costPerLead;

  if (cost <= 0) {
    return {
      pipelineValue,
      cost,
      roiPercent: null,
      costPerBooking: null,
      costPerReply: null
    };
  }

  return {
    pipelineValue,
    cost,
    roiPercent: ((pipelineValue - cost) / cost) * 100,
    costPerBooking: booked > 0 ? cost / booked : null,
    costPerReply: replies > 0 ? cost / replies : null
  };
}

export function rate(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (part / total) * 100;
}

export type AnalyticsDateRange = "7d" | "30d" | "90d" | "all";

export type AnalyticsFilters = {
  dateRange?: AnalyticsDateRange;
  campaignId?: string;
  targetGroupId?: string;
  offerId?: string;
  leadListId?: string;
  event?: "open" | "click" | "";
};

export type AnalyticsKpis = {
  totalLeads: number;
  enriched: number;
  landingpagesCreated: number;
  emailsSent: number;
  emailOpened: number;
  emailClicked: number;
  emailReplied: number;
  bookingOpened: number;
  hotLeads: number;
  booked: number;
  enrichmentRate: number;
  landingpageRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bookingOpenedRate: number;
  hotLeadRate: number;
  appointmentConversionRate: number;
};

export type ChartDatum = {
  name: string;
  value: number;
  rate?: number;
};

export type CampaignPerformanceDatum = {
  id: string;
  name: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  booked: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
};

export type ActivityTimelineDatum = {
  date: string;
  emailsSent: number;
  opened: number;
  clicked: number;
  replied: number;
  bookingOpened: number;
};

export type AnalyticsOverview = {
  kpis: AnalyticsKpis;
  funnel: ChartDatum[];
  campaignPerformance: CampaignPerformanceDatum[];
  activityTimeline: ActivityTimelineDatum[];
  engagementDistribution: ChartDatum[];
  icpDistribution: ChartDatum[];
};

export type AnalyticsInput = {
  prospects: Array<{
    id: string;
    researchStatus?: string | null;
    researchedAt?: Date | string | null;
    landingpageUrl?: string | null;
    slug?: string | null;
    isHotLead?: boolean | null;
    engagementLevel?: string | null;
    icpFitLabel?: string | null;
    icpCategory?: string | null;
  }>;
  emailLogs: Array<{
    campaignId: string;
    prospectId: string;
    status: string;
    openCount?: number | null;
    clickCount?: number | null;
    openedAt?: Date | string | null;
    clickedAt?: Date | string | null;
    repliedAt?: Date | string | null;
    sentAt?: Date | string | null;
    createdAt?: Date | string | null;
  }>;
  enrollments: Array<{
    campaignId: string;
    prospectId: string;
    repliedAt?: Date | string | null;
    bookedAt?: Date | string | null;
    createdAt?: Date | string | null;
  }>;
  events: Array<{
    prospectId: string;
    type: string;
    createdAt: Date | string;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
  }>;
};

export function buildAnalyticsOverview(input: AnalyticsInput): AnalyticsOverview {
  const totalLeads = input.prospects.length;
  const enriched = input.prospects.filter((prospect) => prospect.researchStatus === "completed" || Boolean(prospect.researchedAt)).length;
  const landingpagesCreated = input.prospects.filter((prospect) => prospect.landingpageUrl || prospect.slug).length;
  const sentLogs = input.emailLogs.filter((log) => log.status === "sent");
  const emailsSent = sentLogs.length;
  const emailOpened = sentLogs.filter((log) => (log.openCount ?? 0) > 0 || Boolean(log.openedAt)).length;
  const emailClicked = sentLogs.filter((log) => (log.clickCount ?? 0) > 0 || Boolean(log.clickedAt)).length;
  const repliedProspectIds = new Set([
    ...input.enrollments.filter((enrollment) => enrollment.repliedAt).map((enrollment) => enrollment.prospectId),
    ...sentLogs.filter((log) => log.repliedAt).map((log) => log.prospectId),
    ...input.events.filter((event) => event.type === "email_replied").map((event) => event.prospectId)
  ]);
  const bookingOpenedProspectIds = new Set(input.events.filter((event) => event.type === "booking_opened").map((event) => event.prospectId));
  const bookedProspectIds = new Set([
    ...input.enrollments.filter((enrollment) => enrollment.bookedAt).map((enrollment) => enrollment.prospectId),
    ...input.events.filter((event) => event.type === "booking_completed").map((event) => event.prospectId)
  ]);
  const hotLeads = input.prospects.filter((prospect) => prospect.isHotLead || prospect.engagementLevel === "hot").length;
  const emailReplied = repliedProspectIds.size;
  const bookingOpened = bookingOpenedProspectIds.size;
  const booked = bookedProspectIds.size;

  const kpis: AnalyticsKpis = {
    totalLeads,
    enriched,
    landingpagesCreated,
    emailsSent,
    emailOpened,
    emailClicked,
    emailReplied,
    bookingOpened,
    hotLeads,
    booked,
    enrichmentRate: rate(enriched, totalLeads),
    landingpageRate: rate(landingpagesCreated, totalLeads),
    openRate: rate(emailOpened, emailsSent),
    clickRate: rate(emailClicked, emailsSent),
    replyRate: rate(emailReplied, emailsSent),
    bookingOpenedRate: rate(bookingOpened, totalLeads),
    hotLeadRate: rate(hotLeads, totalLeads),
    appointmentConversionRate: rate(booked, totalLeads)
  };

  return {
    kpis,
    funnel: [
      { name: "Importiert", value: totalLeads, rate: rate(totalLeads, totalLeads) },
      { name: "Angereichert", value: enriched, rate: kpis.enrichmentRate },
      { name: "Landingpage erstellt", value: landingpagesCreated, rate: kpis.landingpageRate },
      { name: "E-Mail gesendet", value: emailsSent, rate: rate(emailsSent, totalLeads) },
      { name: "Geöffnet", value: emailOpened, rate: kpis.openRate },
      { name: "Geklickt", value: emailClicked, rate: kpis.clickRate },
      { name: "Geantwortet", value: emailReplied, rate: kpis.replyRate },
      { name: "Termin", value: booked, rate: kpis.appointmentConversionRate }
    ],
    campaignPerformance: input.campaigns.map((campaign) => {
      const logs = sentLogs.filter((log) => log.campaignId === campaign.id);
      const enrollments = input.enrollments.filter((enrollment) => enrollment.campaignId === campaign.id);
      const sent = logs.length;
      const opened = logs.filter((log) => (log.openCount ?? 0) > 0 || Boolean(log.openedAt)).length;
      const clicked = logs.filter((log) => (log.clickCount ?? 0) > 0 || Boolean(log.clickedAt)).length;
      const replied = new Set([
        ...enrollments.filter((enrollment) => enrollment.repliedAt).map((enrollment) => enrollment.prospectId),
        ...logs.filter((log) => log.repliedAt).map((log) => log.prospectId)
      ]).size;
      const bookedCount = new Set(enrollments.filter((enrollment) => enrollment.bookedAt).map((enrollment) => enrollment.prospectId)).size;
      return {
        id: campaign.id,
        name: campaign.name,
        sent,
        opened,
        clicked,
        replied,
        booked: bookedCount,
        openRate: rate(opened, sent),
        clickRate: rate(clicked, sent),
        replyRate: rate(replied, sent)
      };
    }),
    activityTimeline: buildActivityTimeline(input),
    engagementDistribution: ["hot", "warm", "cold"].map((level) => ({
      name: labelEngagement(level),
      value: input.prospects.filter((prospect) => (prospect.engagementLevel ?? "cold") === level).length
    })),
    icpDistribution: ["high", "medium", "low"].map((level) => ({
      name: labelIcp(level),
      value: input.prospects.filter((prospect) => (prospect.icpFitLabel ?? prospect.icpCategory ?? "low") === level).length
    }))
  };
}

export function dateFromRange(dateRange: AnalyticsDateRange = "30d", now = new Date()): Date | null {
  if (dateRange === "all") return null;
  const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function buildActivityTimeline(input: AnalyticsInput): ActivityTimelineDatum[] {
  const dates = new Map<string, ActivityTimelineDatum>();
  const row = (dateValue: Date | string | null | undefined) => {
    const key = formatDay(dateValue);
    if (!dates.has(key)) {
      dates.set(key, { date: key, emailsSent: 0, opened: 0, clicked: 0, replied: 0, bookingOpened: 0 });
    }
    return dates.get(key)!;
  };

  for (const log of input.emailLogs.filter((entry) => entry.status === "sent")) {
    row(log.sentAt ?? log.createdAt).emailsSent += 1;
    if ((log.openCount ?? 0) > 0 || log.openedAt) row(log.openedAt ?? log.sentAt ?? log.createdAt).opened += 1;
    if ((log.clickCount ?? 0) > 0 || log.clickedAt) row(log.clickedAt ?? log.sentAt ?? log.createdAt).clicked += 1;
    if (log.repliedAt) row(log.repliedAt).replied += 1;
  }
  for (const enrollment of input.enrollments) {
    if (enrollment.repliedAt) row(enrollment.repliedAt).replied += 1;
  }
  for (const event of input.events) {
    if (event.type === "booking_opened") row(event.createdAt).bookingOpened += 1;
    if (event.type === "email_replied") row(event.createdAt).replied += 1;
  }

  return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function formatDay(value: Date | string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

function labelEngagement(level: string) {
  if (level === "hot") return "Hot";
  if (level === "warm") return "Warm";
  return "Cold";
}

function labelIcp(level: string) {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}
