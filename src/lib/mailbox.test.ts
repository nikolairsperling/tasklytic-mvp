import { describe, expect, it } from "vitest";
import { getSafeMailboxSettings, matchInboundEmail, saveMailboxSettings } from "@/lib/mailbox";
import { getMailboxWarmupAllowedEmailsToday } from "@/lib/mailbox-warmup";
import { prisma } from "@/lib/prisma";
import { markProspectCampaignEnrollmentsReplied } from "@/lib/campaigns";

describe("mailbox settings and matching", () => {
  it("does not expose mailbox passwords", async () => {
    const original = process.env.MAILBOX_SETTINGS_SECRET;
    process.env.MAILBOX_SETTINGS_SECRET = "mailbox-secret";
    await prisma.mailboxSettings.deleteMany({ where: { id: "default" } });
    await saveMailboxSettings({
      host: "imap.example.com",
      port: 993,
      secure: true,
      user: "user",
      password: "secret-password",
      warmupStartDate: "2026-04-20",
      warmupLevel: 5
    });

    const safe = await getSafeMailboxSettings();
    expect(JSON.stringify(safe)).not.toContain("secret-password");
    expect(safe.values.passwordSet).toBe(true);
    expect(safe.values.allowedEmailsToday).toBeGreaterThanOrEqual(5);
    expect(safe.values.warmupStartDate).toBe("2026-04-20");
    expect(safe.values.warmupLevel).toBe("5");

    await prisma.mailboxSettings.deleteMany({ where: { id: "default" } });
    if (original === undefined) delete process.env.MAILBOX_SETTINGS_SECRET;
    else process.env.MAILBOX_SETTINGS_SECRET = original;
  });

  it("calculates mailbox warmup limits from the start date and level", () => {
    expect(
      getMailboxWarmupAllowedEmailsToday(
        { warmupStartDate: "2026-04-20", warmupLevel: 5 },
        new Date("2026-04-20T10:00:00Z"),
        50
      )
    ).toBe(5);
    expect(
      getMailboxWarmupAllowedEmailsToday(
        { warmupStartDate: "2026-04-20", warmupLevel: 5 },
        new Date("2026-04-23T10:00:00Z"),
        50
      )
    ).toBe(8);
    expect(
      getMailboxWarmupAllowedEmailsToday(
        { warmupStartDate: "2026-04-20", warmupLevel: 5 },
        new Date("2026-04-19T10:00:00Z"),
        50
      )
    ).toBe(50);
  });

  it("deduplicates inbound emails by messageId", async () => {
    const messageId = `dedupe-${Date.now()}@example.com`;
    await prisma.inboundEmail.create({
      data: { messageId, fromEmail: "a@example.com", subject: "A", bodyText: "B", receivedAt: new Date() }
    });
    await expect(
      prisma.inboundEmail.create({
        data: { messageId, fromEmail: "a@example.com", subject: "A", bodyText: "B", receivedAt: new Date() }
      })
    ).rejects.toThrow();
    await prisma.inboundEmail.delete({ where: { messageId } });
  });

  it("matches replies by fromEmail", async () => {
    const suffix = Date.now();
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Reply Match ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `reply-match-${suffix}@example.com`
      }
    });
    const match = await matchInboundEmail(`reply-match-${suffix}@example.com`);
    expect(match.prospectId).toBe(prospect.id);
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("stops follow-ups for a prospect when a reply arrives", async () => {
    const suffix = Date.now();
    const offer = await prisma.offer.create({
      data: {
        workspaceId: "default",
        name: `Reply Stop Offer ${suffix}`,
        serviceDescription: "Mailbox service",
        coreProblems: ["Problem"],
        solutions: ["Solution"]
      }
    });
    const campaign = await prisma.campaign.create({
      data: {
        name: `Reply Stop ${suffix}`,
        status: "active",
        offerId: offer.id,
        manualGoApproved: true,
        weekdaysOnly: false,
        steps: {
          create: { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Body", body: "Body", isActive: true }
        }
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Reply Stop ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `reply-stop-${suffix}@example.com`,
        landingpageReviewStatus: "approved",
        companyStatus: "active"
      }
    });
    const enrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId: campaign.id,
        prospectId: prospect.id,
        currentStep: 1,
        nextSendAt: new Date(),
        status: "active"
      }
    });

    const repliedCount = await markProspectCampaignEnrollmentsReplied(prospect.id, new Date("2026-04-27T10:00:00Z"));

    expect(repliedCount).toBe(1);
    const updatedEnrollment = await prisma.campaignEnrollment.findUnique({ where: { id: enrollment.id } });
    expect(updatedEnrollment?.status).toBe("replied");
    expect(updatedEnrollment?.nextSendAt).toBeNull();

    await prisma.emailSendLog.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaignEnrollment.delete({ where: { id: enrollment.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });
});
