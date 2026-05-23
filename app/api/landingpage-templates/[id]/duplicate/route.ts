import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const template = await prisma.landingpageTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: "Template nicht gefunden." }, { status: 404 });

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, isDefault: _isDefault, ...data } = template;
    const copy = await prisma.landingpageTemplate.create({
      data: {
        ...data,
        name: `${template.name} Kopie`,
        isDefault: false
      } as any
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Template konnte nicht dupliziert werden.") }, { status: 400 });
  }
}
