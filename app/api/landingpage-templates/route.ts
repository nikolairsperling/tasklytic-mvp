import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { defaultLandingpageTemplate } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const templates = await prisma.landingpageTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const template = await prisma.landingpageTemplate.create({
      data: {
        ...defaultLandingpageTemplate(),
        name: body.name || "Neue Landingpage Vorlage",
        isDefault: false
      }
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Template konnte nicht erstellt werden.") }, { status: 400 });
  }
}
