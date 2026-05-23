import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  try {
    const items = await prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ items: items.map(serializeEmailTemplate) });
  } catch (error) {
    console.error("Email templates GET failed", error);
    return NextResponse.json(
      { items: [], message: getErrorMessage(error, "E-Mail-Vorlagen konnten nicht geladen werden.") },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = stringValue(body.name);
    const subject = stringValue(body.subject);
    const templateBody = stringValue(body.body ?? body.bodyText);
    const category = stringValue(body.category);

    if (!name) return NextResponse.json({ message: "Name ist erforderlich." }, { status: 400 });
    if (!subject) return NextResponse.json({ message: "Betreff ist erforderlich." }, { status: 400 });
    if (!templateBody) return NextResponse.json({ message: "Text ist erforderlich." }, { status: 400 });

    const item = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        body: templateBody,
        category: category || undefined
      }
    });

    return NextResponse.json(serializeEmailTemplate(item), { status: 201 });
  } catch (error) {
    console.error("Email templates POST failed", error);
    return NextResponse.json(
      { message: getErrorMessage(error, "E-Mail-Vorlage konnte nicht erstellt werden.") },
      { status: 400 }
    );
  }
}
