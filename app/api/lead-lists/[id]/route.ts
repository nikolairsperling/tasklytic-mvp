import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

const leadListUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  targetGroupId: z.string().trim().optional().nullable()
});

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const list = await prisma.leadList.findUnique({
      where: { id },
      include: {
        targetGroup: { select: { id: true, name: true } },
        members: {
          orderBy: { createdAt: "desc" },
          include: { prospect: { select: { id: true, companyName: true, decisionMakerName: true, companyEmail: true, decisionMakerEmail: true, status: true } } }
        }
      }
    });
    if (!list) return NextResponse.json({ error: "Leadliste nicht gefunden." }, { status: 404 });
    return NextResponse.json(list);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Leadliste konnte nicht geladen werden.") }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = leadListUpdateSchema.parse(await request.json());
    const list = await prisma.leadList.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description || null } : {}),
        ...(payload.targetGroupId !== undefined ? { targetGroupId: payload.targetGroupId || null } : {})
      },
      include: { targetGroup: { select: { id: true, name: true } }, _count: { select: { members: true } } }
    });
    return NextResponse.json(list);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Leadliste konnte nicht gespeichert werden.") }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    await prisma.leadList.delete({ where: { id } });
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Leadliste konnte nicht gelöscht werden.") }, { status: 400 });
  }
}
