import { NextResponse } from "next/server";
import { checkLetterTemplate } from "@/lib/letter-templates";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const template = await prisma.letterTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });

  const body = await request.json().catch(() => ({})) as { leadFields?: string[] };
  const check = checkLetterTemplate(template, Array.isArray(body.leadFields) ? body.leadFields : []);
  const updated = await prisma.letterTemplate.update({
    where: { id },
    data: {
      isChecked: check.status === "checked",
      lastCheckStatus: check.status,
      lastCheckSummary: check.summary,
      lastCheckIssues: check.issues,
      detectedRecipientVariables: check.detectedRecipientVariables,
      detectedSenderVariables: check.detectedSenderVariables,
      detectedPersonalizationVariables: check.detectedPersonalizationVariables
    }
  });

  return NextResponse.json({ template: updated, check });
}
