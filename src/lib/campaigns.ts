import crypto from "node:crypto";
import { z } from "zod";
import type { CampaignEmailVariant, CampaignStep } from "@prisma/client";
import { delay } from "@/lib/email-delay";
import { prisma } from "@/lib/prisma";
import { checkEmailSendingLimits, getBatchLimit, getNextLimitRetryAt } from "@/lib/email-limits";
import { appendSignature, getDefaultEmailSignature } from "@/lib/email-signature";
import { sendSmtpMail, type MailPayload, type MailSendResult } from "@/lib/mailer";
import { canSendCampaignNow, getEffectiveCampaignSendingStatus, getNextAllowedCampaignSendAt } from "@/lib/scheduling";
import { calculateFollowUpAt } from "@/lib/follow-ups";
import {
  appendOpenTrackingPixel,
  appendUtmParams,
  buildTrackingClickUrl as buildConfiguredTrackingClickUrl,
  readTrackingSettings,
  resolveEmailTracking
} from "@/lib/app-settings";

export const MAX_CAMPAIGN_BATCH_SIZE = getBatchLimit();

export const campaignStepInputSchema = z.object({
  stepNumber: z.coerce.number().int().positive().optional(),
  delayDays: z.coerce.number().int().min(0),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1).optional(),
  bodyText: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional().default(true),
  bodyHtml: z
    .union([z.string().trim(), z.literal(""), z.undefined()])
    .transform((value) => value || undefined)
});

export const campaignEmailVariantInputSchema = z.object({
  label: z.string().trim().min(1).max(8),
  subject: z.string().trim().min(1),
  bodyText: z.string().trim().min(1),
  weight: z.coerce.number().int().min(0).max(100).optional(),
  landingpageUrl: z.string().trim().optional().nullable().transform((value) => value || undefined),
  isActive: z.boolean().optional().default(true)
});

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1),
  status: z.enum(["draft", "active", "paused", "completed"]).optional().default("draft"),
  targetGroupId: z.string().trim().optional().nullable().transform((value) => value || undefined),
  offerId: z.string().trim().min(1, "Bitte Angebot auswählen"),
  selectedProspectId: z.string().trim().optional().nullable().transform((value) => value || undefined),
  trackingEnabled: z.boolean().optional().default(false),
  estimatedDealValue: z.coerce.number().int().nonnegative().optional(),
  estimatedCostPerLead: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  scheduledStartAt: z.string().datetime().optional(),
  timezone: z.string().optional().default("Europe/Berlin"),
  sendWindowStart: z.string().optional(),
  sendWindowEnd: z.string().optional(),
  weekdaysOnly: z.boolean().optional().default(true),
  manualGoApproved: z.boolean().optional().default(false),
  steps: z.array(campaignStepInputSchema).min(1),
  emailVariants: z.array(campaignEmailVariantInputSchema).optional()
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;

type SendMail = (payload: MailPayload) => Promise<MailSendResult>;

type CampaignStepLike = Pick<CampaignStep, "id" | "campaignId" | "position" | "stepNumber" | "delayDays" | "subject" | "bodyText" | "body" | "isActive" | "bodyHtml">;
type CampaignEmailVariantLike = Pick<CampaignEmailVariant, "id" | "campaignId" | "label" | "subject" | "bodyText" | "weight" | "landingpageUrl" | "isActive">;

type DueItem = {
  campaign: {
    status: string;
    sendingStatus: string;
    steps: CampaignStepLike[];
    emailVariants: CampaignEmailVariantLike[];
    trackingEnabled: boolean;
    manualGoApproved: boolean;
    scheduledStartAt: Date | null;
    timezone: string;
    sendWindowStart: string | null;
    sendWindowEnd: string | null;
    weekdaysOnly: boolean;
  };
  enrollment: {
    id: string;
    campaignId: string;
    prospectId: string;
    createdAt: Date;
    currentStep: number;
    emailVariantId: string | null;
    emailVariantLabel: string | null;
    nextSendAt: Date | null;
    lastSentAt: Date | null;
    status: string;
    prospect: {
      id: string;
      slug: string | null;
      companyName: string;
      city: string;
      decisionMakerName: string | null;
      firstName: string | null;
      lastName: string | null;
      salutation: string | null;
      decisionMakerEmail: string | null;
      companyEmail: string | null;
      companyStatus: string;
      landingpageUrl: string | null;
      landingpageReviewStatus: string;
      bookingUrl: string | null;
      calendarUrl: string | null;
    };
  };
  step: {
    id: string;
    campaignId: string;
    position: number;
    stepNumber: number;
    delayDays: number;
    subject: string;
    bodyText: string;
    body: string;
    isActive: boolean;
    bodyHtml: string | null;
  };
  emailVariant: CampaignEmailVariantLike | null;
};

