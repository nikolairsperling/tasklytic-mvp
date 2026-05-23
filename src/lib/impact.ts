import type { ImpactJob, Prisma, Prospect } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateProspectSlug } from "@/lib/slug";

type ImpactPrisma = Pick<typeof prisma, "impactJob" | "prospect" | "campaignEnrollment">;

export const impactJobStatuses = ["pending", "running", "completed", "failed"] as const;
export const impactJobTypes = ["landingpage", "video", "letter"] as const;

export function impactProgress(job: Pick<ImpactJob, "totalItems" | "processedItems">) {
  if (job.totalItems <= 0) return 0;
  return Math.min(100, Math.round((job.processedItems / job.totalItems) * 100));
}

export function formatImpactProgress(job: Pick<ImpactJob, "totalItems" | "processedItems">) {
  return `${job.processedItems}/${job.totalItems} Leads`;
}

export function isImpactJobStatus(value: unknown): value is (typeof impactJobStatuses)[number] {
  return typeof value === "string" && impactJobStatuses.includes(value as (typeof impactJobStatuses)[number]);
}

export function isImpactJobType(value: unknown): value is (typeof impactJobTypes)[number] {
  return typeof value === "string" && impactJobTypes.includes(value as (typeof impactJobTypes)[number]);
}

export function normalizeImpactJobPayload(body: Record<string, unknown>): Prisma.ImpactJobUncheckedCreateInput {
  return {
    type: isImpactJobType(body.type) ? body.type : "landingpage",
    name: String(body.name || "Impact Job"),
    campaignId: typeof body.campaignId === "string" && body.campaignId ? body.campaignId : undefined,
    status: isImpactJobStatus(body.status) ? body.status : "pending",
    totalItems: Number(body.totalItems ?? 0),
    processedItems: Number(body.processedItems ?? 0),
    creditsUsed: Number(body.creditsUsed ?? 0),
    resultJson: body.resultJson as Prisma.InputJsonValue | undefined,
    errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : undefined
  };
}

export async function ensureProspectLandingpageSlug(prospect: Pick<Prospect, "id" | "companyName" | "city" | "slug">, db: ImpactPrisma = prisma) {
  if (prospect.slug) return prospect.slug;
  let slug = generateProspectSlug(prospect.companyName, prospect.city);
  const existing = await db.prospect.findFirst({ where: { slug, NOT: { id: prospect.id } } });
  if (existing) slug = `${slug}-${prospect.id.slice(0, 6)}`;
  await db.prospect.update({
    where: { id: prospect.id },
    data: { slug, status: "landingpage_ready" }
  });
  return slug;
}

export async function runLandingpageImpactJob(input: {
  name?: string;
  campaignId?: string | null;
  prospectIds?: string[];
  landingpageTemplateId?: string | null;
}, db: ImpactPrisma = prisma) {
  const prospectIds = input.prospectIds?.filter(Boolean) ?? [];
  const prospects = prospectIds.length > 0
    ? await db.prospect.findMany({ where: { id: { in: prospectIds } } })
    : input.campaignId
      ? (await db.campaignEnrollment.findMany({
          where: { campaignId: input.campaignId },
          include: { prospect: true }
        })).map((enrollment) => enrollment.prospect)
      : [];

  const job = await db.impactJob.create({
    data: {
      type: "landingpage",
      name: input.name || "Personalisierte Landingpages",
      campaignId: input.campaignId || undefined,
      status: "running",
      totalItems: prospects.length,
      processedItems: 0,
      creditsUsed: 0
    }
  });

  const results: Array<{ prospectId: string; slug: string }> = [];
  for (const prospect of prospects) {
    const slug = await ensureProspectLandingpageSlug(prospect, db);
    if (input.landingpageTemplateId) {
      await db.prospect.update({ where: { id: prospect.id }, data: { landingpageTemplateId: input.landingpageTemplateId } });
    }
    results.push({ prospectId: prospect.id, slug });
  }

  return db.impactJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      processedItems: results.length,
      resultJson: results
    }
  });
}
