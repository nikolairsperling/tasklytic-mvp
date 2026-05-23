import type { Prisma, Prospect } from "@prisma/client";
import { getEffectiveOpenAiApiKey } from "@/lib/integrations";
import { getTargetGroupOrDefault, type TargetGroupLike, targetGroupContextText } from "@/lib/target-groups";
import { requireOfferForProspect, userOfferContextText } from "@/lib/user-offer";

export type LeadResearchResult = {
  researchStatus: string;
  phone: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  contactPageUrl: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  generalContactLabel: string | null;
  linkedinUrl: string | null;
  decisionMakerRole: string | null;
  decisionMakerEmail: string | null;
  decisionMakerPhone: string | null;
  decisionMakerName: string | null;
  firstName: string | null;
  lastName: string | null;
  icpFitScore: number;
  icpFitLabel: "low" | "medium" | "high";
  industry: string | null;
  painScore: number;
  painType: string | null;
  painSummary: string | null;
  painEvidence: Array<{ type: string; keyword: string; source: string; excerpt?: string }>;
  hiringSignal: boolean;
  growthSignal: boolean;
  manualProcessSignal: boolean;
  digitalWeaknessSignal: boolean;
  personalizationAngle: string | null;
  researchSources: Array<{ url: string; ok: boolean; title?: string; error?: string }>;
  researchedAt: Date;
  companyDescription: string | null;
  services: string[];
  companySizeLabel: "unknown" | "small" | "medium" | "large";
  employeeCountEstimate: number | null;
  locationsCount: number | null;
  fleetSizeEstimate: number | null;
  specialization: string | null;
  targetCustomers: string | null;
  companyProfileSummary: string | null;
  suggestedOfferId: string | null;
};

export type LeadResearchUpdate = Prisma.ProspectUncheckedUpdateInput & {
  updatedFields: string[];
};

export type ResearchFailure = {
  status: "failed" | "partial" | "cookie_banner_blocked" | "website_unreachable" | "no_website";
  code: "COOKIE_BANNER_BLOCKED" | "WEBSITE_UNREACHABLE" | "NO_WEBSITE" | "RESEARCH_FAILED" | "DNS_ERROR" | "SSL_ERROR" | "PAGE_TOO_SLOW" | "BOT_PROTECTION" | "NO_USABLE_DATA" | "CRAWLER_TIMEOUT" | "AI_TIMEOUT";
  message: string;
  failedStep: "website_fetch" | "contact_fetch" | "crawler" | "ai_analysis" | "analysis";
  sourceUrl?: string | null;
};

type PageText = {
  url: string;
  ok: boolean;
  title?: string;
  text: string;
  error?: string;
};

const researchPaths = [
  "/impressum",
  "/kontakt",
  "/ueber-uns",
  "/über-uns",
  "/unternehmen",
  "/portrait",
  "/leistungen",
  "/logistik",
  "/transport",
  "/team",
  "/",
  "/karriere",
  "/fuhrpark",
  "/jobs",
  "/stellenangebote"
];

const logisticsKeywords = ["spedition", "transport", "logistik", "fracht", "stückgut", "container", "lager", "fuhrpark", "disposition", "lkw", "express", "nahverkehr", "fernverkehr"];
const hiringKeywords = ["karriere", "jobs", "stellenangebote", "wir suchen", "fahrer", "berufskraftfahrer", "disponent", "bewerbung"];
const manualKeywords = ["telefon", "fax", "e-mail", "email", "pdf", "formular", "anfrage per mail"];
const digitalWeaknessKeywords = ["fax", "pdf", "formular", "telefonisch", "per mail", "e-mail"];
const growthKeywords = ["wachstum", "expandieren", "neuer standort", "neue niederlassung", "seit", "familienunternehmen", "modern"];
const serviceKeywords = [
  "transport",
  "logistik",
  "stückgut",
  "lagerung",
  "express",
  "schwertransport",
  "kühltransport",
  "baustoffe",
  "container",
  "internationaler transport",
  "strasse",
  "straße",
  "schiene",
  "luft",
  "see",
  "zoll",
  "digital",
  "digitale services",
  "supply chain",
  "nahverkehr",
  "fernverkehr"
];
const forbiddenContactNameTerms = [
  "kundenbereich",
  "frachtanfragen",
  "auftragserfassung",
  "kontakt",
  "impressum",
  "datenschutz",
  "karriere",
  "leistungen",
  "service",
  "anfrage",
  "kundenservice",
  "zentrale",
  "disposition",
  "fuhrpark"
];
const decisionMakerRoles = ["geschäftsführer", "geschaeftsfuehrer", "geschäftsführung", "geschaeftsfuehrung", "inhaber", "inhaberin", "vorstand", "leitung", "ceo", "managing director"];
const generalEmailPrefixes = ["info", "kontakt", "zentrale", "office", "service", "disposition"];
const boilerplateTerms = [
  "welche seiten beliebt sind",
  "ihr erlebnis verbessern",
  "ihr erlebnis und unsere dienstleistungen",
  "cookies",
  "cookie",
  "datenschutz",
  "google analytics",
  "tracking",
  "einwilligung",
  "akzeptieren",
  "ablehnen",
  "marketing cookies",
  "newsletter",
  "lieferbedingungen",
  "lieferung",
  "versand",
  "weitertransport ins gebäude",
  "weitertransport ins gebaeude",
  "hotline",
  "login",
  "kundenbereich",
  "warenkorb",
  "impressum"
];
const companyDescriptionTerms = logisticsKeywords;

export async function researchProspect(prospect: Prospect, fetcher: typeof fetch = fetch): Promise<LeadResearchResult> {
  if (!prospect.websiteUrl) {
    throw new Error("Keine Website vorhanden");
  }

  const offer = await requireOfferForProspect(prospect);
  const pages = await scrapeWebsite(prospect.websiteUrl, fetcher);
  console.log("[lead-research]", {
    prospectId: prospect.id,
    websiteUrl: prospect.websiteUrl,
    loadedUrls: pages.map((page) => page.url),
    extractedTextLength: pages.reduce((sum, page) => sum + page.text.length, 0)
  });
  const targetGroup = await getTargetGroupOrDefault(prospect.targetGroupId);
  const heuristic = analyzeHeuristically(prospect, pages, targetGroup, userOfferContextText(offer));
  const openAi = await analyzeWithOpenAiIfAvailable(pages, heuristic, targetGroup, userOfferContextText(offer)).catch(() => null);
  return normalizeResearchResult({ ...heuristic, ...sanitizeOpenAiResult(openAi, pages) });
}

