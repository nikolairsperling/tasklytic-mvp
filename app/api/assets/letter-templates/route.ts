import { NextResponse } from "next/server";
import { checkLetterTemplate, extractGoogleDocId } from "@/lib/letter-templates";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  const items = await prisma.letterTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { isSystemTemplate: "desc" }, { updatedAt: "desc" }] });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = stringValue(body.name);
  if (!name) return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });

  const googleDocUrl = stringValue(body.googleDocUrl);
  const title = stringValue(body.title);
  const localBody = stringValue(body.body || body.googleDocsText || body.previewText);
  if (!localBody) return NextResponse.json({ error: "Dokumentinhalt ist erforderlich." }, { status: 400 });
  const footer = stringValue(body.footer);
  const googleDocsText = stringValue(body.googleDocsText || body.previewText || localBody);
  const imageAltTexts = imageAltTextsValue(body.imageAltTexts);
  const pageCount = numberValue(body.pageCount);
  const previewText = [title, localBody, footer].filter(Boolean).join("\n\n");
  const check = checkLetterTemplate({ googleDocsText: googleDocsText || previewText, previewText, imageAltTexts, pageCount });
  const isDefault = body.isDefault === true || body.isDefault === "true" || body.isDefault === "on";

  const template = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.letterTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    const defaultCount = await tx.letterTemplate.count({ where: { isDefault: true } });
    return tx.letterTemplate.create({
      data: {
        name,
        title: title || undefined,
        body: localBody,
        footer: footer || undefined,
        description: stringValue(body.description) || undefined,
        googleDocUrl: googleDocUrl || undefined,
        googleDocId: googleDocUrl ? extractGoogleDocId(googleDocUrl) || undefined : undefined,
        qrCodePosition: stringValue(body.qrCodePosition) || undefined,
        landingPageUrlVariable: stringValue(body.landingPageUrlVariable) || "{{LandingPage_URL}}",
        previewText,
        googleDocsText: googleDocsText || previewText,
        imageAltTexts,
        pageCount,
        isDefault: isDefault || defaultCount === 0,
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

  return NextResponse.json(template, { status: 201 });
}
