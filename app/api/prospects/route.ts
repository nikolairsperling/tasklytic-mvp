import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/api";
import { buildContactedNoReplyWhere } from "@/lib/follow-ups";
import { createClickUpTaskForLeadSafe } from "@/lib/integrations";
import { buildPagination, parseProspectPaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { parseProspectPayload } from "@/lib/prospects";
import { isProspectStatus } from "@/lib/prospect-status";
import { calculateProspectScore } from "@/lib/scoring";
import { buildDashboardProspectWhere, parseDashboardProspectFilter } from "@/lib/dashboard-filters";
import { evaluateAiCallReadiness } from "@/lib/ai-calls";
import { shouldRecommendPrintMailing } from "@/lib/report-assets";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, take } = parseProspectPaginationParams(searchParams);
    const status = searchParams.get("status");
    const score = searchParams.get("score");
    const leadListId = searchParams.get("leadListId")?.trim() ?? "";
    const followUp = searchParams.get("followUp");
    const dashboardFilter = parseDashboardProspectFilter(searchParams.get("dashboardFilter"));
    const query = searchParams.get("q")?.trim() ?? "";
    const where: Prisma.ProspectWhereInput = {
      ...(status && status !== "all" && isProspectStatus(status) ? { status } : {}),
      ...(score === "hot" ? { isHotLead: true } : {}),
      ...(score === "medium" ? { fitScore: { gte: 40, lte: 70 } } : {}),
      ...(score === "low" ? { fitScore: { lt: 40 } } : {}),
      ...(leadListId ? { leadListMembers: { some: { leadListId } } } : {}),
      ...buildDashboardProspectWhere(dashboardFilter),
      ...(followUp === "due" ? { followUpStatus: "open", followUpAt: { not: null, lte: new Date() } } : {}),
      ...(followUp === "contacted_no_reply" ? buildContactedNoReplyWhere() : {}),
      ...(query ? {
        OR: [
          { companyName: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { country: { contains: query, mode: "insensitive" } },
          { industry: { contains: query, mode: "insensitive" } },
          { painType: { contains: query, mode: "insensitive" } }
        ]
      } : {})
    };

    const [prospects, total, totalProspects] = await prisma.$transaction([
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
            where: { type: { in: ["video_watched", "video_started", "page_view", "cta_clicked", "booking_opened", "booking_completed"] } },
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
      prisma.prospect.count()
    ]);

    const activeFilters = {
      ...(status && status !== "all" && isProspectStatus(status) ? { status } : {}),
      ...(score ? { score } : {}),
      ...(leadListId ? { leadListId } : {}),
      ...(followUp ? { followUp } : {}),
      ...(dashboardFilter ? { dashboardFilter } : {}),
      ...(query ? { q: query } : {})
    };

    console.info("[prospects:list]", {
      count: prospects.length,
      totalProspects,
      filteredProspects: total,
      activeFilters,
      limit,
      page
    });

    return NextResponse.json({
      data: prospects.map((prospect) => {
        const aiCall = evaluateAiCallReadiness(prospect);
        return {
          ...prospect,
          targetGroupId: prospect.targetGroup?.id ?? null,
          targetGroupName: prospect.targetGroup?.name ?? null,
          aiCallStatus: aiCall.status,
          aiCallRecommended: aiCall.recommended,
          aiCallPriority: aiCall.priority,
          aiCallPlannedFor: aiCall.plannedFor?.toISOString() ?? null,
          aiCallBlockers: aiCall.blockers,
          printMailingRecommended: shouldRecommendPrintMailing(prospect)
        };
      }),
      totalProspects,
      filteredProspects: total,
      pagination: buildPagination(page, limit, total)
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Prospects konnten nicht geladen werden.") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = parseProspectPayload(body);
    const prospect = await prisma.prospect.create({ data: { ...payload, ...calculateProspectScore(payload) } as Prisma.ProspectUncheckedCreateInput });
    await createClickUpTaskForLeadSafe(prospect);

    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Ungültige Anfrage")
      },
      { status: 400 }
    );
  }
}
