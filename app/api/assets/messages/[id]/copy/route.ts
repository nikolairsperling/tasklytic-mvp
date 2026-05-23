import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id } = await params;
  const source = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });

  const copy = await prisma.messageTemplate.create({
    data: {
      name: `${source.name} Kopie`,
      channel: source.channel,
      category: source.category,
      status: "draft",
      subject: source.subject,
      targetAudience: source.targetAudience,
      tone: source.tone,
      bodyText: source.bodyText,
      qualityScore: source.qualityScore,
      qualityJson: (source.qualityJson ?? {}) as Prisma.InputJsonValue
    }
  });

  return NextResponse.json(copy, { status: 201 });
}
