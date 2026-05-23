import { NextResponse } from "next/server";
import { normalizeCategory, normalizeChannel, normalizeStatus, scoreMessageTemplate } from "@/lib/message-templates";
import { prisma } from "@/lib/prisma";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function templateData(body: Record<string, unknown>) {
  const bodyText = stringValue(body.bodyText);
  const quality = scoreMessageTemplate({
    bodyText,
    targetAudience: stringValue(body.targetAudience),
    category: normalizeCategory(body.category)
  });

  return {
    name: stringValue(body.name),
    channel: normalizeChannel(body.channel),
    category: normalizeCategory(body.category),
    status: normalizeStatus(body.status),
    subject: stringValue(body.subject) || null,
    targetAudience: stringValue(body.targetAudience) || null,
    tone: stringValue(body.tone) || null,
    bodyText,
    qualityScore: quality.total,
    qualityJson: quality
  };
}

export async function GET() {
  return NextResponse.json(await prisma.messageTemplate.findMany({ orderBy: { updatedAt: "desc" } }));
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const data = templateData(body);
  if (!data.name) return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  if (!data.bodyText) return NextResponse.json({ error: "Text ist erforderlich." }, { status: 400 });
  const template = await prisma.messageTemplate.create({ data });
  return NextResponse.json(template, { status: 201 });
}
