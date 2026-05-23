import { z } from "zod";
import {
  buildLandingpageUrl,
  createTrackingToken,
  renderHtmlTemplate,
  renderTemplate
} from "@/lib/campaigns";
import {
  appendOpenTrackingPixel,
  appendUtmParams,
  buildTrackingClickUrl,
  readTrackingSettings,
  resolveEmailTracking
} from "@/lib/app-settings";
import { delay } from "@/lib/email-delay";
import { checkEmailSendingLimits, getNextLimitRetryAt } from "@/lib/email-limits";
import { generateCampaignCopy } from "@/lib/ai-copy";
import { appendSignature, getDefaultEmailSignature } from "@/lib/email-signature";
import { sendSmtpMail, type MailPayload, type MailSendResult } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { generateProspectSlug } from "@/lib/slug";
import { canSendCampaignNow, getNextAllowedCampaignSendAt } from "@/lib/scheduling";
import { generateAndApplyMockVideo, type VideoTone } from "@/lib/video";
import { calculateFollowUpAt } from "@/lib/follow-ups";

export const campaignFlowPayloadSchema = z.object({
  selectedProspectIds: z.array(z.string().min(1)).min(1).max(100),
  generateLandingpage: z.boolean().optional().default(true),
  generateVideo: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(true),
  emailTemplateId: z.string().optional(),
  videoTemplateId: z.string().optional()
});

export type CampaignFlowPayload = z.infer<typeof campaignFlowPayloadSchema>;

type SendMail = (payload: MailPayload) => Promise<MailSendResult>;
type GenerateCopy = typeof generateCampaignCopy;
type GenerateVideo = typeof generateAndApplyMockVideo;

export type CampaignFlowProspectResult = {
  prospectId: string;
  landingpageUrl?: string;
  videoUrl?: string | null;
  emailStatus: "sent" | "failed" | "skipped";
  errors: string[];
};

export async function runCampaignFlow({
  campaignId,
  generateCopy = generateCampaignCopy,
  generateVideo = generateAndApplyMockVideo,
  input,
  sendMail = sendSmtpMail
}: {
  campaignId: string;
  input: CampaignFlowPayload;
  generateCopy?: GenerateCopy;
  generateVideo?: GenerateVideo;
  sendMail?: SendMail;
}) {
  const selectedProspectIds = [...new Set(input.selectedProspectIds.filter(Boolean))];
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { flowSettings: true }
  });
  if (!campaign) {
    throw new Error("Kampagne nicht gefunden.");
  }
  if (!campaign.offerId) {
    throw new Error("Bitte Angebot auswählen");
  }

  console.info("CAMPAIGN_SEND", {
    campaignId,
    offerId: campaign.offerId,
    targetGroupId: campaign.targetGroupId ?? null
  });

  await prisma.campaignFlowSettings.upsert({
    where: { campaignId },
    update: {
      generateLandingpage: input.generateLandingpage,
      generateVideo: input.generateVideo,
      sendEmail: input.sendEmail,
      emailTemplateId: input.emailTemplateId,
      videoTemplateId: input.videoTemplateId
    },
    create: {
      campaignId,
      generateLandingpage: input.generateLandingpage,
      generateVideo: input.generateVideo,
      sendEmail: input.sendEmail,
      emailTemplateId: input.emailTemplateId,
      videoTemplateId: input.videoTemplateId
    }
  });

  if (input.sendEmail && !campaign.trackingEnabled) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { trackingEnabled: true } });
  }

  const step = input.sendEmail ? await ensureFlowCampaignStep(campaignId) : null;
  const results: CampaignFlowProspectResult[] = [];

  for (const prospectId of selectedProspectIds) {
    results.push(await runProspectFlow({
      campaignId,
      generateCopy,
      generateVideo,
      input,
      prospectId,
      sendMail,
      stepId: step?.id
    }));
  }

  return {
    campaignId,
    requested: selectedProspectIds.length,
    completed: results.filter((result) => result.errors.length === 0).length,
    failed: results.filter((result) => result.errors.length > 0).length,
    results
  };
}

