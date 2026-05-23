import { NextResponse } from "next/server";
import { renderMessageTemplate, sampleLead } from "@/lib/message-templates";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const template = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { lead?: Record<string, string> };
  const lead = { ...sampleLead, ...(body.lead ?? {}) };
  const bodyResult = renderMessageTemplate(template.bodyText, lead);
  const subjectResult = renderMessageTemplate(template.subject ?? "", lead);
  const result = {
    renderedSubject: subjectResult.rendered,
    renderedBody: bodyResult.rendered,
    missingVariables: Array.from(new Set([...subjectResult.missingVariables, ...bodyResult.missingVariables])),
    detectedVariables: Array.from(new Set([...subjectResult.detectedVariables, ...bodyResult.detectedVariables])),
    lead
  };

  await prisma.messageTemplate.update({ where: { id }, data: { lastTestJson: result } });
  return NextResponse.json(result);
}
