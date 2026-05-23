import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { buildContactedNoReplyWhere } from "@/lib/follow-ups";
import { prisma } from "@/lib/prisma";
import { isProspectStatus } from "@/lib/prospect-status";

export const prospectSelectionFiltersSchema = z.object({
  status: z.string().optional(),
  score: z.enum(["all", "hot", "medium", "low"]).optional(),
  q: z.string().optional(),
  leadListId: z.string().optional(),
  followUp: z.enum(["all", "due", "contacted_no_reply"]).optional()
}).default({});

export const prospectSelectionSchema = z.object({
  selectionMode: z.enum(["ids", "page", "allFiltered"]).optional().default("ids"),
  ids: z.array(z.string().trim().min(1)).optional().default([]),
  filters: prospectSelectionFiltersSchema.optional().default({})
});

export type ProspectSelectionInput = z.infer<typeof prospectSelectionSchema>;
export type ProspectSelectionFilters = z.infer<typeof prospectSelectionFiltersSchema>;

export function buildProspectWhereFromFilters(filters: ProspectSelectionFilters): Prisma.ProspectWhereInput {
  const status = filters.status;
  const score = filters.score;
  const leadListId = filters.leadListId?.trim() ?? "";
  const followUp = filters.followUp;
  const query = filters.q?.trim() ?? "";

  return {
    ...(status && status !== "all" && isProspectStatus(status) ? { status } : {}),
    ...(score === "hot" ? { isHotLead: true } : {}),
    ...(score === "medium" ? { fitScore: { gte: 40, lte: 70 } } : {}),
    ...(score === "low" ? { fitScore: { lt: 40 } } : {}),
    ...(leadListId ? { leadListMembers: { some: { leadListId } } } : {}),
    ...(followUp === "due" ? { followUpStatus: "open", followUpAt: { not: null, lte: new Date() } } : {}),
    ...(followUp === "contacted_no_reply" ? buildContactedNoReplyWhere() : {}),
    ...(query ? {
      OR: [
        { companyName: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { country: { contains: query, mode: "insensitive" } },
        { industry: { contains: query, mode: "insensitive" } },
        { painType: { contains: query, mode: "insensitive" } }
      ]
    } : {})
  };
}

export async function resolveProspectSelectionIds(input: ProspectSelectionInput, options: { maxIds?: number } = {}) {
  if (input.selectionMode === "allFiltered") {
    const rows = await prisma.prospect.findMany({
      where: buildProspectWhereFromFilters(input.filters),
      orderBy: [{ engagementScore: "desc" }, { createdAt: "desc" }],
      take: options.maxIds,
      select: { id: true }
    });
    return rows.map((row) => row.id);
  }

  const ids = [...new Set(input.ids.filter(Boolean))];
  return typeof options.maxIds === "number" ? ids.slice(0, options.maxIds) : ids;
}
