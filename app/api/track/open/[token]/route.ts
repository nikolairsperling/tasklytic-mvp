import { prisma } from "@/lib/prisma";
import { readTrackingSettings, resolveEmailTracking } from "@/lib/app-settings";
import { trackProspectEvent } from "@/lib/prospect-events";

type RouteProps = {
  params: Promise<{ token: string }>;
};

const pixel = Buffer.from(
  "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64"
);

export async function GET(_: Request, { params }: RouteProps) {
  const { token } = await params;
  const log = await prisma.emailSendLog.findUnique({
    where: { trackingToken: token },
    select: { id: true, prospectId: true, campaignId: true, emailVariantId: true, emailVariantLabel: true }
  });

  if (log) {
    const settings = await readTrackingSettings();
    const tracking = resolveEmailTracking(settings, true);
    if (tracking.openEnabled) {
      await prisma.emailSendLog.update({
        where: { id: log.id },
        data: {
          openedAt: new Date(),
          openCount: { increment: 1 }
        }
      });
      await trackProspectEvent(
        {
          prospectId: log.prospectId,
          type: "email_opened",
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
  }

  return new Response(pixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
