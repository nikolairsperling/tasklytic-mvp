import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isProspectStatus, type ProspectStatus } from "@/lib/prospect-status";

type ActiveFilters = {
  targetGroupId?: string;
  includeUntargeted?: boolean;
  icpScore?: string;
  engagement?: string;
  status?: ProspectStatus;
  painType?: string;
  q?: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeFilters = parseActiveFilters(searchParams);
    const where = buildLeadPickerWhere(activeFilters);

    const [prospects, totalProspects, filteredProspects] = await prisma.$transaction([
      prisma.prospect.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          decisionMakerName: true,
          city: true,
          targetGroupId: true,
          targetGroup: { select: { id: true, name: true } },
          icpFitScore: true,
          icpFitLabel: true,
          icpScore: true,
          fitScore: true,
          totalScore: true,
          icpCategory: true,
          engagementLevel: true,
          status: true,
          leadStatus: true,
          painType: true,
          painSignals: true,
          companyEmail: true,
          decisionMakerEmail: true,
          slug: true,
          landingpageUrl: true,
          landingpageReviewStatus: true,
          videoUrl: true
        },
        orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }]
      }),
      prisma.prospect.count(),
      prisma.prospect.count({ where })
    ]);

    console.info("[campaigns:lead-picker]", {
      totalProspects,
      filteredProspects,
      activeFilters
    });

    return NextResponse.json({
      data: prospects.map((prospect) => ({
        id: prospect.id,
        companyName: prospect.companyName,
        decisionMakerName: prospect.decisionMakerName,
        city: prospect.city,
        targetGroupId: prospect.targetGroupId,
        targetGroupName: prospect.targetGroup?.name ?? null,
        icpFitScore: prospect.icpFitScore,
        icpFitLabel: prospect.icpFitLabel,
        icpScore: prospect.icpScore,
        fitScore: prospect.fitScore,
        totalScore: prospect.totalScore,
        icpCategory: prospect.icpCategory,
        engagementLevel: prospect.engagementLevel,
        status: prospect.status,
        leadStatus: prospect.leadStatus,
        painType: prospect.painType,
        painSignals: Array.isArray(prospect.painSignals) ? prospect.painSignals : [],
        companyEmail: prospect.companyEmail,
        decisionMakerEmail: prospect.decisionMakerEmail,
        slug: prospect.slug,
        landingpageUrl: prospect.landingpageUrl,
        landingpageReviewStatus: prospect.landingpageReviewStatus,
        videoUrl: prospect.videoUrl
      })),
      totalProspects,
      filteredProspects
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Lead Picker konnte nicht geladen werden.") },
      { status: 500 }
    );
  }
}

function parseActiveFilters(searchParams: URLSearchParams): ActiveFilters {
  const filters: ActiveFilters = {};
  const targetGroupId = searchParams.get("targetGroupId")?.trim();
  const icpScore = searchParams.get("icpScore")?.trim();
  const engagement = searchParams.get("engagement")?.trim();
  const status = searchParams.get("status")?.trim();
  const painType = searchParams.get("painType")?.trim();
  const q = searchParams.get("q")?.trim();

  if (targetGroupId) {
    filters.targetGroupId = targetGroupId;
    filters.includeUntargeted = searchParams.get("includeUntargeted") === "true";
  }
  if (icpScore) filters.icpScore = icpScore;
  if (engagement) filters.engagement = engagement;
  if (status && isProspectStatus(status)) filters.status = status;
  if (painType) filters.painType = painType;
  if (q) filters.q = q;
  return filters;
}

function buildLeadPickerWhere(filters: ActiveFilters): Prisma.ProspectWhereInput {
  const clauses: Prisma.ProspectWhereInput[] = [];

  if (filters.targetGroupId) {
    clauses.push(
      filters.includeUntargeted
        ? { OR: [{ targetGroupId: filters.targetGroupId }, { targetGroupId: null }] }
        : { targetGroupId: filters.targetGroupId }
    );
  }
  if (filters.icpScore === "70") clauses.push({ icpFitScore: { gte: 70 } });
  if (filters.icpScore === "40") clauses.push({ icpFitScore: { gte: 40, lt: 70 } });
  if (filters.icpScore === "0") clauses.push({ icpFitScore: { lt: 40 } });
  if (filters.engagement) clauses.push({ engagementLevel: filters.engagement });
  if (filters.status) clauses.push({ status: filters.status });
  if (filters.painType) clauses.push({ painType: filters.painType });
  if (filters.q) {
    clauses.push({
      OR: [
        { companyName: { contains: filters.q, mode: "insensitive" } },
        { city: { contains: filters.q, mode: "insensitive" } },
        { decisionMakerName: { contains: filters.q, mode: "insensitive" } },
        { decisionMakerEmail: { contains: filters.q, mode: "insensitive" } },
        { companyEmail: { contains: filters.q, mode: "insensitive" } }
      ]
    });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}
