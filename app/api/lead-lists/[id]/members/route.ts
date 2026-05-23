import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { prospectSelectionSchema, resolveProspectSelectionIds } from "@/lib/prospect-selection";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

const membersSchema = prospectSelectionSchema.extend({
  prospectIds: z.array(z.string().min(1)).optional().default([])
});

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = membersSchema.parse(await request.json());
    const requestedProspectIds = payload.selectionMode === "allFiltered"
      ? await resolveProspectSelectionIds(payload)
      : [...(payload.prospectIds ?? []), ...(payload.ids ?? [])].filter(Boolean);
    const prospectIds = [...new Set(requestedProspectIds)];
    if (prospectIds.length === 0) throw new Error("Bitte Leads auswählen.");
    const list = await prisma.leadList.findUnique({ where: { id }, select: { id: true } });
    if (!list) return NextResponse.json({ error: "Leadliste nicht gefunden." }, { status: 404 });
    const prospects = await prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true } });
    const result = await prisma.leadListMember.createMany({
      data: prospects.map((prospect) => ({ leadListId: id, prospectId: prospect.id })),
      skipDuplicates: true
    });
    return NextResponse.json({ added: result.count, skipped: Math.max(0, requestedProspectIds.length - result.count) });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Leads konnten nicht zugewiesen werden.") }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = membersSchema.parse(await request.json());
    const requestedProspectIds = payload.selectionMode === "allFiltered"
      ? await resolveProspectSelectionIds(payload)
      : [...(payload.prospectIds ?? []), ...(payload.ids ?? [])].filter(Boolean);
    const prospectIds = [...new Set(requestedProspectIds)];
    if (prospectIds.length === 0) throw new Error("Bitte Leads auswählen.");
    const result = await prisma.leadListMember.deleteMany({ where: { leadListId: id, prospectId: { in: prospectIds } } });
    return NextResponse.json({ removed: result.count, skipped: Math.max(0, requestedProspectIds.length - result.count) });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Leads konnten nicht entfernt werden.") }, { status: 400 });
  }
}
