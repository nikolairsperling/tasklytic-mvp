import { NextResponse } from "next/server";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type P = { params: Promise<{ id: string }> };

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serializeEmailTemplate(template: {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...template,
    bodyText: template.body
  };
}

export async function PATCH(request: Request, { params }: P) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = stringValue(body.name);
    const subject = stringValue(body.subject);
    const templateBody = stringValue(body.body ?? body.bodyText);
    const category = stringValue(body.category);

    if (!name) return NextResponse.json({ message: "Name ist erforderlich." }, { status: 400 });
    if (!subject) return NextResponse.json({ message: "Betreff ist erforderlich." }, { status: 400 });
    if (!templateBody) return NextResponse.json({ message: "Text ist erforderlich." }, { status: 400 });

    const item = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name,
        subject,
        body: templateBody,
        category: category || null
      }
    });
    return NextResponse.json(serializeEmailTemplate(item));
  } catch (error) {
    console.error("Email templates PATCH failed", error);
    return NextResponse.json(
      { message: getErrorMessage(error, "E-Mail-Vorlage konnte nicht gespeichert werden.") },
      { status: isRecordNotFoundError(error) ? 404 : 400 }
    );
  }
}

export async function DELETE(_: Request, { params }: P) {
  try {
    const { id } = await params;
    await prisma.emailTemplate.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Email templates DELETE failed", error);
    return NextResponse.json(
      { message: getErrorMessage(error, "E-Mail-Vorlage konnte nicht gelöscht werden.") },
      { status: isRecordNotFoundError(error) ? 404 : 400 }
    );
  }
}
