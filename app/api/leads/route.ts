import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { leadActivityTypes, toLeadListItem } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: [{ engagementScore: "desc" }, { updatedAt: "desc" }],
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
    });

    return NextResponse.json({
      data: prospects.map(toLeadListItem)
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Leads konnten nicht geladen werden.") },
      { status: 500 }
    );
  }
}
