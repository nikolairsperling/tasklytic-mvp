import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import {
  markCampaignEnrollmentFinished,
  markCampaignEnrollmentReplied,
  resetCampaignEnrollment
} from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string; enrollmentId: string }>;
};

const payloadSchema = z.object({
  action: z.enum(["replied", "booked", "not_interested", "reset"])
});

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id, enrollmentId } = await params;
    const { action } = payloadSchema.parse(await request.json());
    const now = new Date();

    const enrollment = await prisma.campaignEnrollment.findFirst({
      where: { id: enrollmentId, campaignId: id },
      select: { id: true }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment nicht gefunden" }, { status: 404 });
    }

    if (action === "reset") {
      await resetCampaignEnrollment(enrollment.id, now);
      return NextResponse.json({ ok: true });
    }

    if (action === "replied") {
      await markCampaignEnrollmentReplied(enrollment.id, now);
      return NextResponse.json({ ok: true });
    }

    await markCampaignEnrollmentFinished(enrollment.id, now, action === "booked" ? "booked" : "not_interested");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Enrollment Status konnte nicht aktualisiert werden.") },
      { status: 400 }
    );
  }
}
