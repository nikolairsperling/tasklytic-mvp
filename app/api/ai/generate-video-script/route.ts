import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateVideoScript } from "@/lib/video";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prospect = await prisma.prospect.findUnique({ where: { id: String(body.prospectId || "") } });
    if (!prospect) return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    const scriptText = await generateVideoScript(prospect, {
      tone: body.tone,
      maxSeconds: Number(body.maxSeconds || 60)
    });
    return NextResponse.json({ scriptText });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Video-Skript konnte nicht erzeugt werden.") }, { status: 400 });
  }
}
