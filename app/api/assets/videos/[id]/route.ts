import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deleteVideoAsset, sanitizeVideoName } from "@/lib/video-assets";

type P = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: P) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = sanitizeVideoName(typeof body.name === "string" ? body.name : body.filename);
    if (!name) throw new Error("Name fehlt.");
    return NextResponse.json(await prisma.videoAsset.update({ where: { id }, data: { name } }));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Video konnte nicht gespeichert werden.") }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: P) {
  try {
    const { id } = await params;
    await deleteVideoAsset(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Video konnte nicht gelöscht werden.") }, { status: 400 });
  }
}
