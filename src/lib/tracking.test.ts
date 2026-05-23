import { describe, expect, it } from "vitest";
import { createTrackingToken, renderTemplate } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { GET as trackOpen } from "../../app/api/track/open/[token]/route";
import { GET as trackClick } from "../../app/api/track/click/[token]/route";

describe("campaign tracking", () => {
  it("creates tracking tokens", () => {
    expect(createTrackingToken()).toHaveLength(32);
  });

  it("renders tracking links only when a tracked URL is supplied", () => {
    const prospect = {
      id: "p",
      slug: "bauer",
      companyName: "Bauer",
      city: "Hamburg",
      decisionMakerName: null,
      decisionMakerEmail: "a@b.de"
    };

    expect(renderTemplate("Link {{landingpageUrl}}", prospect)).toContain("/p/bauer");
    expect(renderTemplate("Link {{landingpageUrl}}", prospect, "/api/track/click/token")).toContain(
      "/api/track/click/token"
    );
  });

  it("increments open and click counts", async () => {
    const prospect = await prisma.prospect.create({
      data: {
        companyName: "Tracking Test",
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: "track@example.com",
        slug: `tracking-${Date.now()}`
      }
    });
    const offer = await prisma.offer.create({
      data: {
        workspaceId: "default",
        name: `Tracking Offer ${Date.now()}`,
        serviceDescription: "Tracking service",
        coreProblems: ["Problem"],
        solutions: ["Solution"]
      }
    });
    const campaign = await prisma.campaign.create({ data: { name: "Tracking Test", status: "active", offerId: offer.id } });
    const step = await prisma.campaignStep.create({
      data: { campaignId: campaign.id, position: 0, delayDays: 0, subject: "S", bodyText: "B" }
    });
    const enrollment = await prisma.campaignEnrollment.create({
      data: { campaignId: campaign.id, prospectId: prospect.id }
    });
    const log = await prisma.emailSendLog.create({
      data: {
        campaignId: campaign.id,
        stepId: step.id,
        enrollmentId: enrollment.id,
        prospectId: prospect.id,
        email: "track@example.com",
        status: "sent",
        subject: "S",
        trackingToken: `open-${Date.now()}`,
        clickToken: `click-${Date.now()}`,
        landingpageUrl: "http://localhost:3000/p/test"
      }
    });

    await trackOpen(new Request("http://localhost"), { params: Promise.resolve({ token: log.trackingToken! }) });
    await trackClick(new Request("http://localhost"), { params: Promise.resolve({ token: log.clickToken! }) });

    const updated = await prisma.emailSendLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(updated.openCount).toBe(1);
    expect(updated.clickCount).toBe(1);

    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });
});