export function buildResearchUpdate(prospect: Prospect, result: LeadResearchResult): LeadResearchUpdate {
  const data: Prisma.ProspectUncheckedUpdateInput = {
    researchStatus: result.researchStatus,
    researchSources: result.researchSources as Prisma.InputJsonValue,
    researchedAt: result.researchedAt,
    lastResearchAt: result.researchedAt,
    lastResearchError: null,
    lastResearchErrorCode: null,
    failedStep: null,
    sourceUrl: result.researchSources[0]?.url ?? prospect.websiteUrl,
    lastAttemptAt: result.researchedAt,
    ...(result.researchStatus === "completed" ? { lastSuccessfulResearchAt: result.researchedAt } : {})
  };
  const updatedFields: string[] = [];

  fillText(data, updatedFields, "phone", prospect.phone, result.companyPhone);
  fillText(data, updatedFields, "companyPhone", prospect.companyPhone, result.companyPhone);
  fillText(data, updatedFields, "companyEmail", prospect.companyEmail, result.companyEmail);
  fillText(data, updatedFields, "contactPageUrl", prospect.contactPageUrl, result.contactPageUrl);
  fillText(data, updatedFields, "street", prospect.street, result.street);
  fillText(data, updatedFields, "postalCode", prospect.postalCode, result.postalCode);
  fillText(data, updatedFields, "city", prospect.city, result.city);
  fillCountry(data, updatedFields, prospect.country, result.country);
  fillText(data, updatedFields, "generalContactLabel", prospect.generalContactLabel, result.generalContactLabel);
  fillText(data, updatedFields, "linkedinUrl", prospect.linkedinUrl, result.linkedinUrl);
  fillText(data, updatedFields, "decisionMakerRole", prospect.decisionMakerRole, result.decisionMakerRole);
  fillText(data, updatedFields, "decisionMakerEmail", prospect.decisionMakerEmail, result.decisionMakerEmail);
  fillText(data, updatedFields, "decisionMakerPhone", prospect.decisionMakerPhone, result.decisionMakerPhone);
  fillPersonText(data, updatedFields, "decisionMakerName", prospect.decisionMakerName, result.decisionMakerName);
  fillPersonText(data, updatedFields, "firstName", prospect.firstName, result.firstName);
  fillPersonText(data, updatedFields, "lastName", prospect.lastName, result.lastName);
  fillText(data, updatedFields, "industry", prospect.industry, result.industry);
  fillReplaceableText(data, updatedFields, "painType", prospect.painType, result.painType, isInvalidPainType);
  fillText(data, updatedFields, "painSummary", prospect.painSummary, result.painSummary);
  fillText(data, updatedFields, "personalizationAngle", prospect.personalizationAngle, result.personalizationAngle);
  fillReplaceableText(data, updatedFields, "companyDescription", prospect.companyDescription, result.companyDescription, (value) => !isValidCompanyDescription(value));
  fillText(data, updatedFields, "specialization", prospect.specialization, result.specialization);
  fillText(data, updatedFields, "targetCustomers", prospect.targetCustomers, result.targetCustomers);
  fillReplaceableText(data, updatedFields, "companyProfileSummary", prospect.companyProfileSummary, result.companyProfileSummary, (value) => isBoilerplateText(value));
  fillText(data, updatedFields, "companySizeLabel", prospect.companySizeLabel === "unknown" ? null : prospect.companySizeLabel, result.companySizeLabel === "unknown" ? null : result.companySizeLabel);
  fillNumber(data, updatedFields, "icpFitScore", prospect.icpFitScore, result.icpFitScore);
  fillText(data, updatedFields, "icpFitLabel", prospect.icpFitScore > 0 ? prospect.icpFitLabel : null, result.icpFitLabel);
  fillNumber(data, updatedFields, "painScore", prospect.painScore, result.painScore);
  fillReplaceableNumber(data, updatedFields, "employeeCountEstimate", prospect.employeeCountEstimate, result.employeeCountEstimate);
  fillReplaceableNumber(data, updatedFields, "locationsCount", prospect.locationsCount, result.locationsCount);
  fillReplaceableNumber(data, updatedFields, "fleetSizeEstimate", prospect.fleetSizeEstimate, result.fleetSizeEstimate);
  fillText(data, updatedFields, "suggestedOfferId", prospect.suggestedOfferId, result.suggestedOfferId);
  if (isEmptyJsonArray(prospect.services) && result.services.length > 0) {
    data.services = result.services as Prisma.InputJsonValue;
    updatedFields.push("services");
  }
  if (isEmptyJsonArray(prospect.painEvidence) && result.painEvidence.length > 0) {
    data.painEvidence = result.painEvidence as Prisma.InputJsonValue;
    updatedFields.push("painEvidence");
  }
  fillBoolean(data, updatedFields, "hiringSignal", prospect.hiringSignal, result.hiringSignal);
  fillBoolean(data, updatedFields, "growthSignal", prospect.growthSignal, result.growthSignal);
  fillBoolean(data, updatedFields, "manualProcessSignal", prospect.manualProcessSignal, result.manualProcessSignal);
  fillBoolean(data, updatedFields, "digitalWeaknessSignal", prospect.digitalWeaknessSignal, result.digitalWeaknessSignal);

  console.log("[lead-research]", { prospectId: prospect.id, updatedFields });
  return Object.assign(data, { updatedFields });
}

