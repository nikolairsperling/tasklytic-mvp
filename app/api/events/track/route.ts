import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { readTrackingSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";
import { prospectEventInputSchema, trackProspectEvent } from "@/lib/prospect-events";

export async function POST(request: Request) {
  try {
    const settings = await readTrackingSettings();
    if (settings.trackingConsentMode === "disabled") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const payload = prospectEventInputSchema.parse(await request.json());
    const result = await trackProspectEvent(payload, prisma);

    if (!result) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    if (payload.type === "page_view") {
      await prisma.prospect.update({
        where: { id: result.prospectId },
        data: { leadStatus: "landingpage_visited" }
      });
    }

    return NextResponse.json({ ok: true, scoreDelta: result.scoreDelta });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Event konnte nicht gespeichert werden.") },
      { status: 400 }
    );
  }
}