type TemplateProspect = Pick<DueItem["enrollment"]["prospect"], "slug" | "companyName" | "city" | "decisionMakerName" | "decisionMakerEmail"> & {
  firstName?: string | null;
  lastName?: string | null;
  salutation?: string | null;
  bookingUrl?: string | null;
  calendarUrl?: string | null;
};

type NormalizedCampaignStep = {
  position: number;
  stepNumber: number;
  delayDays: number;
  subject: string;
  bodyText: string;
  body: string;
  isActive: boolean;
  bodyHtml?: string;
};

type NormalizedCampaignEmailVariant = {
  label: string;
  subject: string;
  bodyText: string;
  weight: number;
  landingpageUrl?: string;
  isActive: boolean;
};

const defaultFirstMailSubject = "Kurzer Blick auf {{companyName}}";
const defaultFirstMailBodySie = `Hallo {{firstName}},

ich habe Ihnen eine kurze persönliche Seite vorbereitet.

Dort zeige ich, wo bei Aufträgen, Abstimmung oder Übergaben möglicherweise unnötig Zeit verloren geht.

Hier ansehen:
{{landingpageUrl}}

Viele Grüße
Nikolai`;
const defaultFirstMailBodyDu = `Hallo {{firstName}},

ich habe dir eine kurze persönliche Seite vorbereitet.

Dort zeige ich, wo bei Aufträgen, Abstimmung oder Übergaben möglicherweise unnötig Zeit verloren geht.

Hier ansehen:
{{landingpageUrl}}

Viele Grüße
Nikolai`;

export function parseCampaignPayload(payload: unknown): CampaignInput {
  const result = campaignInputSchema.safeParse(payload);
  if (!result.success) {
    const offerError = result.error.issues.find((issue) => issue.path[0] === "offerId");
    if (offerError) throw new Error("Bitte Angebot auswählen");
    throw new Error("Bitte Kampagnenname und mindestens einen vollständigen Step ausfüllen.");
  }
  return result.data;
}

export async function createCampaign(payload: CampaignInput) {
  const normalizedSteps = normalizeCampaignSteps(payload.steps);
  validateFirstMailLandingpageRequirement(normalizedSteps[0]?.bodyText ?? "");
  const normalizedVariants = normalizeCampaignEmailVariants(payload.emailVariants, normalizedSteps[0]);
  const offer = await prisma.offer.findFirst({
    where: { id: payload.offerId, workspaceId: "default" },
    select: { id: true }
  });
  if (!offer) {
    throw new Error("Bitte Angebot auswählen");
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: payload.name,
      status: payload.status,
      targetGroupId: payload.targetGroupId,
      offerId: payload.offerId,
      selectedProspectId: payload.selectedProspectId,
      trackingEnabled: payload.trackingEnabled,
      estimatedDealValue: payload.estimatedDealValue,
      estimatedCostPerLead: payload.estimatedCostPerLead,
      notes: payload.notes,
      scheduledStartAt: payload.scheduledStartAt ? new Date(payload.scheduledStartAt) : undefined,
      timezone: payload.timezone,
      sendWindowStart: payload.sendWindowStart,
      sendWindowEnd: payload.sendWindowEnd,
      weekdaysOnly: payload.weekdaysOnly,
      manualGoApproved: payload.manualGoApproved,
      sendingStatus: "draft",
      steps: {
        create: normalizedSteps
      },
      emailVariants: {
        create: normalizedVariants
      }
    },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      emailVariants: { orderBy: { label: "asc" } }
    }
  });

  console.info("CAMPAIGN_CREATE", {
    campaignId: campaign.id,
    offerId: campaign.offerId,
    targetGroupId: campaign.targetGroupId ?? null
  });

  return campaign;
}