async function runProspectFlow({
  campaignId,
  generateCopy,
  generateVideo,
  input,
  prospectId,
  sendMail,
  stepId
}: {
  campaignId: string;
  input: CampaignFlowPayload;
  prospectId: string;
  stepId?: string;
  generateCopy: GenerateCopy;
  generateVideo: GenerateVideo;
  sendMail: SendMail;
}): Promise<CampaignFlowProspectResult> {
  const result: CampaignFlowProspectResult = {
    prospectId,
    emailStatus: input.sendEmail ? "failed" : "skipped",
    errors: []
  };

  let landingpageUrl: string | undefined;
  let videoUrl: string | null | undefined;

  try {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) {
      throw new Error("Prospect nicht gefunden.");
    }

    if (input.generateLandingpage) {
      landingpageUrl = await prepareProspectLandingpage(prospect.id);
      result.landingpageUrl = landingpageUrl;
    } else if (prospect.slug) {
      landingpageUrl = prospect.landingpageUrl ?? buildLandingpageUrl(prospect.slug);
      result.landingpageUrl = landingpageUrl;
    }

    if (input.generateVideo) {
      try {
        const job = await generateVideo({
          prospectId,
          campaignId,
          videoTemplateId: input.videoTemplateId,
          tone: "direkt" as VideoTone
        });
        videoUrl = job.videoUrl ?? null;
        result.videoUrl = videoUrl;
        await prisma.prospect.update({ where: { id: prospectId }, data: { videoUrl } });
      } catch (error) {
        result.errors.push(getErrorMessage(error, "Video konnte nicht erzeugt werden."));
      }
    } else {
      videoUrl = prospect.personalVideoUrl ?? prospect.videoUrl ?? null;
    }

    if (input.sendEmail) {
      if (!stepId) {
        throw new Error("Kampagnen-Step fehlt.");
      }

      try {
        await generateAndSendFlowEmail({
          campaignId,
          generateCopy,
          landingpageUrl,
          prospectId,
          sendMail,
          stepId,
          videoUrl
        });
        result.emailStatus = "sent";
      } catch (error) {
        result.emailStatus = "failed";
        result.errors.push(getErrorMessage(error, "E-Mail konnte nicht gesendet werden."));
        await prisma.prospect.update({ where: { id: prospectId }, data: { emailStatus: "failed" } });
      }
    } else {
      await prisma.prospect.update({ where: { id: prospectId }, data: { emailStatus: "skipped" } });
    }
  } catch (error) {
    result.errors.push(getErrorMessage(error, "Flow konnte fuer Prospect nicht ausgefuehrt werden."));
  }

  return result;
}

async function prepareProspectLandingpage(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) {
    throw new Error("Prospect nicht gefunden.");
  }

  let slug = prospect.slug ?? generateProspectSlug(prospect.companyName, prospect.city);
  const existing = await prisma.prospect.findFirst({
    where: {
      slug,
      NOT: { id: prospectId }
    }
  });

  if (existing) {
    slug = `${slug}-${prospect.id.slice(0, 6)}`;
  }

  const landingpageUrl = buildLandingpageUrl(slug);
  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      landingpageUrl,
      slug,
      status: "landingpage_ready",
      landingpageReviewStatus: "needs_review"
    }
  });

  return landingpageUrl;
}

