import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { enrichProspect } from "@/lib/prospect-enrichment";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const prospect = await prisma.prospect.findUnique({ where: { id } });
    if (!prospect) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });
    if (!prospect.websiteUrl) return NextResponse.json({ error: "Website URL fehlt." }, { status: 400 });

    const result = await enrichProspect(prospect);
    return NextResponse.json({
      status: result.status,
      suggestions: result.suggestions,
      notes: result.notes,
      summary: result.summary
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Anreicherung fehlgeschlagen.") }, { status: 400 });
  }
}
