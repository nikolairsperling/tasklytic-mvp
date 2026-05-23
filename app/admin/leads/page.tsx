import { LeadOverview } from "@/components/admin/lead-overview";
import { leadActivityTypes, toLeadListItem } from "@/lib/leads";
import { buildPagination, parseProspectPaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminLeadsPageProps = {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
  }>;
};

export default async function AdminLeadsPage({ searchParams }: AdminLeadsPageProps) {
  const params = (await searchParams) ?? {};
  const { page, limit, skip, take } = parseProspectPaginationParams(new URLSearchParams({
    ...(params.page ? { page: params.page } : {}),
    ...(params.limit ? { limit: params.limit } : {})
  }));

  const [prospects, totalProspects, targetGroups, offers, emailTemplates, campaigns, leadLists] = await Promise.all([
    prisma.prospect.findMany({
      orderBy: [{ engagementScore: "desc" }, { updatedAt: "desc" }],
      skip,
      take,
      select: {
        id: true,
        companyName: true,
        decisionMakerName: true,
        firstName: true,
        lastName: true,
        status: true,
        leadStatus: true,
        icpFitScore: true,
        icpFitLabel: true,
        industry: true,
        painType: true,
        engagementLevel: true,
        engagementScore: true,
        decisionMakerEmail: true,
        companyEmail: true,
        landingpageUrl: true,
        landingpageReviewStatus: true,
        slug: true,
        events: {
          where: { type: { in: [...leadActivityTypes] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            type: true,
            createdAt: true
          }
        }
      }
    }),
    prisma.prospect.count(),
    prisma.targetGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.offer.findMany({ where: { workspaceId: "default" }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { id: true, name: true, targetGroupId: true, isDefault: true } }),
    prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, subject: true, body: true } }),
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true } }),
    prisma.leadList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, targetGroupId: true, _count: { select: { members: true } } } })
  ]);

  const templates = emailTemplates.map((template) => ({ ...template, bodyText: template.body }));

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <LeadOverview initialLeads={prospects.map(toLeadListItem)} pagination={buildPagination(page, limit, totalProspects)} campaigns={campaigns} targetGroups={targetGroups} offers={offers} templates={templates} leadLists={leadLists.map((list) => ({ id: list.id, name: list.name, targetGroupId: list.targetGroupId, count: list._count.members }))} />
    </div>
  );
}
