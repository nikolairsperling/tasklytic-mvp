import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { normalizeImpactJobPayload, runLandingpageImpactJob } from "@/lib/impact";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.impactJob.findMany({
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { id: true, name: true } } }
  });
  return NextResponse.json(jobs);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.type === "landingpage" && (Array.isArray(body.prospectIds) || body.runNow)) {
      const job = await runLandingpageImpactJob({
        name: body.name,
        campaignId: body.campaignId,
        prospectIds: Array.isArray(body.prospectIds) ? body.prospectIds : undefined,
        landingpageTemplateId: body.landingpageTemplateId
      });
      return NextResponse.json(job, { status: 201 });
    }
    const job = await prisma.impactJob.create({ data: normalizeImpactJobPayload(body) });
    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Impact Job konnte nicht erstellt werden.") }, { status: 400 });
  }
}
