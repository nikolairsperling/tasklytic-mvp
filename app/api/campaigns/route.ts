import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { createCampaign, parseCampaignPayload } from "@/lib/campaigns";
import { buildDashboardCampaignWhere, parseDashboardCampaignFilter } from "@/lib/dashboard-filters";
import { buildPagination, parsePaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, take } = parsePaginationParams(searchParams);
    const dashboardFilter = parseDashboardCampaignFilter(searchParams.get("dashboardFilter"));
    const where = buildDashboardCampaignWhere({
      status: searchParams.get("status"),
      hasSent: searchParams.get("hasSent"),
      dashboardFilter
    });
    const [campaigns, total] = await prisma.$transaction([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          steps: { orderBy: { stepNumber: "asc" } },
          emailVariants: { orderBy: { label: "asc" } },
          enrollments: true,
          sendLogs: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
              prospect: {
                select: { companyName: true }
              },
              step: {
                select: { stepNumber: true }
              }
            },
          },
        }
      }),
      prisma.campaign.count({ where })
    ]);

    return NextResponse.json({
      data: campaigns,
      pagination: buildPagination(page, limit, total)
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Kampagnen konnten nicht geladen werden.") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = parseCampaignPayload(body);
    const campaign = await createCampaign(payload);
    console.info("CAMPAIGN_CREATE", {
      campaignId: campaign.id,
      offerId: campaign.offerId,
      targetGroupId: campaign.targetGroupId ?? null,
      selectedProspectId: campaign.selectedProspectId ?? null,
      stepsCount: payload.steps.length
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Kampagne konnte nicht erstellt werden.") },
      { status: 400 }
    );
  }
}
