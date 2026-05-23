import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { sanitizeLandingpageSections } from "@/lib/landingpage-builder";
import { normalizeLandingpageSections } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = normalizeTemplatePayload(body);

    if (data.isDefault) {
      await prisma.landingpageTemplate.updateMany({ where: { NOT: { id } }, data: { isDefault: false } });
    }

    const template = await prisma.landingpageTemplate.update({ where: { id }, data });
    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Template konnte nicht gespeichert werden.") }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    await prisma.landingpageTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Template konnte nicht gelöscht werden.") }, { status: 400 });
  }
}

function normalizeTemplatePayload(body: Record<string, unknown>) {
  const booleanFields = [
    "isDefault",
    "heroEnabled",
    "personalVideoEnabled",
    "explainerVideoEnabled",
    "comparisonEnabled",
    "approachEnabled",
    "faqEnabled",
    "finalCtaEnabled"
  ];
  const data: Record<string, unknown> = { ...body };
  for (const field of booleanFields) {
    if (field in body) data[field] = body[field] === true || body[field] === "on" || body[field] === "true";
  }
  for (const key of Object.keys(data)) if (data[key] === "") data[key] = null;
  if (body.headerLogoWidth !== undefined) data.headerLogoWidth = body.headerLogoWidth === null || body.headerLogoWidth === "" ? null : Number(body.headerLogoWidth);
  if (body.headerLogoHeight !== undefined) data.headerLogoHeight = body.headerLogoHeight === null || body.headerLogoHeight === "" ? null : Number(body.headerLogoHeight);
  if (body.headerShowTextFallback !== undefined) data.headerShowTextFallback = body.headerShowTextFallback === true || body.headerShowTextFallback === "on" || body.headerShowTextFallback === "true";
  if (typeof body.beforeItems === "string") data.beforeItems = body.beforeItems.split("\n").map((x) => x.trim()).filter(Boolean);
  if (typeof body.afterItems === "string") data.afterItems = body.afterItems.split("\n").map((x) => x.trim()).filter(Boolean);
  if (typeof body.faqJson === "string") {
    try { data.faqJson = JSON.parse(body.faqJson); } catch { data.faqJson = []; }
  }
  if (typeof body.sectionsJson === "string") {
    data.sectionsJson = sanitizeLandingpageSections(normalizeLandingpageSections(JSON.parse(body.sectionsJson)));
  } else if (Array.isArray(body.sectionsJson)) {
    data.sectionsJson = sanitizeLandingpageSections(normalizeLandingpageSections(body.sectionsJson));
  }
  if (body.addressForm !== undefined) data.addressForm = body.addressForm === "sie" ? "sie" : "du";
  if (typeof body.globalDesignJson === "string") {
    data.globalDesignJson = JSON.parse(body.globalDesignJson);
  }
  return data;
}
