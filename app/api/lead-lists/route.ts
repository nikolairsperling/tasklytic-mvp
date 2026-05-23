import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const leadListSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  targetGroupId: z.string().trim().optional().nullable()
});

export async function GET() {
  try {
    const lists = await prisma.leadList.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        targetGroup: { select: { id: true, name: true } },
        _count: { select: { members: true } }
      }
    });
    return NextResponse.json({ data: lists });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Leadlisten konnten nicht geladen werden.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = leadListSchema.parse(await request.json());
    const list = await prisma.leadList.create({
      data: {
        name: payload.name,
        description: payload.description || null,
        targetGroupId: payload.targetGroupId || null
      },
      include: { targetGroup: { select: { id: true, name: true } }, _count: { select: { members: true } } }
    });
    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Leadliste konnte nicht erstellt werden.") }, { status: 400 });
  }
}
