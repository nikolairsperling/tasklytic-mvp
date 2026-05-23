import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendSignature, sanitizeSignatureHtml } from "@/lib/email-signature";
import {
  buildWorkflowLeadPreviews,
  canContactProspect,
  enrichImportBatch,
  generateLandingpagesForBatch,
  runLeadToOutreachWorkflow,
  sendBatchEmails,
  summarizeWorkflowBatch
} from "@/lib/lead-workflow";
import { prisma } from "@/lib/prisma";
import { defaultUserId, upsertUserOffer } from "@/lib/user-offer";

describe("lead workflow safeguards", () => {
  beforeEach(async () => {
    await upsertUserOffer({
      businessName: "OpsPilot",
      serviceDescription: "KI Automatisierung fuer operative Prozesse",
      targetAudienceDescription: "Speditionen und Logistikunternehmen",
      coreProblems: ["manuelle Anfragebearbeitung", "lange Reaktionszeiten"],
      solutions: ["automatisierte Workflows", "personalisierte Follow-ups"],
      valueProposition: "schnell live ohne IT-Projekt",
      toneOfVoice: "direkt"
    });
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { offer: { workspaceId: "default" } } });
    await prisma.offer.deleteMany({ where: { workspaceId: "default", campaigns: { none: {} } } });
    await prisma.userOffer.deleteMany({ where: { userId: defaultUserId } });
  });

  it("sanitizes signatures and appends them to text and html", () => {
    const html = sanitizeSignatureHtml('<p onclick="alert(1)">Hi</p><script>alert(1)</script><a href="javascript:bad()">x</a>');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");

    const signed = appendSignature({
      bodyHtml: "<p>Body</p>",
      bodyText: "Body",
      signature: { html: "<p>Signatur</p>", plainText: "Signatur" }
    });
    expect(signed.text).toContain("Signatur");
    expect(signed.html).toContain("Signatur");
  });

  it("blocks inactive and unreachable prospects before sending", () => {
    expect(canContactProspect({ companyStatus: "inactive", decisionMakerEmail: "a@example.com", companyEmail: null }).allowed).toBe(false);
    expect(canContactProspect({ companyStatus: "unreachable", decisionMakerEmail: "a@example.com", companyEmail: null }).allowed).toBe(false);
    expect(canContactProspect({ companyStatus: "active", decisionMakerEmail: "info@example.com", companyEmail: null }, { blockInfoEmails: true }).allowed).toBe(false);
  });

  it("filters workflow leads before the auto-flow starts", async () => {
    const suffix = Date.now();
    const batch = await prisma.leadImportBatch.create({ data: { filename: `filter-${suffix}.csv`, totalRows: 4 } });
    const prospects = await Promise.all([
      prisma.prospect.create({ data: { companyName: `Valid ${suffix}`, city: "Bremen", country: "DE", businessFields: [], companyStatus: "active", websiteUrl: "https://example.com", decisionMakerEmail: `valid-${suffix}@example.com`, slug: `valid-${suffix}`, landingpageUrl: `https://example.com/p/valid-${suffix}`, landingpageReviewStatus: "approved" } }),
      prisma.prospect.create({ data: { companyName: `Info ${suffix}`, city: "Bremen", country: "DE", businessFields: [], companyStatus: "unclear", websiteUrl: "https://example.com", decisionMakerEmail: `info@${suffix}.example.com`, slug: `info-${suffix}`, landingpageUrl: `https://example.com/p/info-${suffix}`, landingpageReviewStatus: "approved" } }),
      prisma.prospect.create({ data: { companyName: `No Website ${suffix}`, city: "Bremen", country: "DE", businessFields: [], companyStatus: "active", decisionMakerEmail: `noweb-${suffix}@example.com`, slug: `noweb-${suffix}`, landingpageReviewStatus: "approved" } }),
      prisma.prospect.create({ data: { companyName: `Inactive ${suffix}`, city: "Bremen", country: "DE", businessFields: [], companyStatus: "inactive", websiteUrl: "https://example.com", decisionMakerEmail: `inactive-${suffix}@example.com`, slug: `inactive-${suffix}`, landingpageReviewStatus: "approved" } })
    ]);
    await prisma.leadImportRow.createMany({
      data: prospects.map((prospect) => ({
        batchId: batch.id,
        rawJson: { Name: prospect.companyName },
        mappedJson: { generatedEmails: [{ subject: "Hallo", body: "Body {{landingpageUrl}}" }] },
        status: "enriched",
        prospectId: prospect.id
      }))
    });

    const summary = await summarizeWorkflowBatch(batch.id, { blockInfoEmails: true });
    const previews = await buildWorkflowLeadPreviews(batch.id, { blockInfoEmails: true });

    expect(summary.total).toBe(4);
    expect(summary.valid).toBe(1);
    expect(summary.sendable).toBe(1);
    expect(summary.blocked).toBe(3);
    expect(summary.breakdown).toContain("4 Leads");
    expect(previews).toHaveLength(1);
    expect(previews[0].companyName).toContain("Valid");

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: prospects.map((prospect) => prospect.id) } } });
  });

  it("renders workflow previews without an offer", async () => {
    await prisma.userOffer.deleteMany({ where: { userId: defaultUserId } });
    await prisma.offer.deleteMany({ where: { workspaceId: "default", campaigns: { none: {} } } });
    const suffix = Date.now();
    const batch = await prisma.leadImportBatch.create({ data: { filename: `missing-offer-${suffix}.csv`, totalRows: 1 } });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Missing Offer ${suffix}`,
        city: "Bremen",
        country: "DE",
        businessFields: [],
        companyStatus: "active",
        websiteUrl: "https://example.com",
        decisionMakerEmail: `missing-offer-${suffix}@example.com`,
        slug: `missing-offer-${suffix}`,
        landingpageUrl: `https://example.com/p/missing-offer-${suffix}`,
        landingpageReviewStatus: "approved"
      }
    });
    await prisma.leadImportRow.create({
      data: {
        batchId: batch.id,
        rawJson: { Name: prospect.companyName },
        mappedJson: null,
        status: "enriched",
        prospectId: prospect.id
      }
    });

    await expect(buildWorkflowLeadPreviews(batch.id, { blockInfoEmails: true })).resolves.toEqual([expect.objectContaining({
      prospectId: prospect.id,
      generatedEmails: []
    })]);

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("enriches at most 20 leads per manual run", async () => {
    const suffix = Date.now();
    const batch = await prisma.leadImportBatch.create({ data: { filename: `batch-${suffix}.csv`, totalRows: 25 } });
    const prospects = await Promise.all(Array.from({ length: 25 }, (_, index) => prisma.prospect.create({
      data: {
        companyName: `Limit ${suffix}-${index}`,
        city: "Bremen",
        country: "DE",
        businessFields: []
      }
    })));
    await prisma.leadImportRow.createMany({
      data: prospects.map((prospect) => ({
        batchId: batch.id,
        rawJson: { Name: prospect.companyName },
        mappedJson: { companyName: prospect.companyName, city: prospect.city },
        status: "imported",
        prospectId: prospect.id
      }))
    });

    const result = await enrichImportBatch(batch.id, 100);
    expect(result.processed).toBe(20);

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: prospects.map((prospect) => prospect.id) } } });
  });

  it("generates landingpages only for eligible prospects", async () => {
    const suffix = Date.now();
    const batch = await prisma.leadImportBatch.create({ data: { filename: `landing-${suffix}.csv`, totalRows: 2 } });
    const active = await prisma.prospect.create({ data: { companyName: `Valid ${suffix}`, city: "Bremen", country: "DE", businessFields: [], companyStatus: "active", websiteUrl: "https://example.com", decisionMakerEmail: `valid-${suffix}@example.com` } });
    const inactive = await prisma.prospect.create({ data: { companyName: `Invalid ${suffix}`, city: "Bremen", country: "DE", businessFields: [], companyStatus: "inactive", websiteUrl: "https://example.com", decisionMakerEmail: `invalid-${suffix}@example.com` } });
    await prisma.leadImportRow.createMany({
      data: [active, inactive].map((prospect) => ({
        batchId: batch.id,
        rawJson: { Name: prospect.companyName },
        mappedJson: { companyName: prospect.companyName, city: prospect.city },
        status: "imported",
        prospectId: prospect.id
      }))
    });

    const result = await generateLandingpagesForBatch(batch.id);
    expect(result.generated).toBe(1);
    expect(await prisma.prospect.findUniqueOrThrow({ where: { id: active.id } })).toMatchObject({ companyStatus: "active", landingpageReviewStatus: "needs_review" });
    expect((await prisma.prospect.findUniqueOrThrow({ where: { id: inactive.id } })).landingpageUrl).toBeNull();

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: [active.id, inactive.id] } } });
  });

  it("blocks batch sending when SMTP is not configured", async () => {
    const batch = await prisma.leadImportBatch.create({ data: { filename: "smtp.csv", totalRows: 0 } });
    await expect(sendBatchEmails(batch.id)).rejects.toThrow(/SMTP/);
    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
  });

  it("does not send emails when sendNow is omitted", async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const suffix = Date.now();
    const batch = await prisma.leadImportBatch.create({ data: { filename: `auto-${suffix}.csv`, totalRows: 1 } });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Auto ${suffix}`,
        city: "Bremen",
        country: "DE",
        businessFields: [],
        companyStatus: "active",
        websiteUrl: "https://example.com",
        fitScore: 80,
        decisionMakerEmail: `auto-${suffix}@example.com`
      }
    });
    await prisma.leadImportRow.create({
      data: {
        batchId: batch.id,
        rawJson: { Name: prospect.companyName },
        mappedJson: { companyName: prospect.companyName, city: prospect.city },
        status: "enriched",
        prospectId: prospect.id
      }
    });

    const result = await runLeadToOutreachWorkflow({
      batchId: batch.id,
      generateLandingpages: true,
      generateEmails: true,
      prepareSend: true
    });

    expect(result).toMatchObject({
      landingpagesGenerated: 1,
      emailsGenerated: 0,
      prepared: 0,
      sent: 0,
      failed: 0
    });

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it("sends only selected prospects and keeps the outbound mail specific", async () => {
    const originalEnv = {
      EMAIL_MAX_EMAILS_PER_DAY: process.env.EMAIL_MAX_EMAILS_PER_DAY,
      EMAIL_MAX_EMAILS_PER_BATCH: process.env.EMAIL_MAX_EMAILS_PER_BATCH,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
      SMTP_FROM_NAME: process.env.SMTP_FROM_NAME
    };
    Object.assign(process.env, {
      EMAIL_MAX_EMAILS_PER_DAY: "1000",
      EMAIL_MAX_EMAILS_PER_BATCH: "20",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
      SMTP_FROM_EMAIL: "from@example.com",
      SMTP_FROM_NAME: "Tasklytic"
    });

    const suffix = Date.now();
    const batch = await prisma.leadImportBatch.create({ data: { filename: `selected-${suffix}.csv`, totalRows: 2 } });
    const prospects = await Promise.all([
      prisma.prospect.create({
        data: {
          companyName: `Selected ${suffix}`,
          city: "Bremen",
          country: "DE",
          businessFields: [],
          companyStatus: "active",
          websiteUrl: "https://example.com",
          landingpageReviewStatus: "approved",
          decisionMakerEmail: `selected-${suffix}@example.com`,
          slug: `selected-${suffix}`,
          landingpageUrl: `https://example.com/p/selected-${suffix}`,
          customPainPoint: "manuelle Übergaben"
        }
      }),
      prisma.prospect.create({
        data: {
          companyName: `Skipped ${suffix}`,
          city: "Bremen",
          country: "DE",
          businessFields: [],
          companyStatus: "active",
          websiteUrl: "https://example.com",
          landingpageReviewStatus: "approved",
          decisionMakerEmail: `skipped-${suffix}@example.com`,
          slug: `skipped-${suffix}`,
          landingpageUrl: `https://example.com/p/skipped-${suffix}`
        }
      })
    ]);
    await prisma.leadImportRow.createMany({
      data: prospects.map((prospect) => ({
        batchId: batch.id,
        rawJson: { Name: prospect.companyName },
        mappedJson: { generatedEmails: [{ subject: `Hallo ${prospect.companyName}`, body: "Hallo, hier ist die Landingpage: {{landingpageUrl}}" }] },
        status: "enriched",
        prospectId: prospect.id
      }))
    });

    let sentPayload: { to: string; subject: string; text: string; html: string } | null = null;
    const result = await sendBatchEmails(batch.id, {
      selectedProspectIds: [prospects[0].id],
      sendMail: async (payload) => {
        sentPayload = payload;
        return { messageId: "message-1" };
      }
    });

    expect(result.sent).toBe(1);
    expect(sentPayload?.to).toBe(`selected-${suffix}@example.com`);
    expect(sentPayload?.text).toContain(`Selected ${suffix}`);
    expect(sentPayload?.text).toContain(`https://example.com/p/selected-${suffix}`);
    expect(sentPayload?.text).not.toContain(`Skipped ${suffix}`);

    await prisma.campaign.deleteMany({ where: { id: `lead-import-${batch.id}` } });
    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: prospects.map((prospect) => prospect.id) } } });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("limits batch sending to 20 emails per click", async () => {
    const originalEnv = {
      EMAIL_MAX_EMAILS_PER_DAY: process.env.EMAIL_MAX_EMAILS_PER_DAY,
      EMAIL_MAX_EMAILS_PER_BATCH: process.env.EMAIL_MAX_EMAILS_PER_BATCH,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
      SMTP_FROM_NAME: process.env.SMTP_FROM_NAME
    };
    Object.assign(process.env, {
      EMAIL_MAX_EMAILS_PER_DAY: "1000",
      EMAIL_MAX_EMAILS_PER_BATCH: "20",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
      SMTP_FROM_EMAIL: "from@example.com",
      SMTP_FROM_NAME: "Tasklytic"
    });

    const suffix = Date.now();
    const batch = await prisma.leadImportBatch.create({ data: { filename: `send-${suffix}.csv`, totalRows: 25 } });
    const prospects = await Promise.all(Array.from({ length: 25 }, (_, index) => prisma.prospect.create({
      data: {
        companyName: `Send ${suffix}-${index}`,
        city: "Bremen",
        country: "DE",
        businessFields: [],
        companyStatus: "active",
        websiteUrl: "https://example.com",
        landingpageReviewStatus: "approved",
        decisionMakerEmail: `send-${suffix}-${index}@example.com`,
        slug: `send-${suffix}-${index}`,
        landingpageUrl: `https://example.com/send-${suffix}-${index}`
      }
    })));
    await prisma.leadImportRow.createMany({
      data: prospects.map((prospect) => ({
        batchId: batch.id,
        rawJson: { Name: prospect.companyName },
        mappedJson: { generatedEmails: [{ subject: "Hallo", body: "Body {{landingpageUrl}}" }] },
        status: "enriched",
        prospectId: prospect.id
      }))
    });

    let sentCalls = 0;
    const result = await sendBatchEmails(batch.id, {
      sendMail: async () => {
        sentCalls += 1;
        return { messageId: `message-${sentCalls}` };
      }
    });

    expect(result.sent).toBe(20);
    expect(sentCalls).toBe(20);

    await prisma.campaign.deleteMany({ where: { id: `lead-import-${batch.id}` } });
    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: prospects.map((prospect) => prospect.id) } } });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("sets follow-up metadata after successful email sending", async () => {
    const originalEnv = {
      EMAIL_MAX_EMAILS_PER_DAY: process.env.EMAIL_MAX_EMAILS_PER_DAY,
      EMAIL_MAX_EMAILS_PER_BATCH: process.env.EMAIL_MAX_EMAILS_PER_BATCH,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
      SMTP_FROM_NAME: process.env.SMTP_FROM_NAME
    };
    Object.assign(process.env, {
      EMAIL_MAX_EMAILS_PER_DAY: "1000",
      EMAIL_MAX_EMAILS_PER_BATCH: "20",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
      SMTP_FROM_EMAIL: "from@example.com",
      SMTP_FROM_NAME: "Tasklytic"
    });

    const suffix = Date.now();
    const batch = await prisma.leadImportBatch.create({ data: { filename: `follow-up-${suffix}.csv`, totalRows: 1 } });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Follow ${suffix}`,
        city: "Bremen",
        country: "DE",
        businessFields: [],
        companyStatus: "active",
        websiteUrl: "https://example.com",
        landingpageReviewStatus: "approved",
        decisionMakerEmail: `follow-${suffix}@example.com`,
        slug: `follow-${suffix}`,
        landingpageUrl: `https://example.com/p/follow-${suffix}`
      }
    });
    await prisma.leadImportRow.create({
      data: {
        batchId: batch.id,
        rawJson: { Name: prospect.companyName },
        mappedJson: { generatedEmails: [{ subject: "Hallo", body: "Body {{landingpageUrl}}" }] },
        status: "enriched",
        prospectId: prospect.id
      }
    });

    const result = await sendBatchEmails(batch.id, {
      sendMail: async () => ({ messageId: "message-1" })
    });

    expect(result.sent).toBe(1);

    const updated = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(updated.lastEmailSentAt).not.toBeNull();
    expect(updated.lastContactedAt).not.toBeNull();
    expect(updated.followUpAt).not.toBeNull();
    expect(updated.followUpReason).toBe("Nach E-Mail-Versand");
    expect(updated.followUpStatus).toBe("open");
    expect(updated.followUpAt!.getTime()).toBeGreaterThanOrEqual(updated.lastEmailSentAt!.getTime());

    await prisma.campaign.deleteMany({ where: { id: `lead-import-${batch.id}` } });
    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
});