async function generateAndSendFlowEmail({
  campaignId,
  generateCopy,
  landingpageUrl,
  prospectId,
  sendMail,
  stepId,
  videoUrl
}: {
  campaignId: string;
  prospectId: string;
  stepId: string;
  landingpageUrl?: string;
  videoUrl?: string | null;
  generateCopy: GenerateCopy;
  sendMail: SendMail;
}) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect?.decisionMakerEmail) {
    throw new Error("Prospect hat keine E-Mail-Adresse.");
  }
  if (!canUseLandingpageForCampaign(prospect)) {
    throw new Error("Landingpage ist noch nicht freigegeben.");
  }

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
      trackingEnabled: true,
      flowSettings: { select: { followUpDays: true } }
    }
  });
  if (!campaign) {
    throw new Error("Kampagne nicht gefunden.");
  }

  const enrollment = await prisma.campaignEnrollment.upsert({
    where: { campaignId_prospectId: { campaignId, prospectId } },
    update: { status: "active" },
    create: { campaignId, prospectId }
  });

  const copy = await generateCopy({
    campaignId,
    prospectId,
    tone: "direkt",
    numberOfSteps: 1,
    variantCount: 2,
    goal: "eine personalisierte Landingpage ansehen und einen kurzen Austausch starten"
  });
  const firstStep = copy.steps[0];
  if (!firstStep) {
    throw new Error("KI hat keine E-Mail erzeugt.");
  }

  const trackingSettings = await readTrackingSettings();
  const tracking = resolveEmailTracking(trackingSettings, campaign.trackingEnabled);
  const trackingToken = tracking.openEnabled ? createTrackingToken() : undefined;
  const clickToken = tracking.clickEnabled ? createTrackingToken() : undefined;
  const finalLandingpageUrl = appendUtmParams(landingpageUrl ?? (prospect.slug ? buildLandingpageUrl(prospect.slug) : ""), trackingSettings);
  const trackedLandingpageUrl = finalLandingpageUrl && clickToken ? buildTrackingClickUrl(clickToken, trackingSettings) : finalLandingpageUrl;
  const subject = renderTemplate(firstStep.subject, prospect, trackedLandingpageUrl);
  const bodyText = appendFlowLinks(renderTemplate(firstStep.body, prospect, trackedLandingpageUrl), {
    landingpageUrl: trackedLandingpageUrl,
    videoUrl
  });
  const html = appendOpenTrackingPixel(renderHtmlTemplate(bodyText, prospect, trackedLandingpageUrl), trackingToken, trackingSettings);
  const signature = await getDefaultEmailSignature();
  const signed = appendSignature({ bodyHtml: html, bodyText, signature });

  const scheduleDecision = canSendCampaignNow(campaign, new Date());
  if (!scheduleDecision.allowed) {
    if (
      scheduleDecision.reason === "Versandfenster hat noch nicht begonnen." ||
      scheduleDecision.reason === "Versandfenster ist bereits beendet." ||
      scheduleDecision.reason === "Versand ist auf Werktage beschränkt."
    ) {
      await prisma.campaignEnrollment.update({
        where: { id: enrollment.id },
        data: {
          nextSendAt: getNextAllowedCampaignSendAt(campaign, new Date()),
          lastActivityAt: new Date()
        }
      });
    }
    throw new Error(scheduleDecision.reason ?? "Versand derzeit nicht erlaubt.");
  }

  const limitDecision = await checkEmailSendingLimits({ prospectId, now: new Date() });
  if (!limitDecision.allowed) {
    await prisma.campaignEnrollment.update({
      where: { id: enrollment.id },
      data: {
        nextSendAt: limitDecision.nextSendAt ?? getNextLimitRetryAt(new Date()),
        lastActivityAt: new Date()
      }
    });
    await prisma.emailSendLog.create({
      data: {
        campaignId,
        stepId,
        enrollmentId: enrollment.id,
        prospectId,
        email: prospect.decisionMakerEmail,
        status: "failed",
        subject,
        trackingToken,
        clickToken,
        landingpageUrl: finalLandingpageUrl,
        error: "Limit erreicht"
      }
    });
    throw new Error("Limit erreicht");
  }

  await delay();
  const dispatchAt = new Date();
  const dispatchDecision = canSendCampaignNow(campaign, dispatchAt);
  if (!dispatchDecision.allowed) {
    if (
      dispatchDecision.reason === "Versandfenster hat noch nicht begonnen." ||
      dispatchDecision.reason === "Versandfenster ist bereits beendet." ||
      dispatchDecision.reason === "Versand ist auf Werktage beschränkt."
    ) {
      await prisma.campaignEnrollment.update({
        where: { id: enrollment.id },
        data: {
          nextSendAt: getNextAllowedCampaignSendAt(campaign, dispatchAt),
          lastActivityAt: dispatchAt
        }
      });
    }
    throw new Error(dispatchDecision.reason ?? "Versand derzeit nicht erlaubt.");
  }
  const mailResult = await sendMail({
    to: prospect.decisionMakerEmail,
    subject,
    text: signed.text,
    html: signed.html
  });

  await prisma.emailSendLog.create({
    data: {
      campaignId,
      stepId,
      enrollmentId: enrollment.id,
      prospectId,
      email: prospect.decisionMakerEmail,
      status: "sent",
      subject,
      trackingToken,
      clickToken,
      landingpageUrl: finalLandingpageUrl,
      messageId: mailResult.messageId,
      sentAt: new Date()
    }
  });

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      emailStatus: "sent",
      lastContactedAt: new Date(),
      lastEmailSentAt: new Date(),
      followUpAt: calculateFollowUpAt(new Date(), campaign.flowSettings?.followUpDays ?? null),
      followUpReason: "Nach E-Mail-Versand",
      followUpStatus: "open",
      status: "contacted"
    }
  });
}

function appendFlowLinks(body: string, { landingpageUrl, videoUrl }: { landingpageUrl?: string; videoUrl?: string | null }) {
  const lines = [body.trim()];
  if (landingpageUrl && !body.includes(landingpageUrl)) {
    lines.push("", landingpageUrl);
  }
  if (videoUrl && !body.includes(videoUrl)) {
    lines.push("", videoUrl);
  }
  return lines.join("\n");
}

async function ensureFlowCampaignStep(campaignId: string) {
  const existing = await prisma.campaignStep.findFirst({
    where: { campaignId, position: 0 },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return prisma.campaignStep.create({
    data: {
      campaignId,
      position: 0,
      stepNumber: 1,
      delayDays: 0,
      subject: "Kurze Frage zu {{companyName}}",
      bodyText: "Hallo {{decisionMakerName}},\n\nich habe eine kurze Seite fuer {{companyName}} vorbereitet:\n{{landingpageUrl}}",
      body: "Hallo {{decisionMakerName}},\n\nich habe eine kurze Seite fuer {{companyName}} vorbereitet:\n{{landingpageUrl}}",
      isActive: true
    }
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function canUseLandingpageForCampaign(prospect: { slug: string | null; landingpageReviewStatus: string }) {
  return Boolean(prospect.slug && prospect.landingpageReviewStatus === "approved");
}
