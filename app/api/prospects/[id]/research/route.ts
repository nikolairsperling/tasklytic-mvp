import { NextResponse } from "next/server";
import { buildResearchUpdate, classifyResearchFailure, researchProspect, toResearchResponse } from "@/lib/lead-research";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const prospect = await prisma.prospect.findUnique({ where: { id } });
    if (!prospect) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }
    if (!prospect.websiteUrl) {
      const now = new Date();
      const updated = await prisma.prospect.update({
        where: { id },
        data: {
          researchStatus: "no_website",
          lastResearchAt: now,
          lastAttemptAt: now,
          lastResearchError: "Keine Website vorhanden",
          lastResearchErrorCode: "NO_WEBSITE",
          failedStep: "website_fetch",
          sourceUrl: prospect.websiteUrl,
          enrichmentNotes: "Keine Website vorhanden"
        }
      });
      return NextResponse.json({ ...toResearchResponse(updated), error: "Keine Website vorhanden" }, { status: 400 });
    }
    if (!body.force && prospect.researchStatus === "completed" && prospect.researchedAt) {
      return NextResponse.json(toResearchResponse(prospect));
    }

    await prisma.prospect.update({ where: { id }, data: { researchStatus: "running", lastResearchAt: new Date() } });
    const result = await researchProspect(prospect);
    const { updatedFields, ...data } = buildResearchUpdate(prospect, result);
    const updated = await prisma.prospect.update({
      where: { id },
      data
    });

    return NextResponse.json({ ...toResearchResponse(updated), updatedFields, updatedFieldCount: updatedFields.length });
  } catch (error) {
    const { id } = await params;
    const failure = classifyResearchFailure(error);
    await prisma.prospect.update({
      where: { id },
      data: {
        researchStatus: failure.status,
        lastResearchAt: new Date(),
        lastAttemptAt: new Date(),
        lastResearchError: failure.message,
        lastResearchErrorCode: failure.code,
        failedStep: failure.failedStep,
        sourceUrl: failure.sourceUrl ?? null,
        enrichmentStatus: failure.status === "partial" ? "partial" : "failed",
        enrichmentUpdatedAt: new Date(),
        enrichmentNotes: failure.message
      }
    }).catch(() => undefined);
    return NextResponse.json(
      { error: failure.message, errorCode: failure.code, researchStatus: failure.status, failedStep: failure.failedStep, sourceUrl: failure.sourceUrl ?? null, lastAttemptAt: new Date().toISOString() },
      { status: 400 }
    );
  }
}
