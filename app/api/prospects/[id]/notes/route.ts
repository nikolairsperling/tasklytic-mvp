import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const noteSchema = z.object({
  text: z.string().trim().min(1).max(4000)
});

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const { text } = noteSchema.parse(await request.json());
    const prospect = await prisma.prospect.findUnique({ where: { id }, select: { id: true } });
    if (!prospect) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    const note = await prisma.prospectNote.create({
      data: { prospectId: id, text }
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Notiz konnte nicht gespeichert werden.") },
      { status: 400 }
    );
  }
}
