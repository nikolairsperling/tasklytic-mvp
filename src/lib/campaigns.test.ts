import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET as listProspectsApi } from "../../app/api/prospects/route";
import { GET as listLeadPickerApi } from "../../app/api/campaigns/lead-picker/route";
import { POST as createCampaignApi } from "../../app/api/campaigns/route";
import { PATCH as updateCampaignApi } from "../../app/api/campaigns/[id]/route";
import {
  addProspectsToCampaign,
  buildLandingpageUrl,
  clampBatchSize,
  getDueCampaignItems,
  markCampaignEnrollmentReplied,
  renderHtmlTemplate,
  renderTemplate,
  sendDueCampaignEmails
} from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";

const prospectTemplate = {
  id: "prospect-1",
  slug: "bauer-logistik-hamburg",
  companyName: "Bauer Logistik",
  city: "Hamburg",
  decisionMakerName: "Max Bauer",
  decisionMakerEmail: "max@bauer.example"
};

let testCampaignOfferId = "";

beforeEach(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const offer = await prisma.offer.create({
    data: {
      workspaceId: "default",
      name: `Test Campaign Offer ${suffix}`,
      serviceDescription: "Test service",
      coreProblems: ["Problem"],
      solutions: ["Solution"]
    }
  });
  testCampaignOfferId = offer.id;
});

afterEach(async () => {
  if (!testCampaignOfferId) return;
  await prisma.offer.deleteMany({ where: { id: testCampaignOfferId } }).catch(() => undefined);
  testCampaignOfferId = "";
});

describe("campaign template helpers", () => {
  it("caps manual batches at 20 mails", () => {
    expect(clampBatchSize()).toBe(20);
    expect(clampBatchSize(200)).toBe(20);
    expect(clampBatchSize(7)).toBe(7);
    expect(clampBatchSize(0)).toBe(20);
  });

  it("renders prospect variables and landingpage URLs", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://tasklytic.example/";

    expect(
      renderTemplate("Hallo {{decisionMakerName}} von {{companyName}}: {{landingpageUrl}}", prospectTemplate)
    ).toBe("Hallo Max Bauer von Bauer Logistik: https://tasklytic.example/p/bauer-logistik-hamburg");
  });

  it("falls back to relative landingpage URLs without app URL", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(buildLandingpageUrl("acme-berlin")).toBe("/p/acme-berlin");
  });

  it("escapes rendered HTML text", () => {
    expect(renderHtmlTemplate("Hallo <{{companyName}}>", prospectTemplate)).toBe("Hallo &lt;Bauer Logistik&gt;");
  });
});

