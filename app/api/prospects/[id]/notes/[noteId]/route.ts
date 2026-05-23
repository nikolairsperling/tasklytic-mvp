import { NextResponse } from "next/server";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string; noteId: string }>;
};

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    const { id, noteId } = await params;
    const note = await prisma.prospectNote.findFirst({
      where: { id: noteId, prospectId: id },
      select: { id: true }
    });
    if (!note) {
      return NextResponse.json({ error: "Notiz nicht gefunden" }, { status: 404 });
    }

    await prisma.prospectNote.delete({ where: { id: noteId } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Notiz nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(
      { error: getErrorMessage(error, "Notiz konnte nicht gelöscht werden.") },
      { status: 400 }
    );
  }
}
