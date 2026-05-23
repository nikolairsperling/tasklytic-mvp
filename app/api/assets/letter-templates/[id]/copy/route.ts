import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id } = await params;
  const source = await prisma.letterTemplate.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });

  const copy = await prisma.letterTemplate.create({
    data: {
      name: `${source.name.replace(" (Nur Ansicht)", "")} Kopie`,
      title: source.title,
      body: source.body,
      footer: source.footer,
      description: source.description,
      googleDocUrl: source.googleDocUrl,
      googleDocId: source.googleDocId,
      previewText: source.previewText,
      googleDocsText: source.googleDocsText,
      googleDocsJson: (source.googleDocsJson ?? {}) as Prisma.InputJsonValue,
      imageAltTexts: source.imageAltTexts,
      pageCount: source.pageCount,
      qrCodePosition: source.qrCodePosition,
      landingPageUrlVariable: source.landingPageUrlVariable,
      isDefault: false,
      isSystemTemplate: false,
      isInUse: false,
      isChecked: source.isChecked,
      lastCheckStatus: source.lastCheckStatus,
      lastCheckSummary: source.lastCheckSummary,
      lastCheckIssues: (source.lastCheckIssues ?? []) as Prisma.InputJsonValue,
      detectedRecipientVariables: source.detectedRecipientVariables,
      detectedSenderVariables: source.detectedSenderVariables,
      detectedPersonalizationVariables: source.detectedPersonalizationVariables
    }
  });

  return NextResponse.json(copy, { status: 201 });
}