describe("campaign offer and AI prospect selection", () => {
  it("loads prospects for the AI dropdown through the prospects API", async () => {
    const suffix = Date.now();
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Dropdown Prospect ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerName: "Mara Beispiel"
      }
    });

    const response = await listProspectsApi(new Request("http://localhost/api/prospects?limit=100"));
    const body = await response.json() as { data: Array<{ id: string; companyName: string; city: string; decisionMakerName: string | null }> };

    expect(response.status).toBe(200);
    expect(body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: prospect.id,
        companyName: prospect.companyName,
        city: "Berlin",
        decisionMakerName: "Mara Beispiel"
      })
    ]));

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("loads leads for the campaign lead picker without filters", async () => {
    const suffix = Date.now();
    const targetGroup = await prisma.targetGroup.create({
      data: {
        name: `Lead Picker TG ${suffix}`,
        description: "Test target group",
        industryKeywords: [],
        painKeywords: [],
        icpRules: {},
        emailTone: "direkt",
        landingpageStyle: "klar",
        videoStyle: "kurz"
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Lead Picker Prospect ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerName: "Lea Picker",
        decisionMakerEmail: `lea-${suffix}@picker.example`,
        companyEmail: `info-${suffix}@picker.example`,
        targetGroupId: targetGroup.id,
        icpFitScore: 81,
        icpFitLabel: "high",
        engagementLevel: "warm",
        painType: "Zeit"
      }
    });

    const response = await listLeadPickerApi(new Request("http://localhost/api/campaigns/lead-picker"));
    const body = await response.json() as {
      totalProspects: number;
      data: Array<{
        id: string;
        companyName: string;
        decisionMakerName: string | null;
        city: string;
        targetGroupId: string | null;
        targetGroupName: string | null;
        icpFitScore: number;
        icpFitLabel: string;
        engagementLevel: string;
        status: string;
        painType: string | null;
        companyEmail: string | null;
        decisionMakerEmail: string | null;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.totalProspects).toBeGreaterThan(0);
    expect(body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: prospect.id,
        companyName: prospect.companyName,
        decisionMakerName: "Lea Picker",
        city: "Berlin",
        targetGroupId: targetGroup.id,
        targetGroupName: targetGroup.name,
        icpFitScore: 81,
        icpFitLabel: "high",
        engagementLevel: "warm",
        painType: "Zeit",
        companyEmail: `info-${suffix}@picker.example`,
        decisionMakerEmail: `lea-${suffix}@picker.example`
      })
    ]));

    await prisma.prospect.delete({ where: { id: prospect.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });

  it("saves offerId and selectedProspectId on campaigns", async () => {
    const suffix = Date.now();
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Campaign Prospect ${suffix}`,
        city: "Hamburg",
        country: "DE",
        businessFields: []
      }
    });
    const offer = await prisma.offer.create({
      data: {
        workspaceId: "default",
        name: `Campaign Offer ${suffix}`,
        businessName: "OpsPilot",
        serviceDescription: "KI Automatisierung",
        targetAudienceDescription: "B2B",
        coreProblems: ["manuell"],
        solutions: ["automatisiert"],
        valueProposition: "schnell live",
        toneOfVoice: "direkt",
        isDefault: true
      }
    });

    const createResponse = await createCampaignApi(new Request("http://localhost/api/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: `Campaign Selection ${suffix}`,
        status: "active",
        offerId: offer.id,
        selectedProspectId: prospect.id,
        steps: [{ delayDays: 0, subject: "Hallo", bodyText: "Text {{landingpageUrl}}" }]
      })
    }));
    const created = await createResponse.json() as { id: string; offerId: string | null; selectedProspectId: string | null };

    expect(createResponse.status).toBe(201);
    expect(created.offerId).toBe(offer.id);
    expect(created.selectedProspectId).toBe(prospect.id);

    const updateResponse = await updateCampaignApi(new Request(`http://localhost/api/campaigns/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        offerId: offer.id,
        selectedProspectId: prospect.id,
        steps: [{ stepNumber: 1, delayDays: 0, subject: "Hallo neu", body: "Text neu {{landingpageUrl}}" }]
      })
    }), { params: Promise.resolve({ id: created.id }) });
    const updated = await updateResponse.json() as { offerId: string | null; selectedProspectId: string | null };

    expect(updateResponse.status).toBe(200);
    expect(updated.offerId).toBe(offer.id);
    expect(updated.selectedProspectId).toBe(prospect.id);

    await prisma.campaign.delete({ where: { id: created.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("renders campaign controls for prospect and offer selection", () => {
    const source = readFileSync("src/components/admin/campaign-manager.tsx", "utf8");

    expect(source).toContain('fetch("/api/campaigns/lead-picker"');
    expect(source).toContain('name="offerId"');
    expect(source).toContain("Bitte Angebot auswählen");
    expect(source).not.toContain("preferredOfferId");
    expect(source).toContain('name="selectedProspectId"');
    expect(source).toContain("Beispiel-Prospect für KI-Texte");
    expect(source).toContain("Leads zur Kampagne hinzufügen");
    expect(source).toContain("Alle sichtbaren auswählen");
    expect(source).toContain("Ausgewählte Leads hinzufügen");
    expect(source).toContain("Kampagne ist auf Zielgruppe");
    expect(source).toContain("Filter zurücksetzen");
    expect(source).toContain("Insgesamt vorhandene Leads");
  });

  it("stores distinct selected offers on separate campaigns", async () => {
    const suffix = Date.now();
    const [speditionOffer, doctorsOffer] = await Promise.all([
      prisma.offer.create({
        data: {
          workspaceId: "default",
          name: `Spedition Offer ${suffix}`,
          serviceDescription: "Dispo-Automatisierung fuer Speditionen",
          coreProblems: ["manuelle Dispo"],
          solutions: ["automatische Anfragen"]
        }
      }),
      prisma.offer.create({
        data: {
          workspaceId: "default",
          name: `Aerzte Offer ${suffix}`,
          serviceDescription: "Patientenkommunikation fuer Praxen",
          coreProblems: ["Telefonlast"],
          solutions: ["digitale Patientenstrecken"]
        }
      })
    ]);

    const [campaignAResponse, campaignBResponse] = await Promise.all([
      createCampaignApi(new Request("http://localhost/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: `Kampagne Spedition ${suffix}`,
          offerId: speditionOffer.id,
          steps: [{ delayDays: 0, subject: "Dispo", bodyText: "Spedition Text {{landingpageUrl}}" }]
        })
      })),
      createCampaignApi(new Request("http://localhost/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: `Kampagne Aerzte ${suffix}`,
          offerId: doctorsOffer.id,
          steps: [{ delayDays: 0, subject: "Praxis", bodyText: "Aerzte Text {{landingpageUrl}}" }]
        })
      }))
    ]);
    const campaignA = await campaignAResponse.json() as { id: string; offerId: string };
    const campaignB = await campaignBResponse.json() as { id: string; offerId: string };

    expect(campaignA.offerId).toBe(speditionOffer.id);
    expect(campaignB.offerId).toBe(doctorsOffer.id);
    expect(speditionOffer.serviceDescription).not.toBe(doctorsOffer.serviceDescription);

    await prisma.campaign.deleteMany({ where: { id: { in: [campaignA.id, campaignB.id] } } });
    await prisma.offer.deleteMany({ where: { id: { in: [speditionOffer.id, doctorsOffer.id] } } });
  });

  it("creates a campaign with multiple lead enrollments while keeping preview prospect separate", async () => {
    const suffix = Date.now();
    const previewProspect = await prisma.prospect.create({
      data: {
        companyName: `Preview Prospect ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: []
      }
    });
    const recipients = await Promise.all([1, 2].map((index) =>
      prisma.prospect.create({
        data: {
          companyName: `Recipient ${index} ${suffix}`,
          city: "Hamburg",
          country: "DE",
          businessFields: [],
          decisionMakerEmail: `recipient-${index}-${suffix}@example.com`,
          slug: `recipient-${index}-${suffix}`,
          landingpageUrl: `/p/recipient-${index}-${suffix}`,
          landingpageReviewStatus: "approved",
          companyStatus: "active"
        }
      })
    ));

    const createResponse = await createCampaignApi(new Request("http://localhost/api/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: `Bulk Campaign ${suffix}`,
        status: "draft",
        offerId: testCampaignOfferId,
        selectedProspectId: previewProspect.id,
        steps: [{ delayDays: 0, subject: "Hallo", bodyText: "Text {{landingpageUrl}}" }]
      })
    }));
    const created = await createResponse.json() as { id: string; selectedProspectId: string | null };
    const result = await addProspectsToCampaign(created.id, recipients.map((prospect) => prospect.id));
    const enrollments = await prisma.campaignEnrollment.findMany({ where: { campaignId: created.id } });

    expect(createResponse.status).toBe(201);
    expect(created.selectedProspectId).toBe(previewProspect.id);
    expect(result).toEqual({ added: 2, skipped: 0, failed: 0 });
    expect(enrollments).toHaveLength(2);
    expect(enrollments.map((enrollment) => enrollment.prospectId)).not.toContain(previewProspect.id);

    await prisma.campaign.delete({ where: { id: created.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: [previewProspect.id, ...recipients.map((prospect) => prospect.id)] } } });
  });

  it("skips duplicate campaign lead enrollments", async () => {
    const suffix = Date.now();
    const campaign = await prisma.campaign.create({
      data: {
        name: `Duplicate Campaign ${suffix}`,
        status: "draft",
        offerId: testCampaignOfferId,
        steps: { create: { position: 0, stepNumber: 1, delayDays: 0, subject: "Hallo", bodyText: "Text", body: "Text" } }
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Duplicate Lead ${suffix}`,
        city: "Köln",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `duplicate-${suffix}@example.com`,
        slug: `duplicate-${suffix}`,
        landingpageUrl: `/p/duplicate-${suffix}`,
        landingpageReviewStatus: "approved",
        companyStatus: "active"
      }
    });

    expect(await addProspectsToCampaign(campaign.id, [prospect.id, prospect.id])).toEqual({ added: 1, skipped: 0, failed: 0 });
    expect(await addProspectsToCampaign(campaign.id, [prospect.id])).toEqual({ added: 0, skipped: 1, failed: 0 });
    await expect(prisma.campaignEnrollment.count({ where: { campaignId: campaign.id } })).resolves.toBe(1);

    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });
});