export function toResearchResponse(prospect: Pick<Prospect,
  | "phone"
  | "companyPhone"
  | "companyEmail"
  | "contactPageUrl"
  | "street"
  | "postalCode"
  | "city"
  | "country"
  | "generalContactLabel"
  | "linkedinUrl"
  | "decisionMakerRole"
  | "decisionMakerEmail"
  | "decisionMakerPhone"
  | "decisionMakerName"
  | "firstName"
  | "lastName"
  | "researchStatus"
  | "icpFitScore"
  | "icpFitLabel"
  | "industry"
  | "painScore"
  | "painType"
  | "painSummary"
  | "painEvidence"
  | "hiringSignal"
  | "growthSignal"
  | "manualProcessSignal"
  | "digitalWeaknessSignal"
  | "personalizationAngle"
  | "researchSources"
  | "researchedAt"
  | "lastResearchError"
  | "lastResearchErrorCode"
  | "lastResearchAt"
  | "failedStep"
  | "sourceUrl"
  | "lastAttemptAt"
  | "lastSuccessfulResearchAt"
  | "companyDescription"
  | "services"
  | "companySizeLabel"
  | "employeeCountEstimate"
  | "locationsCount"
  | "fleetSizeEstimate"
  | "specialization"
  | "targetCustomers"
  | "companyProfileSummary"
>) {
  return {
    phone: prospect.phone,
    companyPhone: prospect.companyPhone,
    companyEmail: prospect.companyEmail,
    contactPageUrl: prospect.contactPageUrl,
    street: prospect.street,
    postalCode: prospect.postalCode,
    city: prospect.city,
    country: prospect.country,
    generalContactLabel: prospect.generalContactLabel,
    linkedinUrl: prospect.linkedinUrl,
    decisionMakerRole: prospect.decisionMakerRole,
    decisionMakerEmail: prospect.decisionMakerEmail,
    decisionMakerPhone: prospect.decisionMakerPhone,
    decisionMakerName: prospect.decisionMakerName,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    researchStatus: prospect.researchStatus,
    icpFitScore: prospect.icpFitScore,
    icpFitLabel: prospect.icpFitLabel,
    industry: prospect.industry,
    painScore: prospect.painScore,
    painType: prospect.painType,
    painSummary: prospect.painSummary,
    painEvidence: prospect.painEvidence,
    hiringSignal: prospect.hiringSignal,
    growthSignal: prospect.growthSignal,
    manualProcessSignal: prospect.manualProcessSignal,
    digitalWeaknessSignal: prospect.digitalWeaknessSignal,
    personalizationAngle: prospect.personalizationAngle,
    researchSources: prospect.researchSources,
    researchedAt: prospect.researchedAt?.toISOString() ?? null,
    lastResearchError: prospect.lastResearchError,
    lastResearchErrorCode: prospect.lastResearchErrorCode,
    lastResearchAt: prospect.lastResearchAt?.toISOString() ?? null,
    failedStep: prospect.failedStep,
    sourceUrl: prospect.sourceUrl,
    lastAttemptAt: prospect.lastAttemptAt?.toISOString() ?? null,
    lastSuccessfulResearchAt: prospect.lastSuccessfulResearchAt?.toISOString() ?? null,
    companyDescription: prospect.companyDescription,
    services: prospect.services,
    companySizeLabel: prospect.companySizeLabel,
    employeeCountEstimate: prospect.employeeCountEstimate,
    locationsCount: prospect.locationsCount,
    fleetSizeEstimate: prospect.fleetSizeEstimate,
    specialization: prospect.specialization,
    targetCustomers: prospect.targetCustomers,
    companyProfileSummary: prospect.companyProfileSummary
  };
}

export function classifyResearchFailure(error: unknown): ResearchFailure {
  const message = error instanceof Error ? error.message : "Research fehlgeschlagen";
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const failedStep = isResearchFailedStep(details.failedStep) ? details.failedStep : "analysis";
  const sourceUrl = typeof details.sourceUrl === "string" ? details.sourceUrl : null;
  const explicitCode = typeof details.code === "string" ? details.code : "";
  if (/keine website|website url fehlt/i.test(message)) {
    return { status: "no_website", code: "NO_WEBSITE", message: "Keine Website vorhanden", failedStep: "website_fetch", sourceUrl };
  }
  if (/cookie-banner|cookie banner|consent/i.test(message)) {
    return { status: "cookie_banner_blocked", code: "COOKIE_BANNER_BLOCKED", message, failedStep: "crawler", sourceUrl };
  }
  if (explicitCode === "AI_TIMEOUT" || /KI-Auswertung dauerte zu lange/i.test(message)) {
    return { status: "partial", code: "AI_TIMEOUT", message: "KI-Auswertung dauerte zu lange", failedStep: "ai_analysis", sourceUrl };
  }
  if (explicitCode === "BOT_PROTECTION" || /bot-schutz|HTTP 403|HTTP 429/i.test(message)) {
    return { status: "website_unreachable", code: "BOT_PROTECTION", message: "Bot-Schutz blockiert Website-Abruf", failedStep, sourceUrl };
  }
  if (explicitCode === "DNS_ERROR" || /enotfound|eai_again|getaddrinfo|dns/i.test(message)) {
    return { status: "website_unreachable", code: "DNS_ERROR", message: "DNS Fehler beim Abrufen der Website", failedStep, sourceUrl };
  }
  if (explicitCode === "SSL_ERROR" || /certificate|ssl|tls|cert/i.test(message)) {
    return { status: "website_unreachable", code: "SSL_ERROR", message: "SSL Fehler beim Abrufen der Website", failedStep, sourceUrl };
  }
  if (explicitCode === "PAGE_TOO_SLOW" || /timeout|abbruch|aborted|timed out/i.test(message)) {
    return { status: "website_unreachable", code: "PAGE_TOO_SLOW", message: failedStep === "contact_fetch" ? "Timeout beim Abrufen von Kontakt/Impressum" : "Timeout beim Abrufen der Website", failedStep, sourceUrl };
  }
  if (explicitCode === "CRAWLER_TIMEOUT" || /crawler timeout/i.test(message)) {
    return { status: "website_unreachable", code: "CRAWLER_TIMEOUT", message: "Crawler Timeout", failedStep: "crawler", sourceUrl };
  }
  if (explicitCode === "NO_USABLE_DATA" || /keine verwertbaren daten/i.test(message)) {
    return { status: "failed", code: "NO_USABLE_DATA", message: "Keine verwertbaren Daten gefunden", failedStep: "analysis", sourceUrl };
  }
  if (/fetch failed|econnrefused|econnreset|http 4|http 5|website nicht erreichbar/i.test(message)) {
    return { status: "website_unreachable", code: "WEBSITE_UNREACHABLE", message: message || "Website nicht erreichbar", failedStep, sourceUrl };
  }
  return { status: "failed", code: "RESEARCH_FAILED", message, failedStep, sourceUrl };
}

function isResearchFailedStep(value: unknown): value is ResearchFailure["failedStep"] {
  return value === "website_fetch" || value === "contact_fetch" || value === "crawler" || value === "ai_analysis" || value === "analysis";
}

async function scrapeWebsite(websiteUrl: string, fetcher: typeof fetch): Promise<PageText[]> {
  const base = normalizeBaseUrl(websiteUrl);
  const urls = Array.from(new Set(researchPaths.map((path) => new URL(path, base).toString()))).slice(0, 10);
  const pages: PageText[] = [];
  for (const url of urls) {
    pages.push(await fetchPageText(url, fetcher));
  }
  if (pages.some((page) => page.ok && page.text.trim())) return pages;
  const reducedUrls = Array.from(new Set(["/", "/kontakt", "/impressum"].map((path) => new URL(path, base).toString())));
  return Promise.all(reducedUrls.map((url) => fetchPageText(url, fetcher)));
}

