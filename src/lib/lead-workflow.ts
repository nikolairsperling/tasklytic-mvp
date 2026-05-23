import type { Prospect } from "@prisma/client";
import { generateCampaignCopy } from "@/lib/ai-copy";
import { buildLandingpageUrl, createTrackingToken, renderHtmlTemplate } from "@/lib/campaigns";
import {
  appendOpenTrackingPixel,
  appendUtmParams,
  buildTrackingClickUrl,
  readTrackingSettings,
  resolveEmailTracking
} from "@/lib/app-settings";
import { delay } from "@/lib/email-delay";
import { appendSignature, getDefaultEmailSignature } from "@/lib/email-signature";
import { sendSmtpMail, type MailPayload, type MailSendResult } from "@/lib/mailer";
import { checkEmailSendingLimits, getBatchLimit } from "@/lib/email-limits";
import { calculateFollowUpAt } from "@/lib/follow-ups";
import { prisma } from "@/lib/prisma";
import { enrichProspect } from "@/lib/prospect-enrichment";
import { classifyResearchFailure } from "@/lib/lead-research";
import { generateProspectSlug } from "@/lib/slug";
import { getSafeSmtpSettings } from "@/lib/smtp-settings";
import { missingOfferMessage, requireUserOffer, userOfferContextText } from "@/lib/user-offer";

export type CompanyStatus = "active" | "inactive" | "unclear" | "unreachable";
export type WorkflowBlockReason =
  | "company_status"
  | "missing_website"
  | "missing_company_name"
  | "missing_email"
  | "blocked_info_email"
  | "landingpage_unapproved";

export type WorkflowLeadPreview = {
  prospectId: string;
  companyName: string;
  slug: string | null;
  landingpageUrl: string;
  companyStatus: string;
  email: string;
  reason?: string;
  sendable: boolean;
  generatedEmails: Array<{ subject: string; body: string }>;
};

export type WorkflowQualificationSummary = {
  total: number;
  valid: number;
  withWebsite: number;
  withCompanyName: number;
  withEmail: number;
  sendable: number;
  blocked: number;
  reasons: Partial<Record<WorkflowBlockReason, number>>;
  breakdown: string;
};

type SendMail = (payload: MailPayload) => Promise<MailSendResult>;
type EnrichmentRow = Awaited<ReturnType<typeof getEnrichmentRows>>[number];

export function canContactProspect(
  prospect: Pick<Prospect, "companyStatus" | "decisionMakerEmail" | "companyEmail">,
  options: { blockInfoEmails?: boolean } = {}
) {
  const email = prospect.decisionMakerEmail || prospect.companyEmail;
  if (!email) return { allowed: false, reason: "Keine E-Mail vorhanden." };
  if (!["active", "unclear"].includes(prospect.companyStatus)) return { allowed: false, reason: `Firma ist ${prospect.companyStatus}.` };
  if (options.blockInfoEmails && email.toLowerCase().startsWith("info@")) return { allowed: false, reason: "info@-Adresse ist blockiert." };
  return { allowed: true, email };
}

export function canUseLandingpageForCampaign(prospect: Pick<Prospect, "slug" | "landingpageReviewStatus">) {
  return Boolean(prospect.slug && prospect.landingpageReviewStatus === "approved");
}

