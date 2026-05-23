import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { POST as createFromLeads } from "../../app/api/campaigns/create-from-leads/route";
import { CampaignFlowWizard } from "@/components/admin/campaign-flow-wizard";
import { prisma } from "@/lib/prisma";

describe("campaign create-from-leads", () => {
  it("creates a campaign with offerId and targetGroupId and enrolls valid leads without sending", async () => {
    const suffix = Date.now();
    const targetGroup = await prisma.targetGroup.create({
      data: {
        name: `Flow TG ${suffix}`,
        industryKeywords: [],
        painKeywords: [],
        icpRules: {},
        emailTone: "direkt",
        landingpageStyle: "klar",
        videoStyle: "kurz"
      }
    });
    const offer = await prisma.offer.create({
      data: {
        workspaceId: "default",
        name: `Flow Offer ${suffix}`,
        targetGroupId: targetGroup.id,
        serviceDescription: "Service",
        coreProblems: ["Problem"],
        solutions: ["Solution"]
      }
    });
    const leads = await Promise.all([1, 2].map((index) => prisma.prospect.create({
      data: {
        companyName: `Flow Lead ${index} ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        companyStatus: "active",
        decisionMakerEmail: `flow-${index}-${suffix}@example.com`,
        slug: `flow-${index}-${suffix}`,
        landingpageUrl: `/p/flow-${index}-${suffix}`,
        landingpageReviewStatus: "approved"
      }
    })));

    const response = await createFromLeads(new Request("http://localhost/api/campaigns/create-from-leads", {
      method: "POST",
      body: JSON.stringify({
        prospectIds: [leads[0].id, leads[1].id, leads[1].id],
        targetGroupId: targetGroup.id,
        offerId: offer.id,
        name: `Flow Campaign ${suffix}`
      })
    }));
    const body = await response.json() as { campaignId: string; added: number; skipped: number; failed: number };
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: body.campaignId }, include: { enrollments: true, sendLogs: true } });

    expect(response.status).toBe(201);
    expect(campaign.offerId).toBe(offer.id);
    expect(campaign.targetGroupId).toBe(targetGroup.id);
    expect(campaign.status).toBe("draft");
    expect(body.added).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.failed).toBe(0);
    expect(campaign.enrollments).toHaveLength(2);
    expect(campaign.sendLogs).toHaveLength(0);

    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: leads.map((lead) => lead.id) } } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });

  it("skips leads without email or landingpage", async () => {
    const suffix = Date.now();
    const targetGroup = await prisma.targetGroup.create({
      data: { name: `Skip TG ${suffix}`, industryKeywords: [], painKeywords: [], icpRules: {}, emailTone: "direkt", landingpageStyle: "klar", videoStyle: "kurz" }
    });
    const offer = await prisma.offer.create({
      data: { workspaceId: "default", name: `Skip Offer ${suffix}`, serviceDescription: "Service", coreProblems: ["Problem"], solutions: ["Solution"] }
    });
    const [validLead, missingEmail, missingLandingpage] = await Promise.all([
      prisma.prospect.create({ data: { companyName: `Valid ${suffix}`, city: "Berlin", country: "DE", businessFields: [], companyStatus: "active", decisionMakerEmail: `valid-${suffix}@example.com`, slug: `valid-${suffix}`, landingpageUrl: `/p/valid-${suffix}` } }),
      prisma.prospect.create({ data: { companyName: `Missing Email ${suffix}`, city: "Berlin", country: "DE", businessFields: [], companyStatus: "active", slug: `missing-email-${suffix}`, landingpageUrl: `/p/missing-email-${suffix}` } }),
      prisma.prospect.create({ data: { companyName: `Missing LP ${suffix}`, city: "Berlin", country: "DE", businessFields: [], companyStatus: "active", decisionMakerEmail: `missing-lp-${suffix}@example.com` } })
    ]);

    const response = await createFromLeads(new Request("http://localhost/api/campaigns/create-from-leads", {
      method: "POST",
      body: JSON.stringify({
        prospectIds: [validLead.id, missingEmail.id, missingLandingpage.id],
        targetGroupId: targetGroup.id,
        offerId: offer.id,
        name: `Skip Campaign ${suffix}`
      })
    }));
    const body = await response.json() as { campaignId: string; added: number; skipped: number };

    expect(body.added).toBe(1);
    expect(body.skipped).toBe(2);
    await expect(prisma.emailSendLog.count({ where: { campaignId: body.campaignId } })).resolves.toBe(0);

    await prisma.campaign.delete({ where: { id: body.campaignId } });
    await prisma.prospect.deleteMany({ where: { id: { in: [validLead.id, missingEmail.id, missingLandingpage.id] } } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });
});

describe("CampaignFlowWizard", () => {
  it("renders the preview flow with selected leads and campaign controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(CampaignFlowWizard, {
        open: true,
        leads: [{ id: "lead-1", name: "Max", companyName: "Acme GmbH", email: "max@example.com", landingpageUrl: "/p/acme", slug: "acme" }],
        targetGroups: [{ id: "tg-1", name: "Spedition" }],
        offers: [{ id: "offer-1", name: "Spedition Offer", targetGroupId: "tg-1" }],
        templates: [{ id: "tpl-1", name: "Template A", subject: "Hallo {{companyName}}", bodyText: "Link {{landingpageUrl}}" }],
        onClose: vi.fn()
      })
    );

    expect(html).toContain("One-Click-Kampagne");
    expect(html).toContain("Leads prüfen");
    expect(html).toContain("Vorschau");
    expect(html).toContain("1 Leads ausgewählt");
    expect(html).toContain("Weiter");
  });
});
