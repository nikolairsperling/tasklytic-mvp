import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { calculateProspectScore } from "@/lib/scoring";
import { requireOfferForProspect } from "@/lib/user-offer";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const prospect = await prisma.prospect.findUnique({ where: { id } });

    if (!prospect) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    const offer = await requireOfferForProspect(prospect);
    const scores = calculateProspectScore(JSON.parse(JSON.stringify(prospect)), offer);
    const updated = await prisma.prospect.update({
      where: { id },
      data: {
        ...scores,
        status: scores.fitScore > 60 ? "qualified" : prospect.status
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Scoring konnte nicht berechnet werden.") },
      { status: 400 }
    );
  }
}