describe("campaign sequencing", () => {
  it("plans follow-ups and computes nextSendAt after sending", async () => {
    const suffix = Date.now();
    const now = new Date("2026-04-27T10:00:00Z");
    const campaign = await prisma.campaign.create({
      data: {
        name: `Sequence ${suffix}`,
        status: "active",
        offerId: testCampaignOfferId,
        manualGoApproved: true,
        scheduledStartAt: now,
        sendWindowStart: "08:00",
        sendWindowEnd: "18:00",
        weekdaysOnly: false,
        steps: {
          create: [
            { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Hello 1", body: "Hello 1", isActive: true },
            { position: 1, stepNumber: 2, delayDays: 2, subject: "Step 2", bodyText: "Hello 2", body: "Hello 2", isActive: true },
            { position: 2, stepNumber: 3, delayDays: 4, subject: "Step 3", bodyText: "Hello 3", body: "Hello 3", isActive: true }
          ]
        }
      },
      include: { steps: true }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Sequence Prospect ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `sequence-${suffix}@example.com`,
        slug: `sequence-${suffix}`,
        landingpageUrl: `/p/sequence-${suffix}`,
        landingpageReviewStatus: "approved",
        companyStatus: "active"
      }
    });
    const enrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId: campaign.id,
        prospectId: prospect.id,
        currentStep: 1,
        nextSendAt: now,
        status: "active"
      }
    });

    const dueBefore = await getDueCampaignItems(campaign.id, now);
    expect(dueBefore).toHaveLength(1);
    expect(dueBefore[0]?.step.stepNumber).toBe(1);

    const result = await sendDueCampaignEmails({
      campaignId: campaign.id,
      now,
      sendMail: async () => ({ messageId: "msg-1" })
    });

    expect(result.sent).toBe(1);

    const updatedEnrollment = await prisma.campaignEnrollment.findUnique({
      where: { id: enrollment.id }
    });
    expect(updatedEnrollment?.currentStep).toBe(2);
    expect(updatedEnrollment?.status).toBe("active");
    expect(updatedEnrollment?.nextSendAt?.toISOString()).toBe("2026-04-29T10:00:00.000Z");

    expect(await getDueCampaignItems(campaign.id, new Date("2026-04-28T10:00:00Z"))).toHaveLength(0);
    const dueAfterDelay = await getDueCampaignItems(campaign.id, new Date("2026-04-29T10:00:00Z"));
    expect(dueAfterDelay).toHaveLength(1);
    expect(dueAfterDelay[0]?.step.stepNumber).toBe(2);

    await prisma.emailSendLog.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaignEnrollment.delete({ where: { id: enrollment.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("blocks send-due when the campaign is still a draft", async () => {
    const suffix = Date.now();
    const now = new Date("2026-04-27T10:00:00Z");
    const campaign = await prisma.campaign.create({
      data: {
        name: `Draft Block ${suffix}`,
        status: "draft",
        sendingStatus: "draft",
        offerId: testCampaignOfferId,
        manualGoApproved: false,
        weekdaysOnly: false,
        steps: {
          create: [
            { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Hello 1", body: "Hello 1", isActive: true }
          ]
        }
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Draft Block ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `draft-${suffix}@example.com`,
        slug: `draft-block-${suffix}`,
        landingpageUrl: `/p/draft-block-${suffix}`,
        landingpageReviewStatus: "approved",
        companyStatus: "active"
      }
    });
    const enrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId: campaign.id,
        prospectId: prospect.id,
        currentStep: 1,
        nextSendAt: now,
        status: "active"
      }
    });

    const result = await sendDueCampaignEmails({
      campaignId: campaign.id,
      now,
      sendMail: async () => ({ messageId: "should-not-send" })
    });

    expect(result.sent).toBe(0);
    expect(result.reason).toBe("Kampagne ist nicht freigegeben.");

    const updatedEnrollment = await prisma.campaignEnrollment.findUnique({
      where: { id: enrollment.id }
    });
    expect(updatedEnrollment?.lastSentAt).toBeNull();

    await prisma.emailSendLog.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaignEnrollment.delete({ where: { id: enrollment.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("sends when a scheduled campaign is approved and in window", async () => {
    const suffix = Date.now();
    const now = new Date("2026-04-27T10:00:00Z");
    const campaign = await prisma.campaign.create({
      data: {
        name: `Scheduled Send ${suffix}`,
        status: "draft",
        sendingStatus: "scheduled",
        offerId: testCampaignOfferId,
        manualGoApproved: true,
        scheduledStartAt: now,
        timezone: "UTC",
        sendWindowStart: "08:00",
        sendWindowEnd: "18:00",
        weekdaysOnly: false,
        steps: {
          create: [
            { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Hello 1", body: "Hello 1", isActive: true }
          ]
        }
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Scheduled Send ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `scheduled-${suffix}@example.com`,
        slug: `scheduled-send-${suffix}`,
        landingpageUrl: `/p/scheduled-send-${suffix}`,
        landingpageReviewStatus: "approved",
        companyStatus: "active"
      }
    });
    const enrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId: campaign.id,
        prospectId: prospect.id,
        currentStep: 1,
        nextSendAt: now,
        status: "active"
      }
    });

    const result = await sendDueCampaignEmails({
      campaignId: campaign.id,
      now,
      sendMail: async () => ({ messageId: "msg-scheduled" })
    });

    expect(result.sent).toBe(1);
    expect(result.reason).toBeUndefined();

    const updatedEnrollment = await prisma.campaignEnrollment.findUnique({
      where: { id: enrollment.id }
    });
    expect(updatedEnrollment?.lastSentAt?.toISOString()).toBe(now.toISOString());

    await prisma.emailSendLog.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaignEnrollment.delete({ where: { id: enrollment.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("stops follow-ups after a reply", async () => {
    const suffix = Date.now();
    const now = new Date("2026-04-27T10:00:00Z");
    const campaign = await prisma.campaign.create({
      data: {
        name: `Reply Stop ${suffix}`,
        status: "active",
        offerId: testCampaignOfferId,
        manualGoApproved: true,
        weekdaysOnly: false,
        steps: {
          create: [
            { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Hello 1", body: "Hello 1", isActive: true },
            { position: 1, stepNumber: 2, delayDays: 2, subject: "Step 2", bodyText: "Hello 2", body: "Hello 2", isActive: true }
          ]
        }
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Reply Stop ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `reply-${suffix}@example.com`,
        slug: `reply-stop-${suffix}`,
        landingpageUrl: `/p/reply-stop-${suffix}`,
        landingpageReviewStatus: "approved",
        companyStatus: "active"
      }
    });
    const enrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId: campaign.id,
        prospectId: prospect.id,
        currentStep: 1,
        nextSendAt: now,
        status: "active"
      }
    });
    const step = await prisma.campaignStep.findFirstOrThrow({
      where: { campaignId: campaign.id, stepNumber: 1 }
    });
    await prisma.emailSendLog.create({
      data: {
        campaignId: campaign.id,
        stepId: step.id,
        enrollmentId: enrollment.id,
        prospectId: prospect.id,
        email: prospect.decisionMakerEmail,
        status: "sent",
        subject: "Step 1",
        sentAt: now
      }
    });

    await markCampaignEnrollmentReplied(enrollment.id, now);

    const updatedEnrollment = await prisma.campaignEnrollment.findUnique({
      where: { id: enrollment.id }
    });
    expect(updatedEnrollment?.status).toBe("replied");
    expect(updatedEnrollment?.nextSendAt).toBeNull();
    expect(updatedEnrollment?.repliedAt?.toISOString()).toBe(now.toISOString());

    expect(await getDueCampaignItems(campaign.id, new Date("2026-04-29T10:00:00Z"))).toHaveLength(0);

    await prisma.emailSendLog.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaignEnrollment.delete({ where: { id: enrollment.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("blocks due items when a prospect already received a mail within 24 hours", async () => {
    const suffix = Date.now();
    const now = new Date("2026-04-27T10:00:00Z");
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Reply Stop ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `reply-${suffix}@example.com`,
        slug: `reply-stop-${suffix}`,
        landingpageUrl: `/p/reply-stop-${suffix}`,
        landingpageReviewStatus: "approved",
        companyStatus: "active"
      }
    });

    const blockerCampaign = await prisma.campaign.create({
      data: {
        name: `Reply Stop Blocker ${suffix}`,
        status: "active",
        offerId: testCampaignOfferId,
        manualGoApproved: true,
        weekdaysOnly: false,
        steps: {
          create: { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Hello 1", body: "Hello 1", isActive: true }
        }
      }
    });
    const blockerEnrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId: blockerCampaign.id,
        prospectId: prospect.id,
        currentStep: 1,
        nextSendAt: now,
        status: "active"
      }
    });
    const blockerStep = await prisma.campaignStep.findFirstOrThrow({
      where: { campaignId: blockerCampaign.id, stepNumber: 1 }
    });
    await prisma.emailSendLog.create({
      data: {
        campaignId: blockerCampaign.id,
        stepId: blockerStep.id,
        enrollmentId: blockerEnrollment.id,
        prospectId: prospect.id,
        email: prospect.decisionMakerEmail,
        status: "sent",
        subject: "Step 1",
        sentAt: now
      }
    });

    const campaign = await prisma.campaign.create({
      data: {
        name: `Daily Limit ${suffix}`,
        status: "active",
        offerId: testCampaignOfferId,
        manualGoApproved: true,
        weekdaysOnly: false,
        steps: {
          create: { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Hello 1", body: "Hello 1", isActive: true }
        }
      }
    });
    const enrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId: campaign.id,
        prospectId: prospect.id,
        currentStep: 1,
        nextSendAt: now,
        status: "active"
      }
    });
    const result = await sendDueCampaignEmails({
      campaignId: campaign.id,
      now,
      sendMail: async () => ({ messageId: "should-not-send" })
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBeGreaterThanOrEqual(1);

    const updatedEnrollment = await prisma.campaignEnrollment.findUnique({
      where: { id: enrollment.id }
    });
    expect(updatedEnrollment?.nextSendAt?.toISOString()).toBe("2026-04-28T10:00:00.000Z");

    await prisma.emailSendLog.deleteMany({ where: { campaignId: { in: [campaign.id, blockerCampaign.id] } } });
    await prisma.campaignEnrollment.deleteMany({ where: { id: { in: [enrollment.id, blockerEnrollment.id] } } });
    await prisma.campaign.deleteMany({ where: { id: { in: [campaign.id, blockerCampaign.id] } } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("stops sending when the mailbox daily limit is reached and shifts nextSendAt", async () => {
    const originalLimit = process.env.EMAIL_MAX_EMAILS_PER_DAY;
    process.env.EMAIL_MAX_EMAILS_PER_DAY = "1";
    try {
      const suffix = Date.now();
      const now = new Date("2026-04-27T10:00:00Z");
      const blockerCampaign = await prisma.campaign.create({
        data: {
          name: `Mailbox Blocker ${suffix}`,
          status: "active",
          offerId: testCampaignOfferId,
          manualGoApproved: true,
          weekdaysOnly: false,
          steps: {
            create: { position: 0, stepNumber: 1, delayDays: 0, subject: "Block", bodyText: "Block", body: "Block", isActive: true }
          }
        }
      });
      const blockerProspect = await prisma.prospect.create({
        data: {
          companyName: `Mailbox Blocker ${suffix}`,
          city: "Berlin",
          country: "DE",
          businessFields: [],
          decisionMakerEmail: `blocker-${suffix}@example.com`,
          slug: `mailbox-blocker-${suffix}`,
          landingpageUrl: `/p/mailbox-blocker-${suffix}`,
          landingpageReviewStatus: "approved",
          companyStatus: "active"
        }
      });
      const blockerEnrollment = await prisma.campaignEnrollment.create({
        data: {
          campaignId: blockerCampaign.id,
          prospectId: blockerProspect.id,
          currentStep: 1,
          nextSendAt: now,
          status: "active"
        }
      });
      const blockerStep = await prisma.campaignStep.findFirstOrThrow({
        where: { campaignId: blockerCampaign.id, stepNumber: 1 }
      });
      await prisma.emailSendLog.create({
        data: {
          campaignId: blockerCampaign.id,
          stepId: blockerStep.id,
          enrollmentId: blockerEnrollment.id,
          prospectId: blockerProspect.id,
          email: blockerProspect.decisionMakerEmail,
          status: "sent",
          subject: "Block",
          sentAt: now
        }
      });

      const campaign = await prisma.campaign.create({
        data: {
          name: `Mailbox Limit ${suffix}`,
          status: "active",
          offerId: testCampaignOfferId,
          manualGoApproved: true,
          weekdaysOnly: false,
          steps: {
            create: [
              { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Hello 1", body: "Hello 1", isActive: true },
              { position: 1, stepNumber: 2, delayDays: 2, subject: "Step 2", bodyText: "Hello 2", body: "Hello 2", isActive: true }
            ]
          }
        }
      });
      const prospect = await prisma.prospect.create({
        data: {
          companyName: `Mailbox Limit ${suffix}`,
          city: "Berlin",
          country: "DE",
          businessFields: [],
          decisionMakerEmail: `limit-${suffix}@example.com`,
          slug: `mailbox-limit-${suffix}`,
          landingpageUrl: `/p/mailbox-limit-${suffix}`,
          landingpageReviewStatus: "approved",
          companyStatus: "active"
        }
      });
      const enrollment = await prisma.campaignEnrollment.create({
        data: {
          campaignId: campaign.id,
          prospectId: prospect.id,
          currentStep: 1,
          nextSendAt: now,
          status: "active"
        }
      });

      const result = await sendDueCampaignEmails({
        campaignId: campaign.id,
        now,
        sendMail: async () => ({ messageId: "should-not-send" })
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBeGreaterThanOrEqual(1);

      const updatedEnrollment = await prisma.campaignEnrollment.findUnique({
        where: { id: enrollment.id }
      });
      expect(updatedEnrollment?.nextSendAt?.toISOString()).toBe("2026-04-28T10:00:00.000Z");

      await prisma.emailSendLog.deleteMany({ where: { campaignId: { in: [campaign.id, blockerCampaign.id] } } });
      await prisma.campaignEnrollment.deleteMany({ where: { id: { in: [enrollment.id, blockerEnrollment.id] } } });
      await prisma.campaign.deleteMany({ where: { id: { in: [campaign.id, blockerCampaign.id] } } });
      await prisma.prospect.deleteMany({ where: { id: { in: [prospect.id, blockerProspect.id] } } });
    } finally {
      if (originalLimit === undefined) {
        delete process.env.EMAIL_MAX_EMAILS_PER_DAY;
      } else {
        process.env.EMAIL_MAX_EMAILS_PER_DAY = originalLimit;
      }
    }
  });

  it("shifts nextSendAt when the send window has not started yet", async () => {
    const suffix = Date.now();
    const now = new Date("2026-04-27T08:00:00Z");
    const campaign = await prisma.campaign.create({
      data: {
        name: `Window Shift ${suffix}`,
        status: "active",
        offerId: testCampaignOfferId,
        manualGoApproved: true,
        timezone: "UTC",
        sendWindowStart: "09:00",
        sendWindowEnd: "17:00",
        weekdaysOnly: false,
        steps: {
          create: { position: 0, stepNumber: 1, delayDays: 0, subject: "Step 1", bodyText: "Hello 1", body: "Hello 1", isActive: true }
        }
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Window Shift ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        decisionMakerEmail: `window-${suffix}@example.com`,
        slug: `window-shift-${suffix}`,
        landingpageUrl: `/p/window-shift-${suffix}`,
        landingpageReviewStatus: "approved",
        companyStatus: "active"
      }
    });
    const enrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId: campaign.id,
        prospectId: prospect.id,
        currentStep: 1,
        nextSendAt: now,
        status: "active"
      }
    });

    const result = await sendDueCampaignEmails({
      campaignId: campaign.id,
      now,
      sendMail: async () => ({ messageId: "should-not-send" })
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);

    const updatedEnrollment = await prisma.campaignEnrollment.findUnique({
      where: { id: enrollment.id }
    });
    expect(updatedEnrollment?.nextSendAt?.toISOString()).toBe("2026-04-27T09:00:00.000Z");

    await prisma.emailSendLog.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaignEnrollment.delete({ where: { id: enrollment.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });
});
