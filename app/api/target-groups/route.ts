import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseTargetGroupPayload } from "@/lib/target-groups";

export async function GET() {
  return NextResponse.json(await prisma.targetGroup.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function POST(request: Request) {
  try {
    const payload = parseTargetGroupPayload(await request.json());
    const targetGroup = await prisma.targetGroup.create({ data: payload as Prisma.TargetGroupUncheckedCreateInput });
    return NextResponse.json(targetGroup, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Zielgruppe konnte nicht erstellt werden.") }, { status: 400 });
  }
}
