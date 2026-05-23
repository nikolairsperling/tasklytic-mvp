import { NextResponse } from "next/server";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { videoTemplateData } from "@/lib/video";

type RouteProps = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = await request.json();
    const template = await prisma.videoTemplate.update({ where: { id }, data: videoTemplateData(body) });
    return NextResponse.json(template);
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Video Template nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Video Template konnte nicht gespeichert werden.") }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    await prisma.videoTemplate.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Video Template nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Video Template konnte nicht gelöscht werden.") }, { status: 400 });
  }
}