async function fetchPageText(url: string, fetcher: typeof fetch): Promise<PageText> {
  try {
    const response = await fetcher(url, {
      headers: { "User-Agent": "TasklyticLeadResearch/1.0" },
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      const message = response.status === 403 || response.status === 429 ? "Bot-Schutz blockiert Website-Abruf" : `Website nicht erreichbar: HTTP ${response.status}`;
      return { url, ok: false, text: "", error: message };
    }
    const html = await response.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    return { url, ok: true, title: cleanText(title ?? ""), text: htmlToText(html).slice(0, 12000) };
  } catch (error) {
    return { url, ok: false, text: "", error: researchFetchErrorMessage(error, url) };
  }
}

function researchFetchErrorMessage(error: unknown, url: string) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/AbortError|aborted|timeout|timed out|signal/i.test(message)) return /kontakt|impressum/i.test(url) ? "Timeout beim Abrufen von Kontakt/Impressum" : "Timeout beim Abrufen der Website";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|DNS/i.test(message)) return "DNS Fehler beim Abrufen der Website";
  if (/certificate|SSL|TLS|ERR_TLS|UNABLE_TO_VERIFY|CERT/i.test(message)) return "SSL Fehler beim Abrufen der Website";
  if (/ECONNREFUSED|ECONNRESET|fetch failed|network/i.test(message)) return "Website nicht erreichbar";
  return message || "Abruf fehlgeschlagen";
}

function analyzeHeuristically(prospect: Prospect, pages: PageText[], targetGroup: TargetGroupLike, offerContext: string): LeadResearchResult {
  const rawText = pages.map((page) => page.text).join("\n");
  const combinedText = rawText.toLowerCase();
  const contact = extractContact(pages);
  const targetIndustryKeywords = [...new Set([...logisticsKeywords, ...targetGroup.industryKeywords.map((item) => item.toLowerCase())])];
  const targetPainKeywords = [...new Set([...hiringKeywords, ...targetGroup.painKeywords.map((item) => item.toLowerCase())])];
  const evidence = [
    ...keywordEvidence(pages, "industry", targetIndustryKeywords),
    ...keywordEvidence(pages, "hiring", targetPainKeywords),
    ...keywordEvidence(pages, "growth", growthKeywords),
    ...keywordEvidence(pages, "manual_process", manualKeywords),
    ...keywordEvidence(pages, "digital_weakness", digitalWeaknessKeywords)
  ];
  const hasWebsite = pages.some((page) => page.ok);
  const hasLogistics = evidence.some((item) => item.type === "industry");
  const hasHiring = evidence.some((item) => item.type === "hiring");
  const hasGrowth = evidence.some((item) => item.type === "growth");
  const hasManual = evidence.some((item) => item.type === "manual_process");
  const hasDigitalWeakness = evidence.some((item) => item.type === "digital_weakness");
  const services = serviceKeywords.filter((keyword) => combinedText.includes(keyword));
  const employeeCountEstimate = extractNumberWithContext(combinedText, ["mitarbeiter", "beschäftigte", "beschaeftigte", "team", "kollegen"]);
  const fleetSizeEstimate = extractNumberWithContext(combinedText, ["fahrzeuge", "lkw", "fuhrpark", "trailer"]);
  const locationsCount = extractNumberWithContext(combinedText, ["standorte", "niederlassungen", "filialen"]);
  const employeeForScoring = prospect.employeeCount ?? employeeCountEstimate;
  const icpFitScore = clamp(
    (hasLogistics ? 40 : 0) +
    (hasWebsite ? 10 : 0) +
    (hasHiring ? 15 : 0) +
    ((prospect.city || locationsCount) ? 5 : 0) +
    (employeeForScoring && employeeForScoring >= 5 && employeeForScoring <= 100 ? 20 : 0) +
    ((prospect.decisionMakerEmail || prospect.companyEmail) ? 10 : 0)
  );
  const painScore = clamp(
    (hasHiring ? 30 : 0) +
    (hasManual ? 25 : 0) +
    (hasDigitalWeakness ? 20 : 0) +
    (hasLogistics ? 10 : 0)
  );
  const painType = inferPainType(hasLogistics, hasHiring, hasManual, hasDigitalWeakness);
  const industry = hasLogistics ? targetGroup.name : detectIndustry(combinedText);
  const companySizeLabel = classifyCompanySize(employeeCountEstimate, fleetSizeEstimate, locationsCount);

  return {
    researchStatus: hasWebsite ? "completed" : "failed",
    phone: contact.companyPhone,
    companyPhone: contact.companyPhone,
    companyEmail: contact.companyEmail,
    contactPageUrl: contact.contactPageUrl,
    street: contact.street,
    postalCode: contact.postalCode,
    city: contact.city,
    country: contact.country,
    generalContactLabel: contact.generalContactLabel,
    linkedinUrl: contact.linkedinUrl,
    decisionMakerRole: contact.decisionMakerRole,
    decisionMakerEmail: contact.decisionMakerEmail,
    decisionMakerPhone: contact.decisionMakerPhone,
    decisionMakerName: contact.decisionMakerName,
    firstName: contact.firstName,
    lastName: contact.lastName,
    icpFitScore,
    icpFitLabel: scoreLabel(icpFitScore),
    industry,
    painScore,
    painType,
    painSummary: summarizePain(painType),
    painEvidence: evidence,
    hiringSignal: hasHiring,
    growthSignal: hasGrowth,
    manualProcessSignal: hasManual,
    digitalWeaknessSignal: hasDigitalWeakness,
    personalizationAngle: buildPersonalizationAngle(painType, industry, offerContext),
    researchSources: pages.map(({ url, ok, title, error }) => ({ url, ok, title, error })),
    researchedAt: new Date(),
    companyDescription: inferCompanyDescription(prospect, pages, industry, services),
    services,
    companySizeLabel,
    employeeCountEstimate,
    locationsCount,
    fleetSizeEstimate,
    specialization: inferSpecialization(services),
    targetCustomers: inferTargetCustomers(combinedText),
    companyProfileSummary: buildProfileSummary(industry, services, employeeCountEstimate, fleetSizeEstimate, locationsCount),
    suggestedOfferId: null
  };
}

