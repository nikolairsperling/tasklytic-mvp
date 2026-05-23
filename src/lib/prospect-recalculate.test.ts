import { afterEach, describe, expect, it } from "vitest";
import { PATCH as patchTargetGroup } from "../../app/api/target-groups/[id]/route";
import { recalculateProspect } from "@/lib/prospect-recalculate";
import { prisma } from "@/lib/prisma";
import { defaultUserId, upsertUserOffer } from "@/lib/user-offer";

afterEach(async () => {
  await prisma.campaign.deleteMany({ where: { offer: { workspaceId: "default" } } });
  await prisma.offer.deleteMany({ where: { workspaceId: "default", campaigns: { none: {} } } });
  await prisma.userOffer.deleteMany({ where: { userId: defaultUserId } });
});

describe("prospect recalculation", () => {
  it("updates score, pain and suggested campaign", async () => {
    const suffix = `recalc-${Date.now()}`;
    await upsertUserOffer({
      businessName: "Tasklytic",
      serviceDescription: "Automatisierte Anfrage- und Dispo-Prozesse",
      targetAudienceDescription: "Speditionen und Logistikunternehmen",
      coreProblems: ["keine online anfrage", "veraltete website"],
      solutions: ["digitale Workflows"],
      valueProposition: "schnelle Umsetzung",
      toneOfVoice: "klar"
    });
    const targetGroup = await prisma.targetGroup.create({
      data: {
        name: `Spedition ${suffix}`,
        description: "Logistikunternehmen mit Fuhrpark",
        industryKeywords: ["spedition", "logistik"],
        painKeywords: ["veraltet", "online anfrage"],
        icpRules: {},
        emailTone: "direkt",
        landingpageStyle: "operativ",
        videoStyle: "kurz"
      }
    });
    const offer = await prisma.offer.create({
      data: {
        workspaceId: "default",
        name: `Offer ${suffix}`,
        targetGroupId: targetGroup.id,
        serviceDescription: "Automatisierte Anfrage- und Dispo-Prozesse",
        coreProblems: ["keine online anfrage"],
        solutions: ["digitale Workflows"]
      }
    });
    const campaign = await prisma.campaign.create({
      data: { name: `Kampagne ${suffix}`, status: "active", targetGroupId: targetGroup.id, offerId: offer.id }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Spedition ${suffix}`,
        city: "Bremen",
        country: "DE",
        businessFields: ["Transport"],
        websiteUrl: "https://example.com",
        companyStatus: "active",
        decisionMakerEmail: "dispo@example.com",
        targetGroupId: targetGroup.id,
        websiteMaturitySignal: "veraltete Website ohne online Anfrage",
        vehicleCount: 30
      }
    });

    const result = await recalculateProspect(prospect.id);
    const updated = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });

    expect(updated.icpFitScore).toBeGreaterThan(0);
    expect(updated.painType).toBeTruthy();
    expect(updated.painSummary).toBeTruthy();
    expect(result.suggestedCampaignId).toBe(campaign.id);

    await prisma.prospect.delete({ where: { id: prospect.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });

  it("target group PATCH triggers recalculation for assigned prospects", async () => {
    await prisma.offer.deleteMany({ where: { workspaceId: "default", campaigns: { none: {} } } });
    await prisma.userOffer.deleteMany({ where: { userId: defaultUserId } });
    const suffix = `tg-trigger-${Date.now()}`;
    const targetGroup = await prisma.targetGroup.create({
      data: {
        name: `Generic ${suffix}`,
        description: "Noch unspezifisch",
        industryKeywords: ["industrie"],
        painKeywords: ["bewerbung"],
        icpRules: {},
        emailTone: "direkt",
        landingpageStyle: "operativ",
        videoStyle: "kurz"
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Logistik ${suffix}`,
        city: "Hamburg",
        country: "DE",
        businessFields: ["Logistik"],
        targetGroupId: targetGroup.id,
        websiteMaturitySignal: "Bewerbung nur per Telefon"
      }
    });

    await patchTargetGroup(
      new Request(`http://localhost/api/target-groups/${targetGroup.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: targetGroup.name,
          description: "Logistik und Spedition",
          industryKeywords: ["logistik", "spedition"],
          painKeywords: ["telefon", "bewerbung"],
          icpRules: {},
          emailTone: "direkt",
          landingpageStyle: "operativ",
          videoStyle: "kurz"
        })
      }),
      { params: Promise.resolve({ id: targetGroup.id }) }
    );

    const updated = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(updated.icpFitScore).toBeGreaterThan(0);
    expect(updated.painType).toBeTruthy();
  });
});
