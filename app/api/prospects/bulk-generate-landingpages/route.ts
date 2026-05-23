import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { buildLandingpageUrl } from "@/lib/campaigns";
import { prospectSelectionSchema, resolveProspectSelectionIds } from "@/lib/prospect-selection";
import { prisma } from "@/lib/prisma";
import { generateProspectSlug } from "@/lib/slug";

const bulkLandingpageSchema = prospectSelectionSchema.extend({
  ids: z.array(z.string().min(1)).optional().default([])
});

export async function POST(request: Request) {
  try {
    const payload = bulkLandingpageSchema.parse(await request.json());
    const ids = await resolveProspectSelectionIds(payload);
    if (ids.length === 0) throw new Error("Mindestens eine ID ist erforderlich.");
    const prospects = await prisma.prospect.findMany({ where: { id: { in: ids } } });
    let generated = 0;
    let skipped = ids.length - prospects.length;
    let failed = 0;

    for (const prospect of prospects) {
      if (prospect.slug || prospect.landingpageUrl || prospect.companyStatus === "inactive" || prospect.companyStatus === "unreachable") {
        skipped += 1;
        continue;
      }
      try {
        let slug = generateProspectSlug(prospect.companyName, prospect.city);
        const existing = await prisma.prospect.findFirst({ where: { slug, NOT: { id: prospect.id } }, select: { id: true } });
        if (existing) slug = `${slug}-${prospect.id.slice(0, 6)}`;
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            landingpageUrl: buildLandingpageUrl(slug),
            slug,
            status: "landingpage_ready",
            landingpageReviewStatus: "needs_review"
          }
        });
        generated += 1;
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({ generated, skipped, failed });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Bulk Landingpage-Generierung fehlgeschlagen.") }, { status: 400 });
  }
}
