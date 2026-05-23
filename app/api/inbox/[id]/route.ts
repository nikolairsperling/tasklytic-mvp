import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

const payloadSchema = z.object({
  status: z.enum(["unread", "read", "archived"]).optional(),
  matchedProspectId: z.string().nullable().optional(),
  matchedCampaignId: z.string().nullable().optional(),
  category: z.enum(["positive", "neutral", "negative", "question", "auto_reply"]).optional(),
  confidence: z.coerce.number().int().min(0).max(100).optional(),
  aiSummary: z.string().nullable().optional()
});

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = payloadSchema.parse(await request.json());
    const email = await prisma.inboundEmail.update({
      where: { id },
      data: payload
    });

    return NextResponse.json(email);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Inbound Email konnte nicht aktualisiert werden.") },
      { status: 400 }
    );
  }
}