async function analyzeWithOpenAiIfAvailable(pages: PageText[], heuristic: LeadResearchResult, targetGroup: TargetGroupLike, offerContext: string) {
  const apiKey = await getEffectiveOpenAiApiKey();
  if (!apiKey) return null;
  const text = pages.filter((page) => page.ok).map((page) => `URL: ${page.url}\n${page.text}`).join("\n\n").slice(0, 30000);
  if (!text.trim()) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Analysiere Website-Text für B2B Lead Research. Erfinde keine Fakten. Unsichere Aussagen als Hypothese formulieren. Ignoriere Cookie-, Datenschutz-, Tracking-, Navigations- und Footertexte vollständig. Wenn keine echte Beschreibung der Firma erkennbar ist, setze companyDescription auf null. painType darf nie hiring sein; hiring ist nur ein Signal. Antworte nur als JSON."
        },
        {
          role: "user",
          content: `Du analysierst einen Prospect fuer ein Unternehmen mit diesem Angebot.\n${offerContext}\n\nProspect-Zielgruppe:\n${targetGroupContextText(targetGroup)}\n\nBestehende Heuristik: ${JSON.stringify(heuristic)}\n\nWebsite-Text:\n${text}\n\nBewerte ICP-Fit, Pain und Personalisierungswinkel ausschliesslich relativ zum Offer-Kontext. Keine Fakten erfinden, nur Website-Informationen verwenden. Bei Unsicherheit als Hypothese formulieren. Ignoriere Cookie-, Datenschutz-, Tracking-, Navigations- und Footertexte vollstaendig. companyDescription/companyProfileSummary duerfen nur beschreiben, was das Unternehmen tatsaechlich macht. Wenn keine echte Firmenbeschreibung erkennbar ist, setze companyDescription auf null und companyProfileSummary auf "Nicht gefunden". employeeCountEstimate, locationsCount und fleetSizeEstimate nur setzen, wenn die Zahl direkt mit Mitarbeiter/Beschaeftigte/Team/Kollegen, Standorte/Niederlassungen/Filialen oder Fahrzeuge/LKW/Fuhrpark/Trailer im Text steht. painType darf nie "hiring" sein. Hiring nur als hiringSignal ausgeben; painSummary vorsichtig als Hypothese formulieren und keine harten Problembehauptungen nutzen. Gib exakt JSON mit diesen Feldern zurueck: companyDescription, companyProfileSummary, industry, services, companySizeLabel, employeeCountEstimate, locationsCount, fleetSizeEstimate, specialization, targetCustomers, painType, painSummary, painEvidence, hiringSignal, growthSignal, manualProcessSignal, digitalWeaknessSignal, icpFitScore, icpFitLabel, painScore.`
        }
      ]
    })
  });
  if (!response.ok) return null;
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  return JSON.parse(content) as Partial<LeadResearchResult>;
}

function withoutEmptyOpenAiValues(value: Partial<LeadResearchResult> | null) {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== "" && entry !== null && entry !== undefined));
}

function sanitizeOpenAiResult(value: Partial<LeadResearchResult> | null, pages: PageText[]) {
  const sanitized = withoutEmptyOpenAiValues(value) as Partial<LeadResearchResult>;
  if ("companyDescription" in sanitized && !isValidCompanyDescription(sanitized.companyDescription ?? null)) {
    sanitized.companyDescription = null;
  }
  if ("companyProfileSummary" in sanitized && isBoilerplateText(sanitized.companyProfileSummary ?? "")) {
    sanitized.companyProfileSummary = "Nicht gefunden";
  }
  if (sanitized.painType === "hiring") {
    sanitized.painType = inferPainType(Boolean(sanitized.industry), sanitized.hiringSignal === true, sanitized.manualProcessSignal === true, sanitized.digitalWeaknessSignal === true);
    sanitized.painSummary = summarizePain(sanitized.painType ?? null);
  }
  const text = pages.map((page) => page.text).join("\n").toLowerCase();
  if ("employeeCountEstimate" in sanitized) {
    sanitized.employeeCountEstimate = validateContextNumber(sanitized.employeeCountEstimate, text, ["mitarbeiter", "beschäftigte", "beschaeftigte", "team", "kollegen"]);
  }
  if ("locationsCount" in sanitized) {
    sanitized.locationsCount = validateContextNumber(sanitized.locationsCount, text, ["standorte", "niederlassungen", "filialen"]);
  }
  if ("fleetSizeEstimate" in sanitized) {
    sanitized.fleetSizeEstimate = validateContextNumber(sanitized.fleetSizeEstimate, text, ["fahrzeuge", "lkw", "fuhrpark", "trailer"]);
  }
  return sanitized;
}

function normalizeResearchResult(value: LeadResearchResult): LeadResearchResult {
  const icpFitScore = clamp(value.icpFitScore);
  const painScore = clamp(value.painScore);
  return {
    ...value,
    icpFitScore,
    icpFitLabel: scoreLabel(icpFitScore),
    painScore,
    services: Array.isArray(value.services) ? value.services.filter(Boolean) : [],
    painEvidence: Array.isArray(value.painEvidence) ? value.painEvidence : [],
    researchSources: Array.isArray(value.researchSources) ? value.researchSources : [],
    companyDescription: isValidCompanyDescription(value.companyDescription) ? value.companyDescription : null,
    companyProfileSummary: value.companyDescription || !isBoilerplateText(value.companyProfileSummary ?? "") ? value.companyProfileSummary ?? "Nicht gefunden" : "Nicht gefunden",
    painType: isInvalidPainType(value.painType) ? "Kein klarer Schmerzpunkt erkannt" : value.painType,
    painSummary: containsForbiddenPainClaim(value.painSummary) ? summarizePain(value.painType) : value.painSummary,
    companySizeLabel: ["small", "medium", "large"].includes(value.companySizeLabel) ? value.companySizeLabel : "unknown",
    researchedAt: value.researchedAt ? new Date(value.researchedAt) : new Date()
  };
}

function normalizeBaseUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function htmlToText(html: string) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*(?:cookie|consent|privacy|datenschutz|newsletter|login|search|suche|warenkorb)[^>]*>[\s\S]*?<\/[^>]+>/gi, " ")
      .replace(/\s(?:href|content)=["']([^"']+)["']/gi, " $1 ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&uuml;/g, "ü")
      .replace(/&auml;/g, "ä")
      .replace(/&ouml;/g, "ö")
      .replace(/&Uuml;/g, "Ü")
      .replace(/&Auml;/g, "Ä")
      .replace(/&Ouml;/g, "Ö")
      .replace(/&szlig;/g, "ß")
  );
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function fillText(data: Prisma.ProspectUncheckedUpdateInput, updatedFields: string[], field: keyof Prospect, current: unknown, next: unknown) {
  if (isBlank(current) && typeof next === "string" && next.trim()) {
    (data as Record<string, unknown>)[field] = next.trim();
    updatedFields.push(String(field));
  }
}

