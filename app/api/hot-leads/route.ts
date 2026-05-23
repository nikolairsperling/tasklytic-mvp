import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { hotLeadIntentEvents, isHotLeadProspect, sortHotLeads, toHotLeadItem } from "@/lib/hot-leads";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const prospects = await prisma.prospect.findMany({
      where: {
        OR: [
          { engagementLevel: "hot" },
          { engagementScore: { gte: 50 } },
          { fitScore: { gte: 70 } },
          { icpFitScore: { gte: 70 } },
          { events: { some: { type: { in: [...hotLeadIntentEvents] } } } }
        ]
      },
      select: {
        id: true,
        companyName: true,
        city: true,
        status: true,
        decisionMakerName: true,
        firstName: true,
        lastName: true,
        engagementScore: true,
        engagementLevel: true,
        fitScore: true,
        icpFitScore: true,
        painSignals: true,
        customPainPoint: true,
        landingpageUrl: true,
        slug: true,
        decisionMakerEmail: true,
        phone: true,
        companyPhone: true,
        linkedinUrl: true,
        updatedAt: true,
        events: {
          where: { type: { in: [...hotLeadIntentEvents] } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            type: true,
            createdAt: true
          }
        }
      }
    });

    const data = sortHotLeads(prospects.filter(isHotLeadProspect).map(toHotLeadItem));
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Hot Leads konnten nicht geladen werden.") },
      { status: 500 }
    );
  }
}
