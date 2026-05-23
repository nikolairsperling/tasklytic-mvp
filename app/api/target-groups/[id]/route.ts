import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recalculateProspectsForTargetGroup } from "@/lib/prospect-recalculate";
import { parseTargetGroupPayload } from "@/lib/target-groups";

type RouteProps = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = parseTargetGroupPayload(await request.json());
    const targetGroup = await prisma.targetGroup.update({
      where: { id },
      data: payload as Prisma.TargetGroupUncheckedUpdateInput
    });
    await recalculateProspectsForTargetGroup(id);
    return NextResponse.json(targetGroup);
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Zielgruppe nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Zielgruppe konnte nicht gespeichert werden.") }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    await prisma.targetGroup.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Zielgruppe nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Zielgruppe konnte nicht gelöscht werden.") }, { status: 400 });
  }
}
