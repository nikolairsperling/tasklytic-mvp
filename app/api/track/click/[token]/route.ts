import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readTrackingSettings, resolveEmailTracking } from "@/lib/app-settings";
import { trackProspectEvent } from "@/lib/prospect-events";

type RouteProps = {
  params: Promise<{ token: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { token } = await params;
  const log = await prisma.emailSendLog.findUnique({
    where: { clickToken: token },
    select: { id: true, prospectId: true, campaignId: true, emailVariantId: true, emailVariantLabel: true, landingpageUrl: true }
  });

  if (!log?.landingpageUrl) {
    return NextResponse.redirect(new URL("/", "http://localhost:3000"));
  }

  const settings = await readTrackingSettings();
  const tracking = resolveEmailTracking(settings, true);
  if (tracking.clickEnabled) {
    await prisma.emailSendLog.update({
      where: { clickToken: token },
      data: {
        clickedAt: new Date(),
        clickCount: { increment: 1 }
      }
    });
    await trackProspectEvent(
      {
        prospectId: log.prospectId,
        type: "email_clicked",
        meta: {
          emailSendLogId: log.id,
          campaignId: log.campaignId,
          emailVariantId: log.emailVariantId,
          emailVariantLabel: log.emailVariantLabel
        }
      },
      prisma
    );
  }

  return NextResponse.redirect(log.landingpageUrl);
}