export async function addProspectsToCampaign(campaignId: string, prospectIds: string[]) {
  if (!campaignId) {
    throw new Error("Kampagne nicht gefunden.");
  }

  const uniqueIds = [...new Set(prospectIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return { added: 0, skipped: 0, failed: 0 };
  }

  const [campaign, existingEnrollments, prospects] = await prisma.$transaction([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        scheduledStartAt: true,
        createdAt: true,
        offerId: true,
        targetGroupId: true,
        emailVariants: {
          where: { isActive: true },
          orderBy: { label: "asc" },
          select: { id: true, label: true, weight: true }
        },
        enrollments: {
          select: { emailVariantId: true, emailVariantLabel: true }
        }
      }
    }),
    prisma.campaignEnrollment.findMany({
      where: { campaignId, prospectId: { in: uniqueIds } },
      select: { prospectId: true }
    }),
    prisma.prospect.findMany({
      where: {
        id: { in: uniqueIds },
        decisionMakerEmail: { not: null },
        slug: { not: null },
        landingpageReviewStatus: "approved",
        companyStatus: { notIn: ["inactive", "unreachable"] }
      },
      select: { id: true }
    })
  ]);

  if (!campaign) {
    throw new Error("Kampagne nicht gefunden.");
  }
  if (!campaign.offerId) {
    throw new Error("Bitte Angebot auswählen");
  }

  console.info("CAMPAIGN_UPDATE", {
    campaignId,
    offerId: campaign.offerId,
    targetGroupId: campaign.targetGroupId ?? null
  });

  if (prospects.length === 0) {
    return { added: 0, skipped: 0, failed: uniqueIds.length };
  }

  const existingIds = new Set(existingEnrollments.map((enrollment) => enrollment.prospectId));
  const prospectsToAdd = prospects.filter((prospect) => !existingIds.has(prospect.id));
  const assignments = assignEmailVariants(prospectsToAdd.map((prospect) => prospect.id), campaign.emailVariants, campaign.enrollments);

  const result = await prisma.campaignEnrollment.createMany({
    data: prospectsToAdd.map((prospect) => ({
      campaignId,
      prospectId: prospect.id,
      currentStep: 1,
      emailVariantId: assignments.get(prospect.id)?.id,
      emailVariantLabel: assignments.get(prospect.id)?.label,
      nextSendAt: campaign?.scheduledStartAt ?? campaign?.createdAt ?? new Date(),
      status: "active"
    })),
    skipDuplicates: true
  });

  if (result.count > 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "active" }
    });
  }

  const eligibleIds = new Set(prospects.map((prospect) => prospect.id));
  const failed = uniqueIds.filter((id) => !eligibleIds.has(id)).length;
  const duplicateOrAlreadyAdded = uniqueIds.length - failed - result.count;

  return {
    added: result.count,
    skipped: duplicateOrAlreadyAdded,
    failed
  };
}

export function clampBatchSize(limit?: number): number {
  return getBatchLimit(limit);
}

export function buildLandingpageUrl(slug: string, appUrl = process.env.NEXT_PUBLIC_APP_URL): string {
  if (!appUrl) {
    return `/p/${slug}`;
  }

  return `${appUrl.replace(/\/$/, "")}/p/${slug}`;
}

export function renderTemplate(
  template: string,
  prospect: TemplateProspect,
  landingpageUrlOverride?: string
): string {
  const landingpageUrl = landingpageUrlOverride ?? (prospect.slug ? buildLandingpageUrl(prospect.slug) : "");
  const bookingUrl = prospect.bookingUrl ?? prospect.calendarUrl ?? "";
  const values: Record<string, string> = {
    companyName: prospect.companyName,
    city: prospect.city,
    decisionMakerName: prospect.decisionMakerName ?? "",
    firstName: prospect.firstName ?? prospect.decisionMakerName?.split(/\s+/)[0] ?? "",
    lastName: prospect.lastName ?? "",
    salutation: prospect.salutation ?? "",
    decisionMakerEmail: prospect.decisionMakerEmail ?? "",
    landingpageUrl,
    landingPageUrl: landingpageUrl,
    ctaText: "Persönliche Seite ansehen",
    personalPagePreparedSentence: usesDuForm(prospect)
      ? "ich habe dir eine kurze persönliche Seite vorbereitet."
      : "ich habe Ihnen eine kurze persönliche Seite vorbereitet.",
    Terminlink: bookingUrl,
    Calendly_Link: bookingUrl,
    Booking_URL: bookingUrl,
    calendarUrl: bookingUrl,
    bookingUrl
  };

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key] ?? "");
}

