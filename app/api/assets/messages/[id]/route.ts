import { NextResponse } from "next/server";
import { normalizeCategory, normalizeChannel, normalizeStatus, scoreMessageTemplate } from "@/lib/message-templates";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const current = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });
  const body = await request.json() as Record<string, unknown>;
  const bodyText = "bodyText" in body ? stringValue(body.bodyText) : current.bodyText;
  const targetAudience = "targetAudience" in body ? stringValue(body.targetAudience) || null : current.targetAudience;
  const category = "category" in body ? normalizeCategory(body.category) : normalizeCategory(current.category);
  const quality = scoreMessageTemplate({ bodyText, targetAudience, category });

  const updated = await prisma.messageTemplate.update({
    where: { id },
    data: {
      name: "name" in body ? stringValue(body.name) || current.name : current.name,
      channel: "channel" in body ? normalizeChannel(body.channel) : current.channel,
      category,
      status: "status" in body ? normalizeStatus(body.status) : current.status,
      subject: "subject" in body ? stringValue(body.subject) || null : current.subject,
      targetAudience,
      tone: "tone" in body ? stringValue(body.tone) || null : current.tone,
      bodyText,
      qualityScore: quality.total,
      qualityJson: quality
    }
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  await prisma.messageTemplate.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