function fillReplaceableText(data: Prisma.ProspectUncheckedUpdateInput, updatedFields: string[], field: keyof Prospect, current: unknown, next: unknown, invalid: (value: string) => boolean) {
  const currentInvalid = typeof current === "string" && current.trim() && invalid(current);
  if (currentInvalid) {
    (data as Record<string, unknown>)[field] = null;
    updatedFields.push(String(field));
  }
  if ((isBlank(current) || currentInvalid) && typeof next === "string" && next.trim()) {
    (data as Record<string, unknown>)[field] = next.trim();
    if (!updatedFields.includes(String(field))) updatedFields.push(String(field));
  }
}

function fillPersonText(data: Prisma.ProspectUncheckedUpdateInput, updatedFields: string[], field: "decisionMakerName" | "firstName" | "lastName", current: unknown, next: unknown) {
  const currentIsInvalid = typeof current === "string" && current.trim() && !isValidPersonField(field, current);
  if (currentIsInvalid) {
    (data as Record<string, unknown>)[field] = null;
    updatedFields.push(String(field));
  }
  if ((isBlank(current) || currentIsInvalid) && typeof next === "string" && next.trim()) {
    (data as Record<string, unknown>)[field] = next.trim();
    if (!updatedFields.includes(String(field))) updatedFields.push(String(field));
  }
}

function fillNumber(data: Prisma.ProspectUncheckedUpdateInput, updatedFields: string[], field: keyof Prospect, current: unknown, next: unknown) {
  if ((current === null || current === undefined || current === 0) && typeof next === "number" && Number.isFinite(next) && next > 0) {
    (data as Record<string, unknown>)[field] = Math.round(next);
    updatedFields.push(String(field));
  }
}

function fillReplaceableNumber(data: Prisma.ProspectUncheckedUpdateInput, updatedFields: string[], field: keyof Prospect, current: unknown, next: unknown) {
  if (typeof next === "number" && Number.isFinite(next) && next > 0) {
    fillNumber(data, updatedFields, field, current, next);
    return;
  }
  if (typeof current === "number" && Number.isFinite(current) && current > 0) {
    (data as Record<string, unknown>)[field] = null;
    updatedFields.push(String(field));
  }
}

function fillBoolean(data: Prisma.ProspectUncheckedUpdateInput, updatedFields: string[], field: keyof Prospect, current: unknown, next: unknown) {
  if (current !== true && next === true) {
    (data as Record<string, unknown>)[field] = true;
    updatedFields.push(String(field));
  }
}

function fillCountry(data: Prisma.ProspectUncheckedUpdateInput, updatedFields: string[], current: unknown, next: unknown) {
  if (typeof next !== "string" || !next.trim()) return;
  if (isBlank(current) || current === "DE") {
    data.country = next.trim();
    updatedFields.push("country");
  }
}