export function renderHtmlTemplate(
  template: string,
  prospect: TemplateProspect,
  landingpageUrlOverride?: string
): string {
  return escapeHtml(renderTemplate(template, prospect, landingpageUrlOverride)).replace(/\n/g, "<br>");
}

export function createTrackingToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function sendDueCampaignEmails({
  campaignId,
  limit,
  now = new Date(),
  sendMail = sendSmtpMail
}: {
  campaignId: string;
  limit?: number;
  now?: Date;
  sendMail?: SendMail;
}) {
  const batchSize = clampBatchSize(limit);
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      status: true,
      sendingStatus: true,
      scheduledStartAt: true,
      timezone: true,
      sendWindowStart: true,
      sendWindowEnd: true,
      weekdaysOnly: true,
      manualGoApproved: true,
      offerId: true,
      targetGroupId: true,
      flowSettings: { select: { followUpDays: true } }
    }
  });
  if (!campaign?.offerId) {
    throw new Error("Bitte Angebot auswählen");
  }
  console.info("CAMPAIGN_SEND", {
    campaignId,
    offerId: campaign.offerId,
    targetGroupId: campaign.targetGroupId ?? null
  });
  const schedule = campaign ? canSendCampaignNow(campaign, now) : { allowed: true };

  if (!schedule.allowed) {
    if (schedule.reason === "Versandfenster hat noch nicht begonnen." || schedule.reason === "Versandfenster ist bereits beendet." || schedule.reason === "Versand ist auf Werktage beschränkt.") {
      const dueItems = await getDueCampaignItems(campaignId, now, batchSize);
      const nextSendAt = campaign ? getNextAllowedCampaignSendAt(campaign, now) : getNextLimitRetryAt(now);

      for (const item of dueItems) {
        await prisma.campaignEnrollment.update({
          where: { id: item.enrollment.id },
          data: {
            nextSendAt,
            lastActivityAt: now
          }
        });
      }

      const remainingDue = await getDueCampaignItems(campaignId, now, 1);
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: dueItems.length,
        remainingDue: remainingDue.length,
        blockedReason: schedule.reason,
        reason: schedule.reason
      };
    }

    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      remainingDue: 0,
      blockedReason: schedule.reason,
      reason: schedule.reason
    };
  }

  const dueItems = await getDueCampaignItems(campaignId, now, batchSize);
  const trackingSettings = await readTrackingSettings();
  let sent = 0;
  let failed = 0;

  for (const item of dueItems) {
    const email = item.enrollment.prospect.decisionMakerEmail;
    const slug = item.enrollment.prospect.slug;
    const sentAt = new Date(now);

    if (!email || !slug) {
      continue;
    }

    const firstStepVariant = item.step.stepNumber === 1 ? item.emailVariant : null;
    const baseLandingpageUrl = resolveLandingpageUrl(item.enrollment.prospect, firstStepVariant?.landingpageUrl);

    if (item.step.stepNumber === 1 && !baseLandingpageUrl) {
      const blockedSubject = firstStepVariant?.subject ?? item.step.subject;
      await prisma.emailSendLog.create({
        data: {
          campaignId,
          stepId: item.step.id,
          enrollmentId: item.enrollment.id,
          prospectId: item.enrollment.prospectId,
          email,
          status: "failed",
          subject: blockedSubject,
          emailVariantId: firstStepVariant?.id,
          emailVariantLabel: firstStepVariant?.label ?? item.enrollment.emailVariantLabel,
          error: "Landingpage fehlt"
        }
      });
      await prisma.campaignEnrollment.update({
        where: { id: item.enrollment.id },
        data: {
          blockedReason: "Landingpage fehlt",
          nextSendAt: null,
          lastActivityAt: sentAt
        }
      });
      failed += 1;
      continue;
    }

    const tracking = resolveEmailTracking(trackingSettings, item.campaign.trackingEnabled);
    const trackingToken = tracking.openEnabled ? createTrackingToken() : undefined;
    const clickToken = tracking.clickEnabled ? createTrackingToken() : undefined;
    const landingpageUrl = appendUtmParams(baseLandingpageUrl ?? buildLandingpageUrl(slug), trackingSettings);
    const renderedLandingpageUrl = clickToken ? buildConfiguredTrackingClickUrl(clickToken, trackingSettings) : landingpageUrl;
    const subjectTemplate = firstStepVariant?.subject ?? item.step.subject;
    const bodyTemplate = firstStepVariant?.bodyText ?? item.step.bodyText;
    const subject = renderTemplate(subjectTemplate, item.enrollment.prospect, renderedLandingpageUrl);
    const bodyText = renderTemplate(bodyTemplate, item.enrollment.prospect, renderedLandingpageUrl);
    const bodyHtml = item.step.bodyHtml
      ? renderTemplate(item.step.bodyHtml, item.enrollment.prospect, renderedLandingpageUrl)
      : buildFirstStepHtml(bodyText, renderedLandingpageUrl, item.step.stepNumber === 1);
    const html = appendOpenTrackingPixel(bodyHtml, trackingToken, trackingSettings);
    const signature = await getDefaultEmailSignature();
    const signed = appendSignature({ bodyHtml: html, bodyText, signature });

    const sendWindowCheckAt = process.env.NODE_ENV === "test" ? new Date(now) : new Date();
    const sendWindowDecision = canSendCampaignNow(item.campaign, sendWindowCheckAt);
    if (!sendWindowDecision.allowed) {
      if (
        sendWindowDecision.reason === "Versandfenster hat noch nicht begonnen." ||
        sendWindowDecision.reason === "Versandfenster ist bereits beendet." ||
        sendWindowDecision.reason === "Versand ist auf Werktage beschränkt."
      ) {
        const nextSendAt = getNextAllowedCampaignSendAt(item.campaign, new Date());
        await prisma.campaignEnrollment.update({
          where: { id: item.enrollment.id },
          data: {
            nextSendAt,
            lastActivityAt: new Date()
          }
        });
        continue;
      }
    }

    const limitDecision = await checkEmailSendingLimits({
      prospectId: item.enrollment.prospectId,
      now: sentAt
    });

    if (!limitDecision.allowed) {
      await prisma.campaignEnrollment.update({
        where: { id: item.enrollment.id },
        data: {
          nextSendAt: limitDecision.nextSendAt ?? getNextLimitRetryAt(sentAt),
          lastActivityAt: sentAt
        }
      });

      await prisma.emailSendLog.create({
        data: {
          campaignId,
          stepId: item.step.id,
          enrollmentId: item.enrollment.id,
          prospectId: item.enrollment.prospectId,
          email,
          status: "failed",
          subject,
          trackingToken,
          clickToken,
          emailVariantId: firstStepVariant?.id,
          emailVariantLabel: firstStepVariant?.label ?? item.enrollment.emailVariantLabel,
          landingpageUrl,
          error: "Limit erreicht"
        }
      });
      failed += 1;
      continue;
    }

    try {
      await delay();
      const dispatchAt = process.env.NODE_ENV === "test" ? new Date(now) : new Date();
      const dispatchDecision = canSendCampaignNow(item.campaign, dispatchAt);
      if (!dispatchDecision.allowed) {
        if (
          dispatchDecision.reason === "Versandfenster hat noch nicht begonnen." ||
          dispatchDecision.reason === "Versandfenster ist bereits beendet." ||
          dispatchDecision.reason === "Versand ist auf Werktage beschränkt."
        ) {
          await prisma.campaignEnrollment.update({
            where: { id: item.enrollment.id },
            data: {
              nextSendAt: getNextAllowedCampaignSendAt(item.campaign, dispatchAt),
              lastActivityAt: dispatchAt
            }
          });
          continue;
        }
      }
      const result = await sendMail({
        to: email,
        subject,
        text: signed.text,
        html: signed.html
      });

      await prisma.emailSendLog.create({
        data: {
          campaignId,
          stepId: item.step.id,
          enrollmentId: item.enrollment.id,
          prospectId: item.enrollment.prospectId,
          email,
          status: "sent",
          subject,
          trackingToken,
          clickToken,
          emailVariantId: firstStepVariant?.id,
          emailVariantLabel: firstStepVariant?.label ?? item.enrollment.emailVariantLabel,
          landingpageUrl,
          messageId: result.messageId,
          sentAt
        }
      });

      const nextStep = getNextActiveCampaignStep(item.campaign.steps, item.step.stepNumber);
      const nextSendAt = nextStep ? addDays(sentAt, nextStep.delayDays) : null;
      const followUpAt = calculateFollowUpAt(sentAt, campaign.flowSettings?.followUpDays ?? null);
      await prisma.prospect.updateMany({
        where: {
          id: item.enrollment.prospectId,
          status: { in: ["qualified", "landingpage_ready"] }
        },
        data: {
          status: "contacted",
          lastContactedAt: sentAt,
          lastEmailSentAt: sentAt,
          followUpAt,
          followUpReason: "Nach E-Mail-Versand",
          followUpStatus: "open"
        }
      });

      await prisma.campaignEnrollment.update({
        where: { id: item.enrollment.id },
        data: {
          currentStep: nextStep ? nextStep.stepNumber : item.step.stepNumber + 1,
          lastSentAt: sentAt,
          nextSendAt,
          status: nextStep ? "active" : "finished",
          lastActivityAt: sentAt
        }
      });

      sent += 1;
    } catch (error) {
      await prisma.emailSendLog.create({
        data: {
          campaignId,
          stepId: item.step.id,
          enrollmentId: item.enrollment.id,
          prospectId: item.enrollment.prospectId,
          email,
          status: "failed",
          subject,
          trackingToken,
          clickToken,
          emailVariantId: firstStepVariant?.id,
          emailVariantLabel: firstStepVariant?.label ?? item.enrollment.emailVariantLabel,
          landingpageUrl,
          error: error instanceof Error ? error.message : "Versand fehlgeschlagen"
        }
      });
      failed += 1;
    }
  }

  await completeCampaignIfDone(campaignId);

  const remainingDue = await getDueCampaignItems(campaignId, now, 1);
  const skipped = Math.max(0, dueItems.length - sent - failed);

  return {
    attempted: dueItems.length,
    sent,
    failed,
    skipped,
    remainingDue: remainingDue.length,
    reason: undefined
  };
}