export async function checkCompanyStatus(websiteUrl?: string | null, fetcher: typeof fetch = fetch): Promise<CompanyStatus> {
  if (!websiteUrl) return "unclear";
  const normalized = /^https?:\/\//i.test(websiteUrl) ? new URL(websiteUrl) : new URL(`https://${websiteUrl}`);
  const host = normalized.hostname.replace(/^www\./i, "");
  const variants = [`https://${host}`, `https://www.${host}`, `http://${host}`, `http://www.${host}`];
  let saw404 = false;
  for (const url of variants) {
    try {
      const response = await fetcher(url, { method: "GET", redirect: "follow", headers: { Accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(7000) });
      if ([404, 410].includes(response.status)) {
        saw404 = true;
        continue;
      }
      if (!response.ok) continue;
      const text = (await response.text()).toLowerCase().slice(0, 50000);
      if (/insolvenz|geschlossen|dauerhaft geschlossen|liquidation|nicht mehr aktiv/.test(text)) return "inactive";
      return "active";
    } catch {
      continue;
    }
  }
  return saw404 ? "unreachable" : "unclear";
}

export async function enrichImportBatch(batchId: string, limit = 20, minFitScore?: number) {
  console.info("WORKFLOW_ENRICH_START", { batchId, limit, minFitScore });
  const rows = await getEnrichmentRows(batchId, Math.min(20, Math.max(1, limit)), minFitScore);
  console.info("SELECTED_LEADS_COUNT", { batchId, count: rows.length });
  if (rows.length === 0) {
    console.error("ENRICHMENT_FAILED", { batchId, message: "Keine Leads für Anreicherung gefunden" });
    throw new Error("Keine Leads für Anreicherung gefunden");
  }
  console.info("ENRICHMENT_BATCH_CREATED", { batchId, count: rows.length });

  let enriched = 0;
  let invalid = 0;
  let failed = 0;
  let processed = 0;
  const details: Array<{ leadImportRowId: string; prospectId?: string; companyName?: string; status: "success" | "invalid" | "failed"; error?: string }> = [];
  for (const row of rows) {
    processed += 1;
    const detail = await enrichImportRow(row, batchId);
    if (detail.status === "success") enriched += 1;
    if (detail.status === "invalid") invalid += 1;
    if (detail.status === "failed") failed += 1;
    details.push(detail);
  }

  if (invalid > 0) {
    await prisma.leadImportBatch.update({ where: { id: batchId }, data: { invalidCount: { increment: invalid } } });
  }

  return {
    processed,
    enriched,
    successful: enriched,
    invalid,
    failed,
    details,
    breakdown: `${processed}/${rows.length} verarbeitet, ${enriched} erfolgreich, ${failed} fehlgeschlagen`
  };
}

export async function getEnrichmentRows(batchId: string, limit = 20, minFitScore?: number) {
  return prisma.leadImportRow.findMany({
    where: { batchId, prospectId: { not: null }, status: { in: ["imported", "duplicate", "pending"] }, prospect: minFitScore === undefined ? undefined : { fitScore: { gt: minFitScore } } },
    include: { prospect: true },
    take: Math.min(20, Math.max(1, limit)),
    orderBy: { createdAt: "asc" }
  });
}

export async function enrichImportRow(row: EnrichmentRow, batchId?: string): Promise<{ leadImportRowId: string; prospectId?: string; companyName?: string; status: "success" | "invalid" | "failed"; error?: string }> {
  if (!row.prospect) {
    const message = "Lead ist nicht mit einem Prospect verknüpft.";
    await prisma.leadImportRow.update({ where: { id: row.id }, data: { status: "failed", reason: message } });
    return { leadImportRowId: row.id, status: "failed", error: message };
  }

  try {
    console.info("ENRICHMENT_STARTED", { batchId, leadImportRowId: row.id, prospectId: row.prospect.id, companyName: row.prospect.companyName });
    let companyStatus = row.prospect.companyStatus;
    if (row.prospect.websiteUrl) {
      companyStatus = await checkCompanyStatus(row.prospect.websiteUrl);
      await prisma.prospect.update({ where: { id: row.prospect.id }, data: { companyStatus } });
      if (companyStatus === "inactive" || companyStatus === "unreachable") {
        await prisma.prospect.update({
          where: { id: row.prospect.id },
          data: { enrichmentStatus: "partial", enrichmentNotes: "Website verdächtig / abweichend. Firmenname-Suche wird versucht." }
        }).catch(() => undefined);
      }
    }
    const result = await enrichProspect({ ...row.prospect, companyStatus });
    if (result.status === "failed" || result.status === "website_unreachable" || result.status === "cookie_banner_blocked") {
      const message = result.notes?.join("\n") || "Website konnte nicht abgerufen werden";
      await prisma.leadImportRow.update({ where: { id: row.id }, data: { status: "failed", reason: message } });
      console.error("ENRICHMENT_FAILED", { batchId, leadImportRowId: row.id, prospectId: row.prospect.id, message });
      return { leadImportRowId: row.id, prospectId: row.prospect.id, companyName: row.prospect.companyName, status: "failed", error: message };
    }
    await prisma.leadImportRow.update({ where: { id: row.id }, data: { status: "enriched", reason: null } });
    return { leadImportRowId: row.id, prospectId: row.prospect.id, companyName: row.prospect.companyName, status: "success" };
  } catch (error) {
    const message = workflowEnrichmentErrorMessage(error);
    console.error("ENRICHMENT_FAILED", { batchId, leadImportRowId: row.id, prospectId: row.prospect.id, message });
    await prisma.leadImportRow.update({ where: { id: row.id }, data: { status: "failed", reason: message } });
    return { leadImportRowId: row.id, prospectId: row.prospect.id, companyName: row.prospect.companyName, status: "failed", error: message };
  }
}

export function workflowEnrichmentErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const failure = classifyResearchFailure(error);
  if (/Website URL fehlt/i.test(message)) return "Website URL fehlt.";
  if (/OPENAI|API key|api key/i.test(message)) return "OpenAI API Key fehlt";
  if (failure.code !== "RESEARCH_FAILED") return failure.message;
  if (/fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|network|Abruf fehlgeschlagen/i.test(message)) return "Website konnte nicht abgerufen werden";
  if (/prisma|database|relation|unique|foreign key|connect|ECONNREFUSED/i.test(message)) return "Datenbankfehler beim Speichern";
  return message || "Anreicherung fehlgeschlagen";
}

