import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recalculateProspect } from "@/lib/prospect-recalculate";

type RouteProps = { params: Promise<{ id: string }> };

const prospectDetailInclude = {
  notes: { orderBy: { createdAt: "desc" } },
  events: { orderBy: { createdAt: "desc" }, take: 100 },
  campaignEnrollments: {
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, name: true, status: true } }
    }
  },
  targetGroup: { select: { id: true, name: true } }
} satisfies Prisma.ProspectInclude;

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const result = await recalculateProspect(id);
    const prospect = await prisma.prospect.findUniqueOrThrow({
      where: { id: result.prospect.id },
      include: prospectDetailInclude
    });

    return NextResponse.json({
      ...prospect,
      suggestedCampaignId: result.suggestedCampaignId,
      suggestedCampaignTemplateId: result.suggestedCampaignTemplateId
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(
      { error: getErrorMessage(error, "Analyse konnte nicht aktualisiert werden.") },
      { status: 400 }
    );
  }
}
