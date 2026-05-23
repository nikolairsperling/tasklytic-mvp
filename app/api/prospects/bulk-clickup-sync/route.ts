import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { syncProspectsToClickUp } from "@/lib/integrations";
import { prospectSelectionSchema, resolveProspectSelectionIds } from "@/lib/prospect-selection";
import { prisma } from "@/lib/prisma";

const clickUpSyncSchema = prospectSelectionSchema.extend({
  checkDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(true),
  appendComment: z.boolean().default(true),
  onlyCampaignReady: z.boolean().default(true)
});

export async function POST(request: Request) {
  try {
    const payload = clickUpSyncSchema.parse(await request.json());
    const ids = await resolveProspectSelectionIds(payload, { maxIds: 500 });
    if (ids.length === 0) throw new Error("Mindestens eine ID ist erforderlich.");
    const prospects = await prisma.prospect.findMany({
      where: { id: { in: ids } },
      include: {
        campaignEnrollments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { campaign: { select: { name: true } } }
        },
        notes: { orderBy: { createdAt: "desc" }, take: 1, select: { text: true, createdAt: true } }
      }
    });
    const result = await syncProspectsToClickUp(prospects, {
      checkDuplicates: payload.checkDuplicates,
      updateExisting: payload.updateExisting,
      appendComment: payload.appendComment,
      onlyCampaignReady: payload.onlyCampaignReady
    });
    return NextResponse.json({ total: ids.length, processed: prospects.length, skippedMissing: ids.length - prospects.length, ...result });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "ClickUp Sync fehlgeschlagen.") }, { status: 400 });
  }
}
