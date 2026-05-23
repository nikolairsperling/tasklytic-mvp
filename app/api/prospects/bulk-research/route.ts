import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { prospectSelectionSchema, resolveProspectSelectionIds } from "@/lib/prospect-selection";
import { enrichProspect } from "@/lib/prospect-enrichment";
import { prisma } from "@/lib/prisma";
import { classifyResearchFailure } from "@/lib/lead-research";

const bulkResearchSchema = prospectSelectionSchema.extend({
  ids: z.array(z.string().min(1)).optional().default([]),
  force: z.boolean().optional().default(false)
});

export async function POST(request: Request) {
  try {
    const payload = bulkResearchSchema.parse(await request.json());
    const ids = await resolveProspectSelectionIds(payload, { maxIds: 20 });
    if (ids.length === 0) throw new Error("Mindestens eine ID ist erforderlich.");
    const prospects = await prisma.prospect.findMany({ where: { id: { in: ids } } });
    let completed = 0;
    let skipped = ids.length - prospects.length;
    let failed = 0;
    const errors: Array<{ id: string; message: string }> = [];

    for (const prospect of prospects) {
      if (!payload.force && prospect.researchStatus === "completed" && prospect.researchedAt) {
        skipped += 1;
        continue;
      }
      try {
        await prisma.prospect.update({ where: { id: prospect.id }, data: { researchStatus: "running", lastResearchAt: new Date(), enrichmentStatus: "in_progress", enrichmentUpdatedAt: new Date() } });
        const result = await enrichProspect(prospect);
        if (result.status === "website_unreachable" || result.status === "cookie_banner_blocked" || result.status === "failed") {
          failed += 1;
          errors.push({ id: prospect.id, message: result.notes?.join("\n") || "Website konnte nicht abgerufen werden" });
        } else {
          completed += 1;
        }
      } catch (error) {
        const failure = classifyResearchFailure(error);
        failed += 1;
        errors.push({ id: prospect.id, message: failure.message });
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            researchStatus: failure.status,
            lastResearchAt: new Date(),
            lastAttemptAt: new Date(),
            lastResearchError: failure.message,
            lastResearchErrorCode: failure.code,
            failedStep: failure.failedStep,
            sourceUrl: failure.sourceUrl ?? prospect.websiteUrl,
            enrichmentStatus: failure.status === "partial" ? "partial" : "failed",
            enrichmentUpdatedAt: new Date(),
            enrichmentNotes: failure.message
          }
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ total: ids.length, processed: prospects.length, completed, skipped, failed, errors });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Bulk Research fehlgeschlagen.") }, { status: 400 });
  }
}
