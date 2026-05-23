import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const nullableText = z.union([z.string(), z.null()]).transform((value) => {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
});

const followUpSchema = z.object({
  followUpAt: z.union([z.string().datetime(), z.literal(""), z.null()]).transform((value) => value ? new Date(value) : null).optional(),
  followUpReason: nullableText.optional(),
  followUpStatus: z.enum(["open", "done", "snoozed", "dismissed"]).optional()
}).strict();

const prospectDetailInclude = {
  notes: { orderBy: { createdAt: "desc" } },
  events: { orderBy: { createdAt: "desc" }, take: 100 },
  campaignEnrollments: {
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, name: true, status: true, offerId: true, targetGroupId: true, offer: { select: { id: true, name: true } } } }
    }
  },
  targetGroup: { select: { id: true, name: true } },
  suggestedOffer: { select: { id: true, name: true } }
} satisfies Prisma.ProspectInclude;

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = followUpSchema.parse(await request.json());
    const current = await prisma.prospect.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    await prisma.prospect.update({
      where: { id },
      data: {
        ...(body.followUpAt !== undefined ? { followUpAt: body.followUpAt } : {}),
        ...(body.followUpReason !== undefined ? { followUpReason: body.followUpReason } : {}),
        ...(body.followUpStatus !== undefined ? { followUpStatus: body.followUpStatus } : {})
      }
    });

    const prospect = await prisma.prospect.findUniqueOrThrow({
      where: { id },
      include: prospectDetailInclude
    });

    return NextResponse.json(prospect);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Wiedervorlage konnte nicht gespeichert werden.") }, { status: 400 });
  }
}
