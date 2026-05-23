import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/api";
import { createClickUpTaskForLeadSafe } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { parseProspectPayload } from "@/lib/prospects";
import { calculateProspectScore } from "@/lib/scoring";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = parseProspectPayload(body);
    const prospect = await prisma.prospect.create({ data: { ...payload, ...calculateProspectScore(payload) } as Prisma.ProspectUncheckedCreateInput });
    await createClickUpTaskForLeadSafe(prospect);

    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Ungültiger Prospect-Import")
      },
      { status: 400 }
    );
  }
}