export async function generateLandingpagesForBatch(batchId: string, minFitScore?: number) {
  const rows = await validWorkflowRows(batchId, minFitScore);
  let generated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.prospect || !row.prospect.companyName || !row.prospect.city) {
      skipped += 1;
      continue;
    }
    const slug = row.prospect.slug ?? await uniqueSlug(row.prospect);
    const landingpageUrl = buildLandingpageUrl(slug);
    await prisma.prospect.update({
      where: { id: row.prospect.id },
      data: { slug, landingpageUrl, status: "landingpage_ready", landingpageReviewStatus: "needs_review" }
    });
    generated += 1;
  }
  return { generated, skipped };
}

export async function generateEmailsForBatch(batchId: string, minFitScore?: number) {
  const rows = await validWorkflowRows(batchId, minFitScore);
  let generated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.prospect) {
      skipped += 1;
      continue;
    }
    if (!canUseLandingpageForCampaign(row.prospect)) {
      skipped += 1;
      await prisma.leadImportRow.update({ where: { id: row.id }, data: { reason: "Landingpage ist noch nicht freigegeben." } });
      continue;
    }
    const landingpageUrl = row.prospect.landingpageUrl ?? buildLandingpageUrl(row.prospect.slug!);
    const emails = await generateOutreachEmails(row.prospect, landingpageUrl);
    const mapped = { ...(isObject(row.mappedJson) ? row.mappedJson : {}), generatedEmails: emails };
    await prisma.leadImportRow.update({ where: { id: row.id }, data: { mappedJson: mapped, status: "enriched" } });
    generated += 1;
  }
  return { generated, skipped };
}

async function generateOutreachEmails(prospect: Prospect, landingpageUrl: string) {
  const offer = await requireUserOffer();
  try {
    const copy = await generateCampaignCopy({
      prospectId: prospect.id,
      tone: "direkt",
      numberOfSteps: 3,
      variantCount: 2,
      goal: "Landingpage ansehen und einen kurzen Austausch starten"
    });
    return copy.steps.map((step) => ({
      subject: step.subject,
      body: ensureEmailQuality(
        step.body.includes("{{landingpageUrl}}") || !landingpageUrl ? step.body : `${step.body}\n\n${landingpageUrl}`,
        prospect,
        landingpageUrl
      )
    }));
  } catch {
    return fallbackOutreachEmails(prospect, landingpageUrl, userOfferContextText(offer));
  }
}

export type LeadToOutreachRunInput = {
  batchId: string;
  minFitScore?: number;
  enrich?: boolean;
  generateLandingpages?: boolean;
  generateEmails?: boolean;
  prepareSend?: boolean;
  sendNow?: boolean;
  selectedProspectIds?: string[];
};

export type LeadToOutreachRunResult = {
  total: number;
  valid: number;
  withWebsite: number;
  withCompanyName: number;
  withEmail: number;
  sendable: number;
  blocked: number;
  breakdown: string;
  processed: number;
  enriched: number;
  invalid: number;
  landingpagesGenerated: number;
  emailsGenerated: number;
  prepared: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    leadImportRowId: string;
    prospectId?: string;
    companyName?: string;
    status: "success" | "invalid" | "failed";
    error?: string;
  }>;
};

