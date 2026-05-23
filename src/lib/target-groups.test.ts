import { describe, expect, it } from "vitest";
import { POST as createTargetGroup } from "../../app/api/target-groups/route";
import { PATCH as updateProspect } from "../../app/api/prospects/[id]/route";
import { POST as createCampaign } from "../../app/api/campaigns/route";
import { prisma } from "@/lib/prisma";
import { buildCampaignCopyPrompt } from "@/lib/ai-copy";

describe("target groups", () => {
  it("creates a target group", async () => {
    const response = await createTargetGroup(new Request("http://localhost/api/target-groups", {
      method: "POST",
      body: JSON.stringify({
        name: "Handwerk",
        description: "Handwerksbetriebe",
        industryKeywords: "baustelle, angebot",
        painKeywords: "termine, anfahrt",
        icpRules: "{\"employeeMin\":3}",
        emailTone: "locker",
        landingpageStyle: "praktisch",
        videoStyle: "kurz"
      })
    }));
    const body = await response.json() as { id: string; name: string; industryKeywords: string[] };

    expect(response.status).toBe(201);
    expect(body.name).toBe("Handwerk");
    expect(body.industryKeywords).toContain("baustelle");

    await prisma.targetGroup.delete({ where: { id: body.id } });
  });

  it("assigns target groups to prospects and campaigns", async () => {
    const targetGroup = await prisma.targetGroup.create({
      data: {
        name: "Ärzte",
        description: "Praxen",
        industryKeywords: ["praxis"],
        painKeywords: ["termin"],
        icpRules: {},
        emailTone: "professionell",
        landingpageStyle: "vertrauensvoll",
        videoStyle: "ruhig"
      }
    });
    const prospect = await prisma.prospect.create({
      data: { companyName: `TG Prospect ${Date.now()}`, city: "Berlin", country: "DE", businessFields: [] }
    });
    const offer = await prisma.offer.create({
      data: {
        workspaceId: "default",
        name: `TG Offer ${Date.now()}`,
        targetGroupId: targetGroup.id,
        serviceDescription: "Target group service",
        coreProblems: ["Problem"],
        solutions: ["Solution"]
      }
    });

    const prospectResponse = await updateProspect(
      new Request("http://localhost/api/prospects/id", { method: "PATCH", body: JSON.stringify({ targetGroupId: targetGroup.id }) }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const campaignResponse = await createCampaign(new Request("http://localhost/api/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: `TG Campaign ${Date.now()}`,
        targetGroupId: targetGroup.id,
        offerId: offer.id,
        steps: [{ delayDays: 0, subject: "Hallo", bodyText: "Text {{landingpageUrl}}" }]
      })
    }));
    const campaign = await campaignResponse.json() as { id: string; targetGroupId: string };

    expect(prospectResponse.status).toBe(200);
    expect((await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } })).targetGroupId).toBe(targetGroup.id);
    expect(campaign.targetGroupId).toBe(targetGroup.id);

    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });

  it("changes AI prompt context per target group", () => {
    const base = { prospect: { companyName: "Test" }, tone: "direkt", variantCount: 2, goal: "Termin" };
    const doctors = buildCampaignCopyPrompt({
      ...base,
      targetGroup: { id: "1", name: "Ärzte", description: "Praxen", industryKeywords: ["praxis"], painKeywords: ["termin"], icpRules: {}, emailTone: "professionell", landingpageStyle: "vertrauensvoll", videoStyle: "ruhig" }
    });
    const craftsmen = buildCampaignCopyPrompt({
      ...base,
      targetGroup: { id: "2", name: "Handwerk", description: "Betriebe", industryKeywords: ["baustelle"], painKeywords: ["angebot"], icpRules: {}, emailTone: "locker", landingpageStyle: "praktisch", videoStyle: "kurz" }
    });

    expect(doctors.user).toContain("Ärzte");
    expect(craftsmen.user).toContain("Handwerk");
    expect(doctors.user).not.toBe(craftsmen.user);
  });
});
