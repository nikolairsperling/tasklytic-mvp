import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const scheduleSchema = z.object({
  scheduledStartAt: z
    .union([z.string().datetime(), z.literal(""), z.null()])
    .transform((value) => (value ? new Date(value) : null))
    .optional(),
  timezone: z.string().trim().min(1).optional(),
  sendWindowStart: z.string().nullable().optional(),
  sendWindowEnd: z.string().nullable().optional(),
  weekdaysOnly: z.boolean().optional(),
  manualGoApproved: z.boolean().optional(),
  sendingStatus: z.enum(["draft", "scheduled", "active", "paused", "completed"]).optional()
});

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = scheduleSchema.parse(await request.json());

    const campaign = await prisma.campaign.update({
      where: { id },
      data: payload
    });

    return NextResponse.json(campaign);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Kampagne nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(
      { error: getErrorMessage(error, "Kampagnenplan konnte nicht gespeichert werden.") },
      { status: 400 }
    );
  }
}