function isBlank(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function isEmptyJsonArray(value: unknown) {
  return value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

function extractContact(pages: PageText[]) {
  const contactPages = pages.filter((page) => page.ok && isPrioritizedContactPage(page.url));
  const text = (contactPages.length ? contactPages : pages.filter((page) => page.ok)).map((page) => page.text).join("\n");
  const companyEmail = extractCompanyEmail(text);
  const companyPhone = text.match(/(?:\+49|0049|0)\s?(?:\(?\d{2,5}\)?[\s./-]?){2,8}\d/i)?.[0]?.trim() ?? null;
  const linkedinUrl = text.match(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^\s"'<>]+/i)?.[0]?.replace(/[).,;]+$/, "") ?? null;
  const decisionMaker = extractDecisionMaker(pages);
  const decisionMakerName = decisionMaker?.name ?? null;
  const [firstName, ...rest] = decisionMakerName?.split(/\s+/) ?? [];
  const address = extractAddress(text);
  return {
    companyEmail,
    companyPhone,
    contactPageUrl: pages.find((page) => page.ok && isPrioritizedContactPage(page.url))?.url ?? null,
    ...address,
    generalContactLabel: companyEmail || companyPhone ? "Allgemeiner Firmenkontakt" : null,
    linkedinUrl,
    decisionMakerRole: decisionMaker?.role ?? null,
    decisionMakerEmail: decisionMaker?.email ?? null,
    decisionMakerPhone: decisionMaker?.phone ?? null,
    decisionMakerName,
    firstName: decisionMakerName && firstName.length >= 2 ? firstName : null,
    lastName: decisionMakerName && rest.join(" ").length >= 2 ? rest.join(" ") : null
  };
}

function extractAddress(text: string) {
  const normalized = cleanText(text);
  const match = normalized.match(/\b([A-ZÄÖÜ][\wäöüÄÖÜß .'-]{2,60}(?:straße|strasse|str\.|weg|allee|ring|platz|gasse|damm|ufer)\s+\d+[a-zA-Z]?(?:\s?[-–]\s?\d+[a-zA-Z]?)?)\s*,?\s*(?:D[-\s])?(\d{5})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß .'-]{2,50})\b/);
  if (!match) {
    return { street: null, postalCode: null, city: null, country: null };
  }
  return {
    street: normalizeStreet(cleanText(match[1])),
    postalCode: match[2],
    city: cleanText(match[3]).replace(/\bDeutschland\b.*$/i, "").trim(),
    country: /deutschland|germany/i.test(normalized) ? "Deutschland" : "Deutschland"
  };
}

function normalizeStreet(value: string) {
  const compact = value.match(/\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]*(?:straße|strasse|str\.)\s+\d+[a-zA-Z]?(?:\s?[-–]\s?\d+[a-zA-Z]?)?)\b/);
  if (compact?.[1]) return cleanText(compact[1]);
  const streetMatches = Array.from(value.matchAll(/[A-ZÄÖÜ][\wäöüÄÖÜß .'-]{2,60}(?:weg|allee|ring|platz|gasse|damm|ufer)\s+\d+[a-zA-Z]?(?:\s?[-–]\s?\d+[a-zA-Z]?)?/g));
  return cleanText(streetMatches.at(-1)?.[0] ?? value);
}

function extractCompanyEmail(text: string) {
  const emails = Array.from(text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi), (match) => match[0].replace(/[).,;:]+$/, ""));
  return emails.find((email) => isGeneralEmail(email)) ?? emails[0] ?? null;
}

function extractDecisionMaker(pages: PageText[]) {
  const prioritizedPages = [...pages].sort((a, b) => contactPagePriority(a.url) - contactPagePriority(b.url));
  for (const page of prioritizedPages) {
    const normalized = cleanText(page.text);
    const lower = normalized.toLowerCase();
    for (const role of decisionMakerRoles) {
      let index = lower.indexOf(role);
      while (index >= 0) {
        const context = normalized.slice(Math.max(0, index - 140), Math.min(normalized.length, index + role.length + 180));
        const roleIndexInContext = context.toLowerCase().indexOf(role);
        const name = extractPersonNameFromContext(roleIndexInContext >= 0 ? context.slice(roleIndexInContext + role.length) : context) ?? extractPersonNameFromContext(context);
        if (name) {
          return {
            name,
            role: formatDecisionMakerRole(role),
            email: extractPersonalEmailNearName(context, name),
            phone: extractPhoneNearName(context, name)
          };
        }
        index = lower.indexOf(role, index + role.length);
      }
    }
  }
  return null;
}

function extractPersonNameFromContext(context: string) {
  const namePattern = /(?:\b(?:Herr|Frau|Dr\.|Prof\.)\s+)?\b([A-ZÄÖÜ][a-zäöüß-]{2,}(?:\s+[A-ZÄÖÜ][a-zäöüß-]{2,}){1,2})\b/g;
  for (const match of context.matchAll(namePattern)) {
    const candidate = cleanText(match[1]);
    if (isValidPersonName(candidate)) return candidate;
  }
  return null;
}

function isValidPersonField(field: "decisionMakerName" | "firstName" | "lastName", value: string) {
  if (field === "decisionMakerName") return isValidPersonName(value);
  const normalized = normalizeForContactValidation(value);
  if (!normalized || forbiddenContactNameTerms.some((term) => normalized.includes(term))) return false;
  if (/\b(gmbh|kg|ag|spedition|logistik|transport|verwaltung|kontakt|anfahrt)\b/i.test(value)) return false;
  return /^[A-ZÄÖÜ][a-zäöüß-]{1,}(?:\s+[A-ZÄÖÜ][a-zäöüß-]{1,}){0,2}$/.test(value.trim());
}

function isValidPersonName(value: string) {
  const candidate = cleanText(value);
  const normalized = normalizeForContactValidation(candidate);
  const parts = candidate.split(/\s+/);
  if (parts.length < 2 || parts.length > 3) return false;
  if (forbiddenContactNameTerms.some((term) => normalized.includes(term))) return false;
  if (/\b(gmbh|kg|ag|spedition|logistik|transport|verwaltung|kontakt|anfahrt|team|kundenservice|zentrale|disposition|fuhrpark|geschäftsführer|geschaeftsfuehrer|geschäftsführung|geschaeftsfuehrung|inhaber|inhaberin|vorstand|leitung|ceo|managing director)\b/i.test(candidate)) return false;
  return parts.every((part) => /^[A-ZÄÖÜ][a-zäöüß-]{1,}$/.test(part));
}

function normalizeForContactValidation(value: string) {
  return value.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

function isGeneralEmail(email: string) {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  return generalEmailPrefixes.some((prefix) => localPart === prefix || localPart.startsWith(`${prefix}.`) || localPart.startsWith(`${prefix}-`));
}

function extractPersonalEmailNearName(context: string, name: string) {
  const nameIndex = context.indexOf(name);
  const windowText = nameIndex >= 0 ? context.slice(Math.max(0, nameIndex - 90), nameIndex + name.length + 120) : context;
  const email = windowText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.replace(/[).,;:]+$/, "") ?? null;
  return email && !isGeneralEmail(email) ? email : null;
}

function extractPhoneNearName(context: string, name: string) {
  const nameIndex = context.indexOf(name);
  if (nameIndex < 0) return null;
  const windowText = context.slice(Math.max(0, nameIndex - 90), nameIndex + name.length + 120);
  return windowText.match(/(?:\+49|0049|0)\s?(?:\(?\d{2,5}\)?[\s./-]?){2,8}\d/i)?.[0]?.trim() ?? null;
}

function isPrioritizedContactPage(url: string) {
  return contactPagePriority(url) < 10;
}

function contactPagePriority(url: string) {
  const path = new URL(url).pathname.toLowerCase();
  if (path.includes("impressum")) return 0;
  if (path.includes("kontakt")) return 1;
  if (path.includes("ueber-uns") || path.includes("%c3%bcber-uns") || path.includes("über-uns")) return 2;
  if (path.includes("team")) return 3;
  return 10;
}

function formatDecisionMakerRole(role: string) {
  if (role === "geschaeftsfuehrer") return "Geschäftsführer";
  if (role === "geschaeftsfuehrung") return "Geschäftsführung";
  if (role === "ceo") return "CEO";
  if (role === "managing director") return "Managing Director";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function keywordEvidence(pages: PageText[], type: string, keywords: string[]) {
  return pages.flatMap((page) =>
    keywords
      .filter((keyword) => page.text.toLowerCase().includes(keyword))
      .map((keyword) => ({ type, keyword, source: page.url, excerpt: excerptAround(page.text, keyword) }))
  );
}

function extractNumberWithContext(text: string, anchors: string[]) {
  for (const anchor of anchors) {
    const direct = new RegExp(`\\b(\\d{1,4})\\s*(?:${anchor})\\b`, "i").exec(text);
    if (direct?.[1]) return Number(direct[1]);
    const before = new RegExp(`\\b(?:${anchor})\\b\\D{0,30}(\\d{1,4})`, "i").exec(text);
    if (before?.[1]) return Number(before[1]);
  }
  return null;
}

function validateContextNumber(value: unknown, text: string, anchors: string[]) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return anchors.some((anchor) => new RegExp(`(?:\\b${Math.round(value)}\\b\\D{0,30}\\b${anchor}\\b|\\b${anchor}\\b\\D{0,30}\\b${Math.round(value)}\\b)`, "i").test(text))
    ? Math.round(value)
    : null;
}

function detectIndustry(text: string) {
  if (text.includes("bau")) return "Bau";
  if (text.includes("handel")) return "Handel";
  return null;
}

function classifyCompanySize(employeeCount: number | null, fleetSize: number | null, locationsCount: number | null): "unknown" | "small" | "medium" | "large" {
  const signal = employeeCount ?? fleetSize ?? null;
  if (signal === null && !locationsCount) return "unknown";
  if ((signal ?? 0) >= 250 || (locationsCount ?? 0) >= 10) return "large";
  if ((signal ?? 0) >= 50 || (locationsCount ?? 0) >= 3) return "medium";
  return "small";
}

function inferPainType(hasLogistics: boolean, hasHiring: boolean, hasManual: boolean, hasDigitalWeakness: boolean) {
  if (hasHiring && hasLogistics) return "Operative Belastung durch Personalbedarf";
  if (hasDigitalWeakness || hasManual) return "Manuelle Anfrage- und Kommunikationsprozesse";
  if (hasLogistics) return "Manuelle Abstimmung im Tagesgeschäft";
  return "Kein klarer Schmerzpunkt erkannt";
}

function summarizePain(type: string | null) {
  if (type === "Operative Belastung durch Personalbedarf") return "Die Website zeigt Hinweise auf Personalbedarf. Bei Logistikunternehmen kann das zusätzlichen Druck auf Disposition, Kommunikation und Backoffice erzeugen. Das ist eine Hypothese und sollte in der Ansprache vorsichtig formuliert werden.";
  if (type === "Manuelle Abstimmung im Tagesgeschäft") return "Das Unternehmen passt zur Logistik-Zielgruppe. Ein möglicher Ansatzpunkt sind manuelle Abstimmungen zwischen Auftragseingang, Disposition, Fahrern und Verwaltung. Konkrete Prozessprobleme wurden auf der Website nicht eindeutig erkannt.";
  if (type === "Manuelle Anfrage- und Kommunikationsprozesse") return "Es gibt Hinweise auf manuelle Anfrage- oder Kommunikationsprozesse. Das könnte auf Potenzial für schnellere Abstimmung und sauberere Übergaben hindeuten.";
  return "Es wurden keine eindeutigen Schmerzpunkte erkannt. Die Ansprache sollte neutral und hypothesenbasiert bleiben.";
}

function buildPersonalizationAngle(painType: string | null, industry: string | null, offerContext: string) {
  const offerHint = offerContext.split("\n").find((line) => line.startsWith("Dienstleistung:"))?.replace("Dienstleistung:", "").trim();
  if (painType === "Operative Belastung durch Personalbedarf") return `Vorsichtige Ansprache: Falls Personalbedarf operative Abstimmung belastet${offerHint ? `, kann ${offerHint} entlasten` : ""}.`;
  if (painType === "Manuelle Anfrage- und Kommunikationsprozesse" || painType === "Manuelle Abstimmung im Tagesgeschäft") return `Vorsichtige Ansprache: Wenn viel ueber Telefon, Mail und Dispo laeuft${offerHint ? `, kann ${offerHint} helfen` : ""}.`;
  if (industry) return `Ansprache mit Bezug auf ${industry}${offerHint ? ` und Relevanz von ${offerHint}` : ""}.`;
  return null;
}

function inferCompanyDescription(prospect: Prospect, pages: PageText[], industry: string | null, services: string[]) {
  const validServices = normalizeServices(services);
  if (validServices.length >= 2 || industry) {
    const serviceText = validServices.length ? ` mit Leistungen in ${humanList(validServices.slice(0, 7))}` : "";
    const industryText = /logistik|spedition|transport/i.test([industry, ...validServices].join(" "))
      ? "ein Logistik- und Speditionsunternehmen"
      : `ein Unternehmen im Bereich ${industry ?? validServices[0]}`;
    return `${prospect.companyName} ist ${industryText}${serviceText}.`;
  }

  const prioritizedText = [...pages]
    .filter((page) => page.ok && descriptionPagePriority(page.url) < 90)
    .sort((a, b) => descriptionPagePriority(a.url) - descriptionPagePriority(b.url))
    .map((page) => page.text)
    .join("\n");
  const sentences = prioritizedText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanText(sentence))
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 280 && !isBoilerplateText(sentence));
  const descriptive = sentences.find((sentence) =>
    isValidCompanyDescription(sentence) && /wir sind|wir bieten|leistungen|spedition|transport|logistik|unternehmen|kunden|service|fuhrpark/i.test(sentence)
  );
  if (descriptive) return descriptive;
  if (!industry && validServices.length === 0) return null;
  const fallback = `${prospect.companyName} ist im Bereich ${industry ?? "B2B"} tätig${validServices.length ? ` mit Leistungen wie ${validServices.slice(0, 3).join(", ")}` : ""}.`;
  return isValidCompanyDescription(fallback) ? fallback : null;
}

