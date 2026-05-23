import { z } from "zod";
import { prisma } from "@/lib/prisma";

const notificationSettingsSchema = z.object({
  pushNewEmailEnabled: z.boolean(),
  pushReplyEnabled: z.boolean(),
  pushLeadEnrichmentEnabled: z.boolean(),
  pushFollowUpEnabled: z.boolean(),
  pushCampaignStatusEnabled: z.boolean(),
  pushErrorEnabled: z.boolean()
});

export type NotificationSettingsPayload = z.infer<typeof notificationSettingsSchema>;

export const defaultNotificationSettings: NotificationSettingsPayload = {
  pushNewEmailEnabled: true,
  pushReplyEnabled: true,
  pushLeadEnrichmentEnabled: true,
  pushFollowUpEnabled: true,
  pushCampaignStatusEnabled: true,
  pushErrorEnabled: true
};

export async function readNotificationSettings(): Promise<NotificationSettingsPayload> {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {},
    update: {}
  });

  return {
    pushNewEmailEnabled: settings.pushNewEmailEnabled,
    pushReplyEnabled: settings.pushReplyEnabled,
    pushLeadEnrichmentEnabled: settings.pushLeadEnrichmentEnabled,
    pushFollowUpEnabled: settings.pushFollowUpEnabled,
    pushCampaignStatusEnabled: settings.pushCampaignStatusEnabled,
    pushErrorEnabled: settings.pushErrorEnabled
  };
}

export async function saveNotificationSettings(payload: unknown): Promise<NotificationSettingsPayload> {
  const parsed = notificationSettingsSchema.parse(payload);
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: parsed,
    update: parsed
  });

  return {
    pushNewEmailEnabled: settings.pushNewEmailEnabled,
    pushReplyEnabled: settings.pushReplyEnabled,
    pushLeadEnrichmentEnabled: settings.pushLeadEnrichmentEnabled,
    pushFollowUpEnabled: settings.pushFollowUpEnabled,
    pushCampaignStatusEnabled: settings.pushCampaignStatusEnabled,
    pushErrorEnabled: settings.pushErrorEnabled
  };
}