export async function getDueCampaignItems(
  campaignId: string,
  now: Date,
  limit = MAX_CAMPAIGN_BATCH_SIZE
): Promise<DueItem[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      emailVariants: { where: { isActive: true }, orderBy: { label: "asc" } },
      enrollments: {
        where: {
          status: "active",
          prospect: {
            decisionMakerEmail: { not: null },
            slug: { not: null },
            landingpageReviewStatus: "approved",
            companyStatus: { notIn: ["inactive", "unreachable"] }
          }
        },
        include: {
          prospect: {
            select: {
              id: true,
              slug: true,
              companyName: true,
              city: true,
              decisionMakerName: true,
              firstName: true,
              lastName: true,
              salutation: true,
              decisionMakerEmail: true,
              companyEmail: true,
              companyStatus: true,
              landingpageUrl: true,
              landingpageReviewStatus: true,
              bookingUrl: true,
              calendarUrl: true
            }
          },
          sendLogs: {
            where: { status: "sent" },
            select: { stepId: true }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!campaign || !["active", "scheduled"].includes(getEffectiveCampaignSendingStatus(campaign))) {
    return [];
  }

  const dueItems: DueItem[] = [];
  const batchLimit = clampBatchSize(limit);

  for (const enrollment of campaign.enrollments) {
    if (!canUseLandingpageForCampaign(enrollment.prospect) || !canContactCampaignProspect(enrollment.prospect)) {
      continue;
    }
    if (enrollment.nextSendAt && enrollment.nextSendAt > now) {
      continue;
    }

    const nextStep = getCurrentActiveCampaignStep(campaign.steps, enrollment.currentStep);
    if (!nextStep) {
      continue;
    }

    const dueAt = enrollment.nextSendAt ?? addDays(enrollment.createdAt, nextStep.delayDays);
    if (dueAt > now) {
      continue;
    }

    dueItems.push({
      campaign: {
        status: campaign.status,
        sendingStatus: campaign.sendingStatus,
        steps: campaign.steps,
        emailVariants: campaign.emailVariants,
        trackingEnabled: campaign.trackingEnabled,
        manualGoApproved: campaign.manualGoApproved,
        scheduledStartAt: campaign.scheduledStartAt,
        timezone: campaign.timezone,
        sendWindowStart: campaign.sendWindowStart,
        sendWindowEnd: campaign.sendWindowEnd,
        weekdaysOnly: campaign.weekdaysOnly
      },
      enrollment,
      step: nextStep,
      emailVariant: nextStep.stepNumber === 1
        ? campaign.emailVariants.find((variant) => variant.id === enrollment.emailVariantId || variant.label === enrollment.emailVariantLabel) ?? campaign.emailVariants[0] ?? null
        : null
    });

    if (dueItems.length >= batchLimit) {
      break;
    }
  }

  return dueItems;
}

export function buildTrackingOpenUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_APP_URL ?? "";
  return `${appUrl.replace(/\/$/, "")}/api/track/open/${token}`;
}

export function buildTrackingClickUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_APP_URL ?? "";
  return `${appUrl.replace(/\/$/, "")}/api/track/click/${token}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function completeCampaignIfDone(campaignId: string): Promise<void> {
  const activeCount = await prisma.campaignEnrollment.count({
    where: { campaignId, status: "active" }
  });

  if (activeCount === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "completed", sendingStatus: "completed" }
    });
  }
}

export async function markCampaignEnrollmentReplied(enrollmentId: string, now = new Date()): Promise<void> {
  await prisma.campaignEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "replied",
      repliedAt: now,
      lastActivityAt: now,
      nextSendAt: null
    }
  });

  await markLatestSendLogReplied(enrollmentId, now);
}

export async function markProspectCampaignEnrollmentsReplied(prospectId: string, now = new Date()): Promise<number> {
  const enrollments = await prisma.campaignEnrollment.findMany({
    where: {
      prospectId,
      status: "active"
    },
    select: { id: true }
  });

  for (const enrollment of enrollments) {
    await markCampaignEnrollmentReplied(enrollment.id, now);
  }

  return enrollments.length;
}

export async function markCampaignEnrollmentFinished(
  enrollmentId: string,
  now = new Date(),
  reason: "booked" | "not_interested" | "finished" = "finished"
): Promise<void> {
  await prisma.campaignEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "finished",
      bookedAt: reason === "booked" ? now : undefined,
      notInterestedAt: reason === "not_interested" ? now : undefined,
      lastActivityAt: now,
      nextSendAt: null
    }
  });
}

export async function resetCampaignEnrollment(enrollmentId: string, now = new Date()): Promise<void> {
  await prisma.campaignEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "active",
      currentStep: 1,
      nextSendAt: now,
      lastSentAt: null,
      repliedAt: null,
      bookedAt: null,
      notInterestedAt: null,
      lastActivityAt: null
    }
  });
}

function normalizeCampaignSteps(steps: CampaignInput["steps"]): NormalizedCampaignStep[] {
  return steps
    .map((step, index) => {
      const stepNumber = step.stepNumber ?? index + 1;
      const body = step.body ?? step.bodyText ?? "";
      return {
        position: stepNumber - 1,
        stepNumber,
        delayDays: step.delayDays,
        subject: step.subject,
        bodyText: body,
        body,
        isActive: step.isActive ?? true,
        bodyHtml: step.bodyHtml
      };
    })
    .sort((left, right) => left.stepNumber - right.stepNumber);
}

function normalizeCampaignEmailVariants(
  variants: CampaignInput["emailVariants"],
  firstStep: NormalizedCampaignStep | undefined
): NormalizedCampaignEmailVariant[] {
  const source = variants?.length
    ? variants
    : [
        { label: "A", subject: firstStep?.subject || defaultFirstMailSubject, bodyText: firstStep?.bodyText || defaultFirstMailBodySie, weight: 50, isActive: true },
        { label: "B", subject: defaultFirstMailSubject, bodyText: defaultFirstMailBodyDu, weight: 50, isActive: true }
      ];

  const activeCount = source.filter((variant) => variant.isActive !== false).length;
  if (activeCount < 2) {
    throw new Error("Für A/B-Testing sind mindestens zwei aktive Varianten der ersten Mail erforderlich.");
  }

  return source.map((variant, index) => {
    validateFirstMailLandingpageRequirement(variant.bodyText);
    return {
      label: variant.label || String.fromCharCode(65 + index),
      subject: variant.subject,
      bodyText: variant.bodyText,
      weight: variant.weight ?? defaultVariantWeight(source.length, index),
      landingpageUrl: variant.landingpageUrl,
      isActive: variant.isActive ?? true
    };
  });
}

function defaultVariantWeight(count: number, index: number) {
  if (count === 2) return 50;
  if (count === 3) return index === 0 ? 34 : 33;
  return Math.floor(100 / Math.max(1, count));
}

function validateFirstMailLandingpageRequirement(bodyText: string) {
  if (!/{{\s*landingPageUrl\s*}}|{{\s*landingpageUrl\s*}}/.test(bodyText)) {
    throw new Error("Mail 1 muss {{landingPageUrl}} enthalten.");
  }
}

function assignEmailVariants(
  prospectIds: string[],
  variants: Array<{ id: string; label: string; weight: number }>,
  existing: Array<{ emailVariantId: string | null; emailVariantLabel: string | null }>
) {
  const activeVariants = variants.length >= 2 ? variants : [];
  const assignments = new Map<string, { id: string; label: string }>();
  if (activeVariants.length === 0) return assignments;

  const counts = new Map(activeVariants.map((variant) => [
    variant.id,
    existing.filter((entry) => entry.emailVariantId === variant.id || entry.emailVariantLabel === variant.label).length
  ]));

  for (const prospectId of prospectIds) {
    const totalAssigned = [...counts.values()].reduce((sum, value) => sum + value, 0);
    const next = activeVariants
      .slice()
      .sort((left, right) => {
        const leftTarget = (totalAssigned + 1) * (Math.max(0, left.weight) / 100);
        const rightTarget = (totalAssigned + 1) * (Math.max(0, right.weight) / 100);
        return (rightTarget - (counts.get(right.id) ?? 0)) - (leftTarget - (counts.get(left.id) ?? 0));
      })[0];
    if (!next) continue;
    assignments.set(prospectId, { id: next.id, label: next.label });
    counts.set(next.id, (counts.get(next.id) ?? 0) + 1);
  }

  return assignments;
}

function resolveLandingpageUrl(prospect: { slug: string | null; landingpageUrl?: string | null }, override?: string | null) {
  return override || prospect.landingpageUrl || (prospect.slug ? buildLandingpageUrl(prospect.slug) : "");
}

function buildFirstStepHtml(bodyText: string, landingpageUrl: string, isFirstStep: boolean) {
  const html = escapeHtml(bodyText).replace(/\n/g, "<br>");
  if (!isFirstStep) return html;
  return `${html}<p><a href="${escapeHtml(landingpageUrl)}">Persönliche Seite ansehen</a></p>`;
}

function usesDuForm(prospect: { salutation?: string | null }) {
  return /(^|\s)du($|\s)|du-form|per du/i.test(prospect.salutation ?? "");
}

function getCurrentActiveCampaignStep(steps: CampaignStepLike[], currentStepNumber: number): CampaignStepLike | null {
  return steps
    .filter((step) => step.isActive && step.stepNumber >= currentStepNumber)
    .sort((left, right) => left.stepNumber - right.stepNumber)[0] ?? null;
}

function getNextActiveCampaignStep(steps: CampaignStepLike[], currentStepNumber: number): CampaignStepLike | null {
  return steps
    .filter((step) => step.isActive && step.stepNumber > currentStepNumber)
    .sort((left, right) => left.stepNumber - right.stepNumber)[0] ?? null;
}

async function markLatestSendLogReplied(enrollmentId: string, repliedAt: Date): Promise<void> {
  const latestLog = await prisma.emailSendLog.findFirst({
    where: {
      enrollmentId,
      status: "sent"
    },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    select: { id: true }
  });

  if (!latestLog) {
    return;
  }

  await prisma.emailSendLog.update({
    where: { id: latestLog.id },
    data: { repliedAt }
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function canUseLandingpageForCampaign(prospect: { slug: string | null; landingpageReviewStatus: string }) {
  return Boolean(prospect.slug && prospect.landingpageReviewStatus === "approved");
}

function canContactCampaignProspect(prospect: { companyStatus: string; decisionMakerEmail: string | null; companyEmail: string | null }) {
  const email = prospect.decisionMakerEmail || prospect.companyEmail;
  if (!email) return false;
  return !["inactive", "unreachable"].includes(prospect.companyStatus);
}