export async function runLeadToOutreachWorkflow(input: LeadToOutreachRunInput): Promise<LeadToOutreachRunResult> {
  const result: LeadToOutreachRunResult = {
    total: 0,
    valid: 0,
    withWebsite: 0,
    withCompanyName: 0,
    withEmail: 0,
    sendable: 0,
    blocked: 0,
    breakdown: "",
    processed: 0,
    enriched: 0,
    invalid: 0,
    landingpagesGenerated: 0,
    emailsGenerated: 0,
    prepared: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  const summary = await summarizeWorkflowBatch(input.batchId, {
    minFitScore: input.minFitScore ?? 60,
    blockInfoEmails: true,
    selectedProspectIds: input.selectedProspectIds
  });
  result.total = summary.total;
  result.valid = summary.valid;
  result.withWebsite = summary.withWebsite;
  result.withCompanyName = summary.withCompanyName;
  result.withEmail = summary.withEmail;
  result.sendable = summary.sendable;
  result.blocked = summary.blocked;
  result.breakdown = summary.breakdown;

  if (input.enrich) {
    const enrichment = await enrichImportBatch(input.batchId, 20, input.minFitScore ?? 60);
    result.processed = enrichment.processed;
    result.enriched = enrichment.enriched;
    result.invalid = enrichment.invalid;
    result.failed = enrichment.failed;
    result.details = enrichment.details;
  }

  if (input.generateLandingpages) {
    const landingpages = await generateLandingpagesForBatch(input.batchId, input.minFitScore ?? 60);
    result.landingpagesGenerated = landingpages.generated;
    result.skipped += landingpages.skipped;
  }

  if (input.generateEmails) {
    const emails = await generateEmailsForBatch(input.batchId, input.minFitScore ?? 60);
    result.emailsGenerated = emails.generated;
    result.skipped += emails.skipped;
  }

  if (input.prepareSend) {
    result.prepared = await countPreparedEmails(input.batchId);
  }

  if (input.sendNow === true) {
    const sendResult = await sendBatchEmails(input.batchId, {
      blockInfoEmails: true,
      limit: 20,
      selectedProspectIds: input.selectedProspectIds
    });
    result.sent = sendResult.sent;
    result.failed = sendResult.failed;
    result.skipped += sendResult.skipped;
  }

  return result;
}

export async function sendBatchEmails(batchId: string, options: { blockInfoEmails?: boolean; sendMail?: SendMail; limit?: number; selectedProspectIds?: string[] } = {}) {
  const smtp = await getSafeSmtpSettings();
  if (!smtp.configured) {
    throw new Error(`SMTP ist nicht vollständig konfiguriert: ${smtp.missingFields.join(", ")}`);
  }

  const rows = (await validWorkflowRows(batchId, undefined, options.selectedProspectIds))
    .slice(0, getBatchLimit(options.limit));
  const offer = await requireUserOffer();
  const offerContext = userOfferContextText(offer);
  const signature = await getDefaultEmailSignature();
  const trackingSettings = await readTrackingSettings();
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.prospect) continue;
    if (!canUseLandingpageForCampaign(row.prospect)) {
      skipped += 1;
      await prisma.leadImportRow.update({ where: { id: row.id }, data: { reason: "Landingpage ist noch nicht freigegeben." } });
      continue;
    }
    const contact = canContactProspect(row.prospect, { blockInfoEmails: options.blockInfoEmails });
    if (!contact.allowed) {
      skipped += 1;
      await prisma.leadImportRow.update({ where: { id: row.id }, data: { reason: contact.reason } });
      continue;
    }
    const recipient = contact.email;
    if (!recipient) {
      skipped += 1;
      continue;
    }
    const emails = isObject(row.mappedJson) && Array.isArray(row.mappedJson.generatedEmails)
      ? row.mappedJson.generatedEmails as Array<{ subject: string; body: string }>
      : fallbackOutreachEmails(row.prospect, row.prospect.landingpageUrl ?? "", offerContext);
    const first = emails[0];
    const tracking = resolveEmailTracking(trackingSettings);
    const trackingToken = tracking.openEnabled ? createTrackingToken() : undefined;
    const clickToken = tracking.clickEnabled ? createTrackingToken() : undefined;
    const landingpageUrl = appendUtmParams(row.prospect.landingpageUrl ?? buildLandingpageUrl(row.prospect.slug!), trackingSettings);
    const trackedUrl = landingpageUrl && clickToken ? buildTrackingClickUrl(clickToken, trackingSettings) : landingpageUrl;
    const qualifiedBody = ensureEmailQuality(first.body, row.prospect, landingpageUrl);
    const bodyText = qualifiedBody.replace(/{{\s*landingpageUrl\s*}}/g, trackedUrl);
    const htmlWithTracking = appendOpenTrackingPixel(renderHtmlTemplate(bodyText, row.prospect, trackedUrl), trackingToken, trackingSettings);
    const signed = appendSignature({ bodyHtml: htmlWithTracking, bodyText, signature });
    const limitDecision = await checkEmailSendingLimits({ prospectId: row.prospect.id, now: new Date() });

    if (!limitDecision.allowed) {
      skipped += 1;
      await prisma.leadImportRow.update({
        where: { id: row.id },
        data: { reason: "Limit erreicht" }
      });
      continue;
    }

    try {
      await delay();
      const mailResult = await (options.sendMail ?? sendSmtpMail)({
        to: recipient,
        subject: first.subject,
        text: signed.text,
        html: signed.html
      });

      const campaign = await prisma.campaign.upsert({
        where: { id: `lead-import-${batchId}` },
        update: {},
        create: { id: `lead-import-${batchId}`, name: `Lead Import ${batchId}`, status: "active", offerId: offer.id, trackingEnabled: true }
      });
      const step = await prisma.campaignStep.upsert({
        where: { campaignId_position: { campaignId: campaign.id, position: 0 } },
        update: {},
        create: { campaignId: campaign.id, position: 0, delayDays: 0, subject: first.subject, bodyText }
      });
      const enrollment = await prisma.campaignEnrollment.upsert({
        where: { campaignId_prospectId: { campaignId: campaign.id, prospectId: row.prospect.id } },
        update: { status: "active" },
        create: { campaignId: campaign.id, prospectId: row.prospect.id }
      });
      await prisma.emailSendLog.create({
        data: {
          campaignId: campaign.id,
          stepId: step.id,
          enrollmentId: enrollment.id,
          prospectId: row.prospect.id,
          email: recipient,
          status: "sent",
          subject: first.subject,
          trackingToken,
          clickToken,
          landingpageUrl,
          messageId: mailResult.messageId,
          sentAt: new Date()
        }
      });
      const sentAt = new Date();
      await prisma.prospect.update({
        where: { id: row.prospect.id },
        data: {
          emailStatus: "sent",
          lastContactedAt: sentAt,
          lastEmailSentAt: sentAt,
          followUpAt: calculateFollowUpAt(sentAt),
          followUpReason: "Nach E-Mail-Versand",
          followUpStatus: "open",
          status: "contacted"
        }
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await prisma.leadImportRow.update({ where: { id: row.id }, data: { reason: error instanceof Error ? error.message : "Versand fehlgeschlagen." } });
    }
  }
  return { sent, failed, skipped };
}

function fallbackOutreachEmails(prospect: Pick<Prospect, "companyName" | "decisionMakerName" | "customPainPoint" | "websiteMaturitySignal" | "landingpageUrl">, landingpageUrl: string, offerContext?: string) {
  if (!offerContext) throw new Error(missingOfferMessage);
  const name = prospect.decisionMakerName || "Guten Tag";
  const signal = prospect.customPainPoint || prospect.websiteMaturitySignal || `die Abläufe bei ${prospect.companyName}`;
  const offerLine = offerContext.split("\n").filter((line) => /Dienstleistung|Loesung|Unterscheidung/.test(line)).join(" ");
  return [
    {
      subject: `Kurze Frage zu ${prospect.companyName}`,
      body: `${name},\n\nich habe eine kurze Seite fuer ${prospect.companyName} vorbereitet. Der Fokus liegt auf ${signal}. ${offerLine}\n\n${landingpageUrl || "{{landingpageUrl}}"}`
    },
    {
      subject: `Nochmal kurz zu ${prospect.companyName}`,
      body: `${name},\n\nfalls die Seite untergegangen ist: Ich habe ${signal} bei ${prospect.companyName} mit unserem Angebot abgeglichen. ${offerLine}\n\n${landingpageUrl || "{{landingpageUrl}}"}`
    },
    {
      subject: `Soll ich das schließen?`,
      body: `${name},\n\nwenn das Thema gerade nicht relevant ist, reicht eine kurze Rueckmeldung. Sonst finden Sie die konkrete Zusammenfassung fuer ${prospect.companyName} und den passenden Loesungsansatz hier:\n\n${landingpageUrl || "{{landingpageUrl}}"}`
    }
  ];
}

async function validWorkflowRows(batchId: string, minFitScore?: number, selectedProspectIds?: string[]) {
  const rows = await prisma.leadImportRow.findMany({
    where: {
      batchId,
      prospectId: { not: null },
      status: { notIn: ["invalid", "failed"] },
      ...(selectedProspectIds?.length ? { prospectId: { in: selectedProspectIds } } : {})
    },
    include: { prospect: true },
    orderBy: { createdAt: "asc" }
  });

  return rows.filter((row) => {
    const prospect = row.prospect;
    if (!prospect) return false;
    if (!["active", "unclear"].includes(prospect.companyStatus)) return false;
    if (!prospect.companyName || !prospect.websiteUrl) return false;
    if (!(prospect.decisionMakerEmail || prospect.companyEmail)) return false;
    if (minFitScore !== undefined && (prospect.fitScore ?? 0) <= minFitScore) return false;
    const contact = canContactProspect(prospect, { blockInfoEmails: true });
    return contact.allowed && Boolean(prospect.websiteUrl) && Boolean(prospect.companyName);
  });
}

async function countPreparedEmails(batchId: string) {
  const rows = await validWorkflowRows(batchId);
  return rows.filter((row) => {
    if (!row.prospect?.landingpageUrl || row.prospect.landingpageReviewStatus !== "approved") return false;
    return isObject(row.mappedJson) && Array.isArray(row.mappedJson.generatedEmails);
  }).length;
}

async function uniqueSlug(prospect: Pick<Prospect, "id" | "companyName" | "city">) {
  let slug = generateProspectSlug(prospect.companyName, prospect.city);
  const existing = await prisma.prospect.findFirst({ where: { slug, NOT: { id: prospect.id } } });
  if (existing) slug = `${slug}-${prospect.id.slice(0, 6)}`;
  return slug;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function ensureEmailQuality(body: string, prospect: Pick<Prospect, "companyName" | "customPainPoint" | "websiteMaturitySignal" | "landingpageUrl" | "decisionMakerName">, landingpageUrl: string) {
  const parts = [
    body,
    prospect.companyName && !body.includes(prospect.companyName) ? `\n\nBezug zu ${prospect.companyName}.` : "",
    prospect.customPainPoint && !body.toLowerCase().includes(prospect.customPainPoint.toLowerCase()) ? `\n\nKonkreter Bezug: ${prospect.customPainPoint}.` : "",
    prospect.websiteMaturitySignal && !body.toLowerCase().includes(prospect.websiteMaturitySignal.toLowerCase()) ? `\n\n${prospect.websiteMaturitySignal}.` : "",
    landingpageUrl && !body.includes(landingpageUrl) ? `\n\n${landingpageUrl}` : ""
  ];
  return parts.filter(Boolean).join("");
}

export async function summarizeWorkflowBatch(
  batchId: string,
  options: { minFitScore?: number; blockInfoEmails?: boolean; selectedProspectIds?: string[] } = {}
): Promise<WorkflowQualificationSummary> {
  const rows = await prisma.leadImportRow.findMany({
    where: {
      batchId,
      prospectId: { not: null },
      status: { notIn: ["invalid", "failed"] },
      ...(options.selectedProspectIds?.length ? { prospectId: { in: options.selectedProspectIds } } : {})
    },
    include: { prospect: true },
    orderBy: { createdAt: "asc" }
  });

  const summary: WorkflowQualificationSummary = {
    total: rows.length,
    valid: 0,
    withWebsite: 0,
    withCompanyName: 0,
    withEmail: 0,
    sendable: 0,
    blocked: 0,
    reasons: {},
    breakdown: "0 Leads"
  };

  for (const row of rows) {
    const prospect = row.prospect;
    if (!prospect) continue;
    const hasWebsite = Boolean(prospect.websiteUrl);
    const hasCompanyName = Boolean(prospect.companyName);
    const contact = canContactProspect(prospect, { blockInfoEmails: options.blockInfoEmails ?? true });
    const passesFit = options.minFitScore === undefined ? true : prospect.fitScore > options.minFitScore;
    if (passesFit && hasWebsite && hasCompanyName && Boolean(contact.email)) {
      summary.valid += 1;
    }
    if (hasWebsite) summary.withWebsite += 1;
    if (hasCompanyName) summary.withCompanyName += 1;
    if (Boolean(contact.email)) summary.withEmail += 1;
    if (contact.allowed && hasWebsite && hasCompanyName && canUseLandingpageForCampaign(prospect)) {
      summary.sendable += 1;
    } else {
      summary.blocked += 1;
      const reason = getWorkflowBlockReason(prospect, contact.reason);
      summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1;
    }
  }

  summary.breakdown = `${summary.total} Leads -> ${summary.valid} gültig -> ${summary.withEmail} mit E-Mail -> ${summary.sendable} versendbar`;
  return summary;
}

export async function buildWorkflowLeadPreviews(batchId: string, options: { minFitScore?: number; blockInfoEmails?: boolean } = {}): Promise<WorkflowLeadPreview[]> {
  const rows = await validWorkflowRows(batchId, options.minFitScore, undefined);
  const offer = await requireUserOffer().catch(() => null);
  const offerContext = offer ? userOfferContextText(offer) : undefined;

  const previews: WorkflowLeadPreview[] = [];
  for (const row of rows) {
    if (!row.prospect) continue;
    const prospect = row.prospect;
    const contact = canContactProspect(prospect, { blockInfoEmails: options.blockInfoEmails ?? true });
    if (!prospect.companyName || !prospect.websiteUrl || !contact.allowed || !canUseLandingpageForCampaign(prospect)) {
      continue;
    }
    const landingpageUrl = prospect.landingpageUrl ?? (prospect.slug ? buildLandingpageUrl(prospect.slug) : "");
    previews.push({
      prospectId: prospect.id,
      companyName: prospect.companyName,
      slug: prospect.slug,
      landingpageUrl,
      companyStatus: prospect.companyStatus,
      email: contact.email ?? "",
      sendable: Boolean(landingpageUrl && canUseLandingpageForCampaign(prospect)),
      reason: canUseLandingpageForCampaign(prospect) ? undefined : "Landingpage nicht freigegeben.",
      generatedEmails: normalizeGeneratedEmails(row, offerContext)
    });
  }
  return previews;
}

function normalizeGeneratedEmails(row: { prospect: Prospect | null; mappedJson: unknown }, offerContext?: string) {
  if (!row.prospect) return [];
  const prospect = row.prospect;
  const generatedEmails = isObject(row.mappedJson) && Array.isArray(row.mappedJson.generatedEmails)
    ? row.mappedJson.generatedEmails as Array<{ subject?: unknown; body?: unknown }>
    : offerContext ? fallbackOutreachEmails(prospect, prospect.landingpageUrl ?? "", offerContext) : [];
  return generatedEmails.map((email) => ({
    subject: typeof email.subject === "string" ? email.subject : "Kein Betreff",
    body: ensureEmailQuality(typeof email.body === "string" ? email.body : "Keine Vorschau verfügbar.", prospect, prospect.landingpageUrl ?? "")
  }));
}

function getWorkflowBlockReason(
  prospect: Prospect,
  fallbackReason?: string
): WorkflowBlockReason {
  if (!["active", "unclear"].includes(prospect.companyStatus)) return "company_status";
  if (!prospect.companyName) return "missing_company_name";
  if (!prospect.websiteUrl) return "missing_website";
  const contact = canContactProspect(prospect, { blockInfoEmails: true });
  if (!contact.allowed && fallbackReason?.includes("info@")) return "blocked_info_email";
  if (!contact.allowed) return "missing_email";
  if (prospect.landingpageReviewStatus !== "approved" && prospect.slug) return "landingpage_unapproved";
  return "missing_email";
}
