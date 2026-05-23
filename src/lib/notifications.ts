import { prisma } from "@/lib/prisma";

export type NotificationInput = {
  type: string;
  title: string;
  body: string;
  url?: string | null;
};

export async function createNotificationEvent(input: NotificationInput) {
  return prisma.notificationEvent.create({
    data: {
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url ?? null
    }
  });
}

export async function getNotificationCenterData() {
  const now = new Date();
  const [stored, unreadCount, dismissals, replies, hotLeads, dueFollowUps, campaignErrors] = await Promise.all([
    prisma.notificationEvent.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notificationEvent.count({ where: { read: false, deletedAt: null } }),
    prisma.notificationDismissal.findMany({ select: { notificationId: true } }),
    prisma.inboundEmail.findMany({
      orderBy: { receivedAt: "desc" },
      take: 5,
      include: { matchedProspect: { select: { id: true, companyName: true } } }
    }),
    prisma.prospect.findMany({
      where: { isHotLead: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
      select: { id: true, companyName: true, totalScore: true, updatedAt: true }
    }),
    prisma.prospect.findMany({
      where: { followUpStatus: "open", followUpAt: { not: null, lte: now } },
      orderBy: { followUpAt: "asc" },
      take: 5,
      select: { id: true, companyName: true, followUpAt: true, followUpReason: true }
    }),
    prisma.campaign.findMany({
      where: { OR: [{ sendingStatus: "failed" }, { status: "paused" }] },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, sendingStatus: true, status: true, updatedAt: true }
    })
  ]);

  const dismissedIds = new Set(dismissals.map((item) => item.notificationId));
  const derived = [
    ...replies.map((email) => ({
      id: `reply-${email.id}`,
      type: "email_reply",
      title: "Neue Antwort",
      body: email.matchedProspect?.companyName ? `${email.matchedProspect.companyName} hat geantwortet.` : email.subject,
      url: email.matchedProspectId ? `/admin/prospects?prospectId=${email.matchedProspectId}` : "/admin/inbox",
      read: email.status !== "unread",
      createdAt: email.receivedAt
    })),
    ...hotLeads.map((lead) => ({
      id: `hot-${lead.id}`,
      type: "hot_lead",
      title: "Neuer Hot Lead",
      body: `${lead.companyName} hat Score ${lead.totalScore}.`,
      url: `/admin/prospects?prospectId=${lead.id}`,
      read: false,
      createdAt: lead.updatedAt
    })),
    ...dueFollowUps.map((lead) => ({
      id: `follow-${lead.id}`,
      type: "follow_up_due",
      title: "Follow-up fällig",
      body: `${lead.companyName}${lead.followUpReason ? ` · ${lead.followUpReason}` : ""}`,
      url: `/admin/prospects?prospectId=${lead.id}`,
      read: false,
      createdAt: lead.followUpAt ?? now
    })),
    ...campaignErrors.map((campaign) => ({
      id: `campaign-${campaign.id}`,
      type: "campaign_status",
      title: campaign.sendingStatus === "failed" ? "Fehler bei Kampagne" : "Kampagne pausiert",
      body: campaign.name,
      url: `/admin/campaigns`,
      read: false,
      createdAt: campaign.updatedAt
    }))
  ].filter((item) => !dismissedIds.has(item.id));

  const storedItems = stored.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    url: item.url,
    read: item.read,
    createdAt: item.createdAt
  }));

  const items = [...storedItems, ...derived]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40);

  return {
    unreadCount: unreadCount + derived.filter((item) => !item.read).length,
    items
  };
}
