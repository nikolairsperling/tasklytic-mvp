import { NextResponse } from "next/server";
import { checkLetterTemplate, extractGoogleDocId } from "@/lib/letter-templates";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function imageAltTextsValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return stringValue(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === "on";
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const current = await prisma.letterTemplate.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });

  const body = await request.json();
  const title = "title" in body ? stringValue(body.title) : current.title ?? "";
  const localBody = "body" in body ? stringValue(body.body) : current.body;
  const footer = "footer" in body ? stringValue(body.footer) : current.footer ?? "";
  if (!localBody) return NextResponse.json({ error: "Dokumentinhalt ist erforderlich." }, { status: 400 });
  const googleDocUrl = "googleDocUrl" in body ? stringValue(body.googleDocUrl) : current.googleDocUrl ?? "";
  const googleDocsText = "googleDocsText" in body ? stringValue(body.googleDocsText) : current.googleDocsText || localBody;
  const imageAltTexts = "imageAltTexts" in body ? imageAltTextsValue(body.imageAltTexts) : current.imageAltTexts;
  const pageCount = "pageCount" in body ? numberValue(body.pageCount) : current.pageCount;
  const previewText = [title, localBody, footer].filter(Boolean).join("\n\n");
  const check = checkLetterTemplate({
    googleDocsText: googleDocsText || previewText,
    previewText,
    googleDocsJson: current.googleDocsJson,
    imageAltTexts,
    pageCount
  });
  const isDefault = "isDefault" in body ? booleanValue(body.isDefault) : current.isDefault;

  const updated = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.letterTemplate.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
    return tx.letterTemplate.update({
      where: { id },
      data: {
        name: "name" in body ? stringValue(body.name) || current.name : current.name,
        title: title || null,
        body: localBody,
        footer: footer || null,
        description: "description" in body ? stringValue(body.description) || null : current.description,
        googleDocUrl: googleDocUrl || null,
        googleDocId: googleDocUrl ? extractGoogleDocId(googleDocUrl) || null : null,
        qrCodePosition: "qrCodePosition" in body ? stringValue(body.qrCodePosition) || null : current.qrCodePosition,
        landingPageUrlVariable: "landingPageUrlVariable" in body ? stringValue(body.landingPageUrlVariable) || "{{LandingPage_URL}}" : current.landingPageUrlVariable,
        previewText,
        googleDocsText: googleDocsText || previewText,
        imageAltTexts,
        pageCount,
        isDefault,
        isChecked: check.status === "checked",
        lastCheckStatus: check.status,
        lastCheckSummary: check.summary,
        lastCheckIssues: check.issues,
        detectedRecipientVariables: check.detectedRecipientVariables,
        detectedSenderVariables: check.detectedSenderVariables,
        detectedPersonalizationVariables: check.detectedPersonalizationVariables
      }
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const current = await prisma.letterTemplate.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });
  if (current.isSystemTemplate) return NextResponse.json({ error: "Systemvorlagen können nicht gelöscht werden." }, { status: 403 });
  await prisma.letterTemplate.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
