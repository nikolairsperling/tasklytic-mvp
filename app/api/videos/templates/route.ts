import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { videoTemplateData } from "@/lib/video";

export async function GET() {
  const templates = await prisma.videoTemplate.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const template = await prisma.videoTemplate.create({ data: videoTemplateData(body) });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Video Template konnte nicht erstellt werden.") }, { status: 400 });
  }
}
