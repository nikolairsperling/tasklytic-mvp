import { describe, expect, it } from "vitest";
import { runCampaignFlow } from "@/lib/campaign-flow";
import { prisma } from "@/lib/prisma";

describe("campaign outreach flow", () => {
  it("runs landingpage, video, generated email and tracking for multiple prospects", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const suffix = Date.now();
    const offer = await prisma.offer.create({
      data: {
        workspaceId: "default",
        name: `Flow Offer ${suffix}`,
        serviceDescription: "Flow service",
        coreProblems: ["Problem"],
        solutions: ["Solution"]
      }
    });
    const campaign = await prisma.campaign.create({
      data: { name: `Flow Test ${suffix}`, status: "active", offerId: offer.id }
    });
    const prospects = await Promise.all([
      prisma.prospect.create({
        data: {
          companyName: `Flow Alpha ${suffix}`,
          city: "Hamburg",
          country: "DE",
          businessFields: [],
          decisionMakerName: "Max Alpha",
          decisionMakerEmail: `alpha-${suffix}@example.com`
        }
      }),
      prisma.prospect.create({
        data: {
          companyName: `Flow Beta ${suffix}`,
          city: "Berlin",
          country: "DE",
          businessFields: [],
          decisionMakerName: "Mia Beta",
          decisionMakerEmail: `beta-${suffix}@example.com`
        }
      })
    ]);

    const sentMessages: Array<{ to: string; text: string; html?: string }> = [];
    const result = await runCampaignFlow({
      campaignId: campaign.id,
      input: {
        selectedProspectIds: prospects.map((prospect) => prospect.id),
        generateLandingpage: true,
        generateVideo: true,
        sendEmail: true
      },
      generateCopy: async () => ({
        steps: [{
          subject: "Kurze Frage zu {{companyName}}",
          body: "Hallo {{decisionMakerName}}, ich habe eine kurze Seite fuer {{companyName}} vorbereitet: {{landingpageUrl}}",
          delayDays: 0
        }]
      }),
      generateVideo: async ({ prospectId }) => ({
        id: `video-${prospectId}`,
        prospectId,
        videoUrl: `/mock-videos/${prospectId}`
      }) as never,
      sendMail: async (payload) => {
        sentMessages.push({ to: payload.to, text: payload.text, html: payload.html });
        return { messageId: `message-${sentMessages.length}` };
      }
    });

    expect(result.requested).toBe(2);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(2);
    expect(sentMessages).toHaveLength(0);

    const updatedProspects = await prisma.prospect.findMany({
      where: { id: { in: prospects.map((prospect) => prospect.id) } },
      orderBy: { companyName: "asc" }
    });
    expect(updatedProspects.every((prospect) => prospect.slug && prospect.landingpageUrl)).toBe(true);
    expect(updatedProspects.every((prospect) => prospect.videoUrl?.startsWith("/mock-videos/"))).toBe(true);
    expect(updatedProspects.every((prospect) => prospect.landingpageReviewStatus === "needs_review")).toBe(true);

    const logs = await prisma.emailSendLog.findMany({ where: { campaignId: campaign.id } });
    expect(logs).toHaveLength(0);

    const settings = await prisma.campaignFlowSettings.findUnique({ where: { campaignId: campaign.id } });
    expect(settings?.generateLandingpage).toBe(true);
    expect(settings?.generateVideo).toBe(true);
    expect(settings?.sendEmail).toBe(true);

    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: prospects.map((prospect) => prospect.id) } } });
  });

  it("continues with the next prospect when one fails", async () => {
    const suffix = Date.now();
    const offer = await prisma.offer.create({
      data: {
        workspaceId: "default",
        name: `Flow Failure Offer ${suffix}`,
        serviceDescription: "Flow service",
        coreProblems: ["Problem"],
        solutions: ["Solution"]
      }
    });
    const campaign = await prisma.campaign.create({
      data: { name: `Flow Failure Test ${suffix}`, status: "active", offerId: offer.id }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Flow Gamma ${suffix}`,
        city: "Munich",
        country: "DE",
        businessFields: [],
        decisionMakerName: "Max Gamma",
        decisionMakerEmail: `gamma-${suffix}@example.com`
      }
    });

    const result = await runCampaignFlow({
      campaignId: campaign.id,
      input: {
        selectedProspectIds: ["missing-prospect", prospect.id],
        generateLandingpage: true,
        generateVideo: false,
        sendEmail: false
      }
    });

    expect(result.requested).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results.find((item) => item.prospectId === "missing-prospect")?.errors.length).toBeGreaterThan(0);

    const updated = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(updated.landingpageUrl).toContain("/p/");

    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });
});