function descriptionPagePriority(url: string) {
  const path = new URL(url).pathname.toLowerCase();
  if (path.includes("ueber") || path.includes("%c3%bcber") || path.includes("über") || path.includes("unternehmen") || path.includes("portrait")) return 0;
  if (path.includes("leistungen") || path.includes("logistik") || path.includes("transport")) return 1;
  if (path === "/" || path === "") return 2;
  if (path.includes("impressum") || path.includes("kontakt") || path.includes("datenschutz")) return 99;
  return 10;
}

function isValidCompanyDescription(value: string | null | undefined) {
  const text = cleanText(value ?? "");
  if (text.length < 40) return false;
  if (isBoilerplateText(text)) return false;
  return companyDescriptionTerms.some((term) => text.toLowerCase().includes(term));
}

function normalizeServices(services: string[]) {
  const aliases: Record<string, string> = {
    strasse: "Transport",
    "straße": "Transport",
    schiene: "Schiene",
    luft: "Luftfracht",
    see: "Seefracht",
    zoll: "Zoll",
    digital: "digitale Services",
    "digitale services": "digitale Services",
    logistik: "Logistik",
    transport: "Transport"
  };
  return [...new Set(services.map((service) => aliases[service.toLowerCase()] ?? service).filter(Boolean))];
}

function humanList(values: string[]) {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} und ${values[values.length - 1]}`;
}

function isBoilerplateText(value: string) {
  const lower = value.toLowerCase();
  return boilerplateTerms.some((term) => lower.includes(term));
}

function isInvalidPainType(value: string | null | undefined) {
  return !value || value.toLowerCase() === "hiring";
}

function containsForbiddenPainClaim(value: string | null | undefined) {
  return /das unternehmen hat probleme|die firma leidet unter|es gibt chaos/i.test(value ?? "");
}

function excerptAround(text: string, keyword: string) {
  const index = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (index < 0) return undefined;
  return cleanText(text.slice(Math.max(0, index - 70), Math.min(text.length, index + keyword.length + 90)));
}

function inferSpecialization(services: string[]) {
  return services.length ? services.slice(0, 3).join(", ") : null;
}

function inferTargetCustomers(text: string) {
  if (text.includes("industrie")) return "Industriekunden";
  if (text.includes("handel")) return "Handel und Gewerbe";
  return null;
}

function buildProfileSummary(industry: string | null, services: string[], employeeCount: number | null, fleetSize: number | null, locationsCount: number | null) {
  const parts = [
    industry ? `Branche: ${industry}` : null,
    services.length ? `Leistungen: ${services.slice(0, 4).join(", ")}` : null,
    employeeCount ? `Mitarbeiter-Hinweis: ${employeeCount}` : null,
    fleetSize ? `Fuhrpark-Hinweis: ${fleetSize}` : null,
    locationsCount ? `Standort-Hinweis: ${locationsCount}` : null
  ].filter(Boolean);
  return parts.length ? parts.join(". ") : "Nicht gefunden";
}

function scoreLabel(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}
