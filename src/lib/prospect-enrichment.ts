import type { Prisma, Prospect } from "@prisma/client";
import { z } from "zod";
import { getEffectiveOpenAiApiKey } from "@/lib/integrations";
import { classifyResearchFailure } from "@/lib/lead-research";
import { prisma } from "@/lib/prisma";
import { requireOfferForProspect, userOfferContextText } from "@/lib/user-offer";

export type EnrichmentSource = {
  url: string;
  reason: string;
  field?: string;
  snippet?: string;
  confidence?: number;
};

export type EnrichmentSuggestions = {
  companyName?: string | null;
  legalName?: string | null;
  websiteUrl?: string | null;
  industry?: string | null;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  phone?: string | null;
  companyEmail?: string | null;
  employeeCount?: number | null;
  businessFields?: string[];
  employeeRange?: string | null;
  vehicleCount?: number | null;
  trailerCount?: number | null;
  locationsCount?: number | null;
  isFamilyOwned?: boolean | null;
  decisionMakerName?: string | null;
  decisionMakerRole?: string | null;
  decisionMakerEmail?: string | null;
  decisionMakerPhone?: string | null;
  linkedinUrl?: string | null;
  fleetSignalText?: string | null;
  locationSignalText?: string | null;
  contactStructureSignalText?: string | null;
  websiteMaturitySignal?: string | null;
  customPainPoint?: string | null;
  painSummary?: string | null;
  painType?: string | null;
  icpScore?: number | null;
  icpFitScore?: number | null;
  suggestedOfferId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  confidence: number;
  sources: EnrichmentSource[];
  message?: string;
};

export type EnrichmentFieldSuggestion = {
  value: string | number | boolean | string[];
  source: string;
  confidence: number;
};

export type StructuredEnrichmentSuggestions = Record<string, EnrichmentFieldSuggestion>;

export type PageFetchResult = {
  url: string;
  title?: string | null;
  metaDescription?: string | null;
  text: string;
  html?: string;
  ok?: boolean;
  httpStatus?: number | null;
  fetchMethod?: "HEAD" | "GET" | "BROWSER";
  attempt?: number;
  finalUrl?: string | null;
  error?: string;
  errorCode?: ResearchErrorCode;
  failedStep?: ResearchFailedStep;
  cookieBannerDetected?: boolean;
  cookieBannerAction?: string | null;
  cookieBlocked?: boolean;
  privacySource?: boolean;
};

type ResearchErrorCode =
  | "WEBSITE_UNREACHABLE"
  | "DNS_ERROR"
  | "SSL_ERROR"
  | "COOKIE_BANNER_BLOCKED"
  | "PAGE_TOO_SLOW"
  | "BOT_PROTECTION"
  | "NO_USABLE_DATA"
  | "CRAWLER_TIMEOUT"
  | "AI_TIMEOUT"
  | "RESEARCH_FAILED";

type ResearchFailedStep = "website_fetch" | "contact_fetch" | "crawler" | "ai_analysis" | "analysis";

type FetchPublicPagesOptions = {
  reduced?: boolean;
  deadlineAt?: number;
  browserFallback?: boolean;
};

type ResearchFailureDetails = {
  message: string;
  code: ResearchErrorCode;
  failedStep: ResearchFailedStep;
  sourceUrl: string;
};

type BaseProbeResult = {
  url: URL;
  ok: boolean;
  status?: number | null;
  error?: ResearchFailureDetails;
};

type WebsiteMatchDecision = {
  url: string | null;
  originalUrl: string | null;
  candidateUrl: string | null;
  confidence: number;
  verified: boolean;
  source: string;
  reason: string;
  pages: PageFetchResult[];
  suspicious: boolean;
};

class EnrichmentStepError extends Error {
  code: ResearchErrorCode;
  failedStep: ResearchFailedStep;
  sourceUrl: string;

  constructor(details: ResearchFailureDetails) {
    super(details.message);
    this.name = "EnrichmentStepError";
    this.code = details.code;
    this.failedStep = details.failedStep;
    this.sourceUrl = details.sourceUrl;
  }
}

type FieldSource = {
  sourceUrl: string;
  extractedTextSnippet: string;
  confidence: number;
};

type ContactCandidate = {
  anrede: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  linkedinUrl: string | null;
  sourceUrl: string | null;
  sourceTextSnippet: string | null;
  sourceArea: string | null;
  foundAt: string;
  score: number;
  selectedAsPrimary?: boolean;
  confidence: number | null;
  confidenceLabel: "high" | "medium" | "low";
};

type RawExtraction = {
  emails: string[];
  phones: string[];
  contactCandidates: ContactCandidate[];
  contactPageUrls: string[];
  errors: Array<{ url: string; error: string }>;
};

type EnrichmentAnalysis = {
  contactPerson: {
    anrede: string | null;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    role: string | null;
    email?: string | null;
    phone?: string | null;
    personalEmail: string | null;
    personalPhone: string | null;
    linkedinUrl: string | null;
    sourceUrl?: string | null;
    sourceTextSnippet?: string | null;
    sourceArea?: string | null;
    confidence?: number | null;
  };
  contactCandidates: ContactCandidate[];
  companyContact: {
    generalEmail: string | null;
    generalPhone: string | null;
    contactPageUrl: string | null;
    websiteUrl: string | null;
  };
  company: {
    companyName: string | null;
    legalName: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    businessFields: string[];
    services: string[];
    specialization: string | null;
    locations: string | null;
    fleetEstimate: number | null;
    employeeEstimate: number | null;
    companyStatus: string | null;
  };
  companyProfile: {
    companySummary: string | null;
    whatTheyDo: string | null;
    industry: string | null;
    logisticsType: string | null;
    serviceAreas: string[];
    targetCustomers: string | null;
    operationalSignals: string[];
  };
  icpPain: {
    icpScore: number;
    icpLabel: "High" | "Medium" | "Low";
    painScore: number;
    painType: string | null;
    painSummary: string | null;
    painHypothesis: string | null;
    directPainSignal: string | null;
    inferredPainHypothesis: string | null;
    reasoning: string | null;
    campaignSuggestion: string | null;
  };
  sources: Record<string, FieldSource | undefined>;
  warnings: string[];
  confidence: number;
  message?: string;
};

const fieldSourceSchema = z.object({
  sourceUrl: z.string().url().catch(""),
  extractedTextSnippet: z.string().max(500).catch(""),
  confidence: z.number().min(0).max(1).catch(0)
});

const enrichmentAnalysisSchema = z.object({
  contactPerson: z.preprocess((value) => normalizeRawContactPerson(value), z.object({
    anrede: z.string().nullable().catch(null),
    firstName: z.string().nullable().catch(null),
    lastName: z.string().nullable().catch(null),
    fullName: z.string().nullable().catch(null),
    role: z.string().nullable().catch(null),
    email: z.string().nullable().optional().catch(null),
    phone: z.string().nullable().optional().catch(null),
    personalEmail: z.string().nullable().catch(null),
    personalPhone: z.string().nullable().catch(null),
    linkedinUrl: z.string().nullable().catch(null),
    sourceUrl: z.string().nullable().catch(null),
    sourceTextSnippet: z.string().nullable().optional().catch(null),
    sourceArea: z.string().nullable().optional().catch(null),
    confidence: z.number().min(0).max(1).nullable().catch(null)
  })).catch({ anrede: null, firstName: null, lastName: null, fullName: null, role: null, email: null, phone: null, personalEmail: null, personalPhone: null, linkedinUrl: null, sourceUrl: null, sourceTextSnippet: null, sourceArea: null, confidence: null }),
  contactCandidates: z.array(z.object({
    anrede: z.string().nullable().catch(null),
    firstName: z.string().nullable().catch(null),
    lastName: z.string().nullable().catch(null),
    fullName: z.string().nullable().catch(null),
    role: z.string().nullable().catch(null),
    email: z.string().nullable().catch(null),
    phone: z.string().nullable().catch(null),
    personalEmail: z.string().nullable().catch(null),
    personalPhone: z.string().nullable().catch(null),
    linkedinUrl: z.string().nullable().catch(null),
    sourceUrl: z.string().nullable().catch(null),
    sourceTextSnippet: z.string().nullable().catch(null),
    sourceArea: z.string().nullable().catch(null),
    foundAt: z.string().catch(() => new Date().toISOString()),
    score: z.number().catch(0),
    selectedAsPrimary: z.boolean().optional().catch(undefined),
    confidence: z.number().min(0).max(1).nullable().catch(null),
    confidenceLabel: z.enum(["high", "medium", "low"]).catch("medium")
  })).catch([]),
  companyContact: z.object({
    generalEmail: z.string().nullable().catch(null),
    generalPhone: z.string().nullable().catch(null),
    contactPageUrl: z.string().nullable().catch(null),
    websiteUrl: z.string().nullable().catch(null)
  }).catch({ generalEmail: null, generalPhone: null, contactPageUrl: null, websiteUrl: null }),
  company: z.object({
    companyName: z.string().nullable().catch(null),
    legalName: z.string().nullable().catch(null),
    street: z.string().nullable().catch(null),
    zip: z.string().nullable().catch(null),
    city: z.string().nullable().catch(null),
    state: z.string().nullable().catch(null),
    country: z.string().nullable().catch(null),
    businessFields: z.array(z.string()).catch([]),
    services: z.array(z.string()).catch([]),
    specialization: z.string().nullable().catch(null),
    locations: z.string().nullable().catch(null),
    fleetEstimate: z.number().int().positive().nullable().catch(null),
    employeeEstimate: z.number().int().positive().nullable().catch(null),
    companyStatus: z.string().nullable().catch(null)
  }).catch({ companyName: null, legalName: null, street: null, zip: null, city: null, state: null, country: null, businessFields: [], services: [], specialization: null, locations: null, fleetEstimate: null, employeeEstimate: null, companyStatus: null }),
  companyProfile: z.object({
    companySummary: z.string().nullable().catch(null),
    whatTheyDo: z.string().nullable().catch(null),
    industry: z.string().nullable().catch(null),
    logisticsType: z.string().nullable().catch(null),
    serviceAreas: z.array(z.string()).catch([]),
    targetCustomers: z.string().nullable().catch(null),
    operationalSignals: z.array(z.string()).catch([])
  }).catch({ companySummary: null, whatTheyDo: null, industry: null, logisticsType: null, serviceAreas: [], targetCustomers: null, operationalSignals: [] }),
  icpPain: z.object({
    icpScore: z.number().min(0).max(100).catch(0),
    icpLabel: z.enum(["High", "Medium", "Low"]).catch("Low"),
    painScore: z.number().min(0).max(100).catch(0),
    painType: z.string().nullable().catch(null),
    painSummary: z.string().nullable().catch(null),
    painHypothesis: z.string().nullable().catch(null),
    directPainSignal: z.string().nullable().catch(null),
    inferredPainHypothesis: z.string().nullable().catch(null),
    reasoning: z.string().nullable().catch(null),
    campaignSuggestion: z.string().nullable().catch(null)
  }).catch({ icpScore: 0, icpLabel: "Low", painScore: 0, painType: null, painSummary: null, painHypothesis: null, directPainSignal: null, inferredPainHypothesis: null, reasoning: null, campaignSuggestion: null }),
  sources: z.record(fieldSourceSchema.optional()).catch({}),
  warnings: z.array(z.string()).catch([]),
  confidence: z.number().min(0).max(100).catch(0),
  message: z.string().optional().catch(undefined)
});

const candidatePaths = [
  "/",
  "/kontakt",
  "/kontakt/",
  "/impressum",
  "/impressum/",
  "/team",
  "/ueber-uns",
  "/über-uns",
  "/unternehmen",
  "/ansprechpartner",
  "/kontaktpersonen",
  "/service",
  "/standorte",
  "/kontakt",
  "/contact",
  "/about",
  "/leistungen",
  "/services",
  "/service",
  "/logistik",
  "/transport",
  "/spedition",
  "/fuhrpark",
  "/fahrzeuge",
  "/karriere",
  "/jobs",
  "/stellenangebote"
];
const forcedContactPaths = ["/kontakt", "/kontakt/", "/impressum", "/impressum/"];
const priorityTerms = [
  "kontakt",
  "impressum",
  "team",
  "ansprechpartner",
  "kontaktpersonen",
  "dispo",
  "geschäftsführer",
  "geschaeftsfuehrer",
  "verwaltung",
  "contact",
  "ueber-uns",
  "über-uns",
  "unternehmen",
  "about",
  "leistungen",
  "services",
  "service",
  "fuhrpark",
  "fahrzeuge",
  "transport",
  "logistik",
  "spedition",
  "karriere",
  "jobs",
  "stellenangebote"
];
const roleTerms = ["vertreten durch", "geschäftsführer", "geschaeftsfuehrer", "geschäftsführung", "geschaeftsfuehrung", "inhaber", "inhaberin", "ceo", "managing director", "leitung disposition", "leitung", "disposition", "dispo", "logistikleitung", "betriebsleitung", "fuhrparkleitung", "vertrieb", "verkauf", "verwaltung", "lademittelmanagement", "ansprechpartner", "kontakt", "management", "vorstand"];
const primaryRoleTerms = ["geschäftsführer", "geschaeftsfuehrer", "geschäftsführung", "geschaeftsfuehrung", "inhaber", "inhaberin", "leitung", "disposition", "dispo", "vertrieb"];
const companyNameTerms = ["gmbh", "ug", "ag", "kg", "ohg", "e.k", "mbh", "co.", "&", "spedition", "logistik", "transport", "chemie", "verwaltung", "holding", "service", "kontakt", "team"];
const invalidPersonNameTerms = [
  "datenschutz",
  "datenschutzerklaerung",
  "datenschutzerklärung",
  "impressum",
  "kontakt",
  "cookie",
  "cookies",
  "einstellungen",
  "ihre datenschutzerklaerung",
  "ihre datenschutzerklärung",
  "zum inhalt",
  "amtsgericht",
  "handelsregister",
  "umsatzsteuer",
  "privacy",
  "legal",
  "telefon",
  "e-mail",
  "email",
  "vertrieb",
  "bewerbung",
  "info",
  "geschaeftsfuehrer",
  "geschaeftsfuehrung",
  "inhaber",
  "leitung",
  "disposition",
  "management",
  "vorstand"
];
const genericEmailPrefixes = ["info", "kontakt", "contact", "office", "service", "zentrale", "verwaltung", "disposition", "bewerbung", "jobs", "karriere", "sales", "vertrieb"];
const mutableFields = [
  "companyName",
  "legalName",
  "websiteUrl",
  "industry",
  "city",
  "postalCode",
  "street",
  "phone",
  "companyEmail",
  "employeeCount",
  "businessFields",
  "employeeRange",
  "vehicleCount",
  "trailerCount",
  "locationsCount",
  "isFamilyOwned",
  "decisionMakerName",
  "decisionMakerRole",
  "decisionMakerEmail",
  "decisionMakerPhone",
  "linkedinUrl",
  "fleetSignalText",
  "locationSignalText",
  "contactStructureSignalText",
  "websiteMaturitySignal",
  "customPainPoint",
  "painSummary",
  "painType",
  "icpScore",
  "icpFitScore",
  "suggestedOfferId",
  "firstName",
  "lastName"
] as const;

export function normalizeWebsiteUrl(value: string | null | undefined): URL {
  if (!value?.trim()) throw new Error("Website URL fehlt.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) {
    throw new Error("Nur HTTP/HTTPS URLs sind erlaubt.");
  }
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Nur HTTP/HTTPS URLs sind erlaubt.");
  return url;
}

export function sameDomainOnly(base: URL, urls: URL[]): URL[] {
  const host = normalizeHost(base.hostname);
  return urls.filter((url) => normalizeHost(url.hostname) === host);
}

export function buildCandidateUrls(websiteUrl: string): URL[] {
  const base = normalizeWebsiteUrl(websiteUrl);
  const paths = ["/", ...forcedContactPaths, ...candidatePaths];
  const urls = paths.map((path) => new URL(path, base));
  const sameDomain = sameDomainOnly(base, urls);
  const seen = new Set<string>();
  return sameDomain.filter((url) => {
    const key = normalizePageKey(url);
    if (seen.has(key)) return false;
    seen.add(key);
    return seen.size <= 12;
  });
}

function buildBaseUrlVariants(websiteUrl: string): URL[] {
  const base = normalizeWebsiteUrl(websiteUrl);
  const rawHost = base.hostname.replace(/^www\./i, "");
  const hosts = [rawHost, `www.${rawHost}`];
  const protocols = ["https:", "http:"];
  const seen = new Set<string>();
  const variants: URL[] = [];
  for (const protocol of protocols) {
    for (const host of hosts) {
      const candidate = new URL(base.toString());
      candidate.protocol = protocol;
      candidate.hostname = host;
      candidate.pathname = base.pathname && base.pathname !== "/" ? base.pathname : "/";
      candidate.search = "";
      candidate.hash = "";
      const key = candidate.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      variants.push(candidate);
    }
  }
  return variants;
}

function buildCandidateUrlsForBase(base: URL, reduced?: boolean): URL[] {
  const paths = reduced ? ["/", "/kontakt", "/impressum"] : ["/", ...forcedContactPaths, ...candidatePaths];
  const seen = new Set<string>();
  return paths
    .map((path) => new URL(path, base))
    .filter((url) => {
      const key = normalizePageKey(url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildReducedCandidateUrls(base: URL): URL[] {
  const paths = ["/", "/kontakt", "/impressum"];
  const seen = new Set<string>();
  return paths
    .map((path) => new URL(path, base))
    .filter((url) => {
      const key = normalizePageKey(url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function remainingBudget(deadlineAt?: number) {
  return deadlineAt ? Math.max(0, deadlineAt - Date.now()) : Number.POSITIVE_INFINITY;
}

function stepForUrl(url: URL): ResearchFailedStep {
  return /kontakt|contact|impressum/i.test(url.pathname) ? "contact_fetch" : "website_fetch";
}

function classifyPageFetchError(error: unknown, url: URL): ResearchFailureDetails {
  if (error instanceof EnrichmentStepError) {
    return { message: error.message, code: error.code, failedStep: error.failedStep, sourceUrl: error.sourceUrl };
  }
  const message = error instanceof Error ? error.message : String(error || "");
  if (/AbortError|aborted|timeout|timed out|signal/i.test(message)) {
    return { message: stepForUrl(url) === "contact_fetch" ? "Timeout beim Abrufen von Kontakt/Impressum" : "Timeout beim Abrufen der Website", code: "PAGE_TOO_SLOW", failedStep: stepForUrl(url), sourceUrl: url.toString() };
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|DNS/i.test(message)) {
    return { message: "DNS Fehler beim Abrufen der Website", code: "DNS_ERROR", failedStep: stepForUrl(url), sourceUrl: url.toString() };
  }
  if (/certificate|SSL|TLS|ERR_TLS|UNABLE_TO_VERIFY|CERT/i.test(message)) {
    return { message: "SSL Fehler beim Abrufen der Website", code: "SSL_ERROR", failedStep: stepForUrl(url), sourceUrl: url.toString() };
  }
  if (/ECONNREFUSED|ECONNRESET|fetch failed|network/i.test(message)) {
    return { message: "Website nicht erreichbar", code: "WEBSITE_UNREACHABLE", failedStep: stepForUrl(url), sourceUrl: url.toString() };
  }
  return { message: message || "Website konnte nicht abgerufen werden", code: "WEBSITE_UNREACHABLE", failedStep: stepForUrl(url), sourceUrl: url.toString() };
}

function bestFailurePage(pages: PageFetchResult[], fallbackUrl: string): PageFetchResult {
  const priority: ResearchErrorCode[] = ["BOT_PROTECTION", "SSL_ERROR", "DNS_ERROR", "PAGE_TOO_SLOW", "CRAWLER_TIMEOUT", "COOKIE_BANNER_BLOCKED", "WEBSITE_UNREACHABLE", "NO_USABLE_DATA", "RESEARCH_FAILED"];
  return [...pages].sort((a, b) => priority.indexOf(a.errorCode ?? "RESEARCH_FAILED") - priority.indexOf(b.errorCode ?? "RESEARCH_FAILED"))[0] ?? {
    url: fallbackUrl,
    text: "",
    ok: false,
    error: "Keine verwertbaren Daten gefunden",
    errorCode: "NO_USABLE_DATA",
    failedStep: "analysis"
  };
}

function formatAttemptDetails(pages: PageFetchResult[], finalReason?: string | null) {
  const lines = pages
    .filter((page) => page.attempt || page.httpStatus || page.error)
    .slice(0, 10)
    .map((page, index) => {
      const attempt = page.attempt ?? index + 1;
      const status = page.httpStatus ? `HTTP ${page.httpStatus}` : page.ok ? "OK" : "kein HTTP-Status";
      const method = page.fetchMethod ?? "GET";
      const result = page.ok ? "erreichbar" : page.error ?? "fehlgeschlagen";
      return `Versuch ${attempt}: ${method} ${page.url} -> ${status} (${result})`;
    });
  if (finalReason) lines.push(`Finaler Grund: ${finalReason}`);
  return lines.join("\n");
}

function normalizeCompanyToken(value: string) {
  return normalizeAscii(value)
    .replace(/\b(gmbh|ug|ag|kg|ohg|e\.?k\.?|mbh|co|ltd|holding|gruppe|group)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function companyNameParts(companyName: string) {
  const parts = normalizeCompanyToken(companyName).split(/\s+/).filter((part) => part.length >= 3);
  return uniqueStrings(parts);
}

function rootDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainFromEmail(email: string | null | undefined) {
  return email?.match(/@([^@\s>]+)/)?.[1]?.toLowerCase().replace(/^www\./, "") ?? null;
}

function buildCompanySearchQueries(prospect: Prospect) {
  const name = prospect.companyName.trim();
  const city = prospect.city?.trim();
  const industry = prospect.industry || prospect.businessFields[0] || "";
  return uniqueStrings([
    [name, city].filter(Boolean).join(" "),
    [name, city, "Kontakt"].filter(Boolean).join(" "),
    [name, city, "Impressum"].filter(Boolean).join(" "),
    [name, industry].filter(Boolean).join(" "),
    `${name} Spedition`,
    `${name} Logistik`,
    `${name} Transport`,
    `${name} Kontakt`,
    `${name} Impressum`,
    `${name} Standort`,
    name
  ].filter(Boolean));
}

function guessCompanyDomains(prospect: Prospect) {
  const parts = companyNameParts(prospect.companyName);
  const meaningful = parts.filter((part) => !["spedition", "logistik", "transport"].includes(part));
  const combos = [
    parts.join("-"),
    meaningful.join("-"),
    [...meaningful, "spedition"].filter(Boolean).join("-"),
    ["spedition", ...meaningful].filter(Boolean).join("-"),
    [...meaningful, "logistik"].filter(Boolean).join("-")
  ].filter((value) => value.length >= 4);
  return uniqueStrings(combos.flatMap((domain) => [`https://${domain}.de`, `https://www.${domain}.de`]));
}

async function searchCompanyWebsiteCandidates(prospect: Prospect, fetcher: typeof fetch, deadlineAt?: number) {
  const candidates = new Set<string>(guessCompanyDomains(prospect));
  for (const query of buildCompanySearchQueries(prospect).slice(0, 5)) {
    if (remainingBudget(deadlineAt) <= 2_000) break;
    try {
      const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetcher(url, {
        headers: { "User-Agent": "TasklyticBot/1.0", Accept: "text/html" },
        signal: AbortSignal.timeout(Math.min(6_000, Math.max(500, remainingBudget(deadlineAt) || 6_000)))
      });
      if (!response.ok) continue;
      const html = await response.text();
      for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
        const raw = decodeHtmlEntities(match[1] ?? "");
        const extracted = raw.match(/uddg=([^&]+)/)?.[1];
        const href = extracted ? decodeURIComponent(extracted) : raw;
        if (!/^https?:\/\//i.test(href)) continue;
        const domain = rootDomain(href);
        if (!domain || /duckduckgo|google|bing|facebook|linkedin|instagram|youtube|wikipedia|11880|gelbeseiten|northdata|webvalid|firmenwissen/.test(domain)) continue;
        candidates.add(new URL("/", href).toString());
        if (candidates.size >= 12) break;
      }
    } catch {
      continue;
    }
  }
  return Array.from(candidates).slice(0, 12);
}

function scoreWebsiteMatch(prospect: Prospect, pages: PageFetchResult[], candidateUrl: string, source: string): WebsiteMatchDecision {
  const okPages = pages.filter((page) => page.ok && page.text.trim() && !page.cookieBlocked && !isCookieOnlyText(page.text));
  const resolvedUrl = okPages[0]?.finalUrl || okPages[0]?.url || candidateUrl;
  const resolvedOrigin = new URL(/^https?:\/\//i.test(resolvedUrl) ? resolvedUrl : `https://${resolvedUrl}`).origin;
  const text = normalizeAscii(okPages.map((page) => `${page.url} ${page.title ?? ""} ${page.metaDescription ?? ""} ${page.text}`).join(" "));
  const parts = companyNameParts(prospect.companyName);
  const domain = rootDomain(resolvedOrigin) ?? "";
  const nameHits = parts.filter((part) => text.includes(part) || domain.includes(part)).length;
  const exactNameHit = text.includes(normalizeCompanyToken(prospect.companyName));
  const cityHit = prospect.city ? text.includes(normalizeAscii(prospect.city)) : false;
  const branchHit = /spedition|logistik|transport|fuhrpark|lager|fracht|güter|gueter/.test(text);
  const imprintHit = /impressum|kontakt|telefon|e-mail|email/.test(text) || okPages.some((page) => /impressum|kontakt|contact/i.test(page.url));
  const emailDomain = domainFromEmail(prospect.companyEmail || prospect.decisionMakerEmail);
  const emailHit = Boolean(emailDomain && (domain.includes(emailDomain) || emailDomain.includes(domain)));
  let confidence = 0;
  if (okPages.length) confidence += 20;
  if (nameHits > 0) confidence += Math.min(35, nameHits * 18);
  if (exactNameHit) confidence += 10;
  if (cityHit) confidence += 15;
  if (branchHit) confidence += 15;
  if (imprintHit) confidence += 10;
  if (emailHit) confidence += 10;
  if (parts.length > 0 && nameHits === 0) confidence -= 25;
  confidence = clampConfidence(confidence);
  const reason = [
    `${nameHits}/${parts.length} Namensbestandteile`,
    cityHit ? "Ort passt" : null,
    branchHit ? "Branche passt" : null,
    imprintHit ? "Kontakt/Impressum sichtbar" : null,
    emailHit ? "E-Mail-Domain passt" : null
  ].filter(Boolean).join(", ");
  return {
    url: resolvedOrigin,
    originalUrl: prospect.websiteUrl ?? null,
    candidateUrl: rootDomain(resolvedOrigin) !== rootDomain(prospect.websiteUrl) ? resolvedOrigin : null,
    confidence,
    verified: confidence >= 85,
    source,
    reason,
    pages,
    suspicious: Boolean(prospect.websiteUrl && candidateUrl !== prospect.websiteUrl && confidence < 85)
  };
}

function emptyWebsiteDecision(prospect: Prospect, pages: PageFetchResult[], reason: string): WebsiteMatchDecision {
  return {
    url: prospect.websiteUrl ?? null,
    originalUrl: prospect.websiteUrl ?? null,
    candidateUrl: null,
    confidence: 0,
    verified: false,
    source: "website_fetch",
    reason,
    pages,
    suspicious: Boolean(prospect.websiteUrl)
  };
}

function chooseBestWebsiteDecision(decisions: WebsiteMatchDecision[]) {
  return [...decisions].sort((a, b) => b.confidence - a.confidence)[0] ?? null;
}

export function extractVisibleText(html: string): string {
  const sanitizedHtml = removeCookieConsentHtml(html);
  const mailtoLinks = [...sanitizedHtml.matchAll(/href=["']mailto:([^"'?#]+)[^"']*["']/gi)].map((match) => `E-Mail ${match[1]}`);
  const telLinks = [...sanitizedHtml.matchAll(/href=["']tel:([^"']+)["']/gi)].map((match) => `Telefon ${match[1]}`);
  const cloudflareEmails = [
    ...[...sanitizedHtml.matchAll(/data-cfemail=["']([a-f0-9]+)["']/gi)].map((match) => decodeCloudflareEmail(match[1])),
    ...[...sanitizedHtml.matchAll(/email-protection#([a-f0-9]+)/gi)].map((match) => decodeCloudflareEmail(match[1]))
  ].filter(Boolean).map((email) => `E-Mail ${email}`);
  const jsonLd = [...sanitizedHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => stripHtml(match[1] ?? ""));
  const labelledSections = ["header", "nav", "main", "footer", "address"]
    .flatMap((tag) => [...sanitizedHtml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => `[[AREA:${tag}]] ${stripHtml(match[1] ?? "")} [[/AREA:${tag}]]`));
  const contactBlocks = [...sanitizedHtml.matchAll(/<[^>]+(?:class|id)=["'][^"']*(?:contact|kontakt|footer|address|ansprechpartner|team|person|vcard)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)]
    .map((match) => `[[AREA:contact-card]] ${stripHtml(match[1] ?? "")} [[/AREA:contact-card]]`);
  const visible = sanitizedHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, " ")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, " ")
    .replace(/<[^>]*(?:cookie|consent|newsletter|tracking|search|suche|menu|navigation)[^>]*>[\s\S]*?<\/[^>]+>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return decodeHtmlEntities([...mailtoLinks, ...telLinks, ...cloudflareEmails, ...jsonLd, ...labelledSections, ...contactBlocks, visible].join("\n"))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18000);
}

const cookieBannerPattern = /\b(cookies?|datenschutzeinstellungen|alle akzeptieren|akzeptieren|ablehnen|speichern|consent|borlabs|cookiebot|usercentrics|complianz|nur notwendige|notwendige cookies|cookie-einstellungen)\b/i;
const cookieDominatedPattern = /\b(cookie|cookies|datenschutz|datenschutzeinstellungen|consent|borlabs|cookiebot|usercentrics|complianz|ablehnen|akzeptieren|speichern|notwendige)\b/i;

function detectCookieBanner(html: string) {
  return cookieBannerPattern.test(stripHtml(html).slice(0, 8000)) || /(?:id|class)=["'][^"']*(?:cookie|consent|borlabs|cookiebot|usercentrics|complianz|cmplz)[^"']*["']/i.test(html);
}

function chooseCookieBannerAction(html: string) {
  const text = normalizeAscii(stripHtml(html));
  if (/\bablehnen\b|reject|decline/.test(text)) return "Ablehnen";
  if (/nur notwendige|notwendige cookies|essential only|necessary only/.test(text)) return "Nur notwendige";
  if (/\bspeichern\b|save/.test(text)) return "Speichern";
  if (/alle akzeptieren|accept all|\bakzeptieren\b/.test(text)) return "Alle akzeptieren";
  return null;
}

function removeCookieConsentHtml(html: string) {
  let cleaned = html;
  for (let pass = 0; pass < 3; pass += 1) {
    cleaned = cleaned
      .replace(/<[^>]+(?:id|class|data-[^=]+)=["'][^"']*(?:cookie|consent|borlabs|cookiebot|usercentrics|complianz|cmplz|privacy-manager|uc-)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|aside|dialog|form|footer)>/gi, " ")
      .replace(/<[^>]+(?:aria-label|role)=["'][^"']*(?:cookie|consent|dialog)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|aside|dialog|form)>/gi, " ");
  }
  return cleaned;
}

function isCookieOnlyText(text: string) {
  const normalized = normalizeAscii(text);
  if (!normalized.trim()) return false;
  const cookieHits = (normalized.match(/cookie|datenschutz|consent|borlabs|cookiebot|usercentrics|complianz|akzeptieren|ablehnen|speichern|notwendig/g) ?? []).length;
  const businessHits = (normalized.match(/spedition|transport|logistik|leistung|unternehmen|fuhrpark|kontakt|telefon|e-mail|impressum/g) ?? []).length;
  return cookieHits >= 4 && cookieHits >= businessHits * 2 && normalized.length < 3500;
}

function hasSubstantivePageText(text: string) {
  const normalized = normalizeAscii(text);
  if (normalized.length >= 800 && !isCookieOnlyText(text)) return true;
  return /spedition|transport|logistik|leistungen|unternehmen|fuhrpark|kontakt|telefon|e-mail|impressum|geschaeftsfuehrer|geschäftsführer/i.test(text) && !isCookieOnlyText(text);
}

function isPrivacyOrCookieSource(url: string, text = "") {
  return /datenschutz|privacy|cookie|cookies/i.test(url) || isPrivacyOrCookieText(text);
}

function isPrivacyOrCookieText(text: string) {
  const normalized = normalizeAscii(text);
  return /datenschutzerklaerung|datenschutzerklärung|ihre datenschutzerklaerung|ihre datenschutzerklärung|cookie-einstellungen|datenschutzeinstellungen/.test(normalized);
}

function decodeCloudflareEmail(value: string | undefined): string | null {
  if (!value || value.length < 4 || value.length % 2 !== 0) return null;
  const key = Number.parseInt(value.slice(0, 2), 16);
  if (!Number.isFinite(key)) return null;
  let decoded = "";
  for (let index = 2; index < value.length; index += 2) {
    const code = Number.parseInt(value.slice(index, index + 2), 16);
    if (!Number.isFinite(code)) return null;
    decoded += String.fromCharCode(code ^ key);
  }
  return z.string().email().safeParse(decoded).success ? decoded : null;
}

function stripHtml(value: string): string {
  const decodedEmails = [
    ...[...value.matchAll(/data-cfemail=["']([a-f0-9]+)["']/gi)].map((match) => decodeCloudflareEmail(match[1])),
    ...[...value.matchAll(/email-protection#([a-f0-9]+)/gi)].map((match) => decodeCloudflareEmail(match[1]))
  ].filter(Boolean).map((email) => ` E-Mail: ${email} `).join(" ");
  return decodeHtmlEntities(`${value} ${decodedEmails}`
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " "))
    .trim();
}

export function extractEmail(text: string): string | null {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

export function basicExtract(pages: PageFetchResult[], companyName: string): EnrichmentSuggestions {
  const combined = pages.map((page) => page.text).join("\n");
  const lower = combined.toLowerCase();
  const email = extractEmail(combined);
  const phone = extractPhone(combined);
  const hasPhone = /(\+49|0\d{2,}|\btelefon\b|\btel\.|\bphone\b)/i.test(combined);
  const businessFields = [
    lower.includes("spedition") ? "Spedition" : null,
    lower.includes("transport") ? "Transport" : null,
    lower.includes("logistik") ? "Logistik" : null,
    lower.includes("lager") ? "Lagerlogistik" : null
  ].filter(Boolean) as string[];
  const legalName = combined.match(/([A-ZÄÖÜ][\wÄÖÜäöüß&.\-\s]{2,80}\s(?:GmbH|AG|KG|e\.K\.|OHG|UG))/)?.[1] ?? null;
  const vehicleCount = numberNear(combined, /(fahrzeuge|lkw|fuhrpark)/i);
  const locationsCount = numberNear(combined, /(standorte|niederlassungen)/i);
  const familyOwned = /familienunternehmen|familiengef[uü]hrt/i.test(combined) ? true : null;
  const hasForms = /kontaktformular|formular|newsletter|bewerben/i.test(lower);
  const hasModernSignals = /api|portal|tracking|digital|online|automatis/i.test(lower);
  const contactStructureSignalText = hasForms
    ? "Website nutzt Formulare oder strukturierte Kontaktwege."
    : hasPhone
      ? "Nur Telefonnummer sichtbar, keine Online-Anfrage erkennbar."
      : null;
  const websiteMaturitySignal = hasModernSignals
    ? "Website zeigt digitale Prozess- oder Portal-Signale."
    : /veraltet|alt|oldschool|outdated|jahr 20\d{2}/.test(lower)
      ? "Veraltete Website, kein modernes Anfrageerlebnis sichtbar."
      : "Website wirkt mit öffentlich sichtbaren Basisinformationen auswertbar.";

  return {
    legalName,
    businessFields,
    phone,
    companyEmail: email,
    vehicleCount,
    locationsCount,
    isFamilyOwned: familyOwned,
    fleetSignalText: vehicleCount ? `Website erwähnt einen Fuhrpark mit etwa ${vehicleCount} Fahrzeugen.` : null,
    locationSignalText: locationsCount ? `Website erwähnt ${locationsCount} Standorte oder Niederlassungen.` : null,
    contactStructureSignalText,
    websiteMaturitySignal,
    customPainPoint: businessFields.length > 0 ? `Manuelle Abstimmung in ${businessFields[0]}-Abläufen kann Zeit kosten.` : null,
    painSummary: businessFields.length > 0 ? `Hypothese: In ${businessFields[0]}-Abläufen können manuelle Abstimmung, Dokumente und Statusrückfragen Zeit kosten.` : null,
    confidence: pages.length > 0 ? 45 : 0,
    message: "KI-Analyse nicht verfügbar, nur Basisdaten extrahiert",
    sources: pages.map((page) => ({ url: page.url, reason: `Öffentlicher Website-Text für ${companyName} ausgewertet.` }))
  };
}

export function suggestionsForEmptyFields(prospect: Prospect, suggestions: EnrichmentSuggestions): Partial<EnrichmentSuggestions> {
  const result: Partial<EnrichmentSuggestions> = {};
  for (const field of mutableFields) {
    const value = suggestions[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    const current = prospect[field as keyof Prospect];
    const empty = current === undefined || current === null || current === "" || (Array.isArray(current) && current.length === 0);
    if (empty) {
      (result as Record<string, unknown>)[field] = value;
    }
  }
  return result;
}

export function buildStructuredSuggestions(prospect: Prospect, suggestions: EnrichmentSuggestions): StructuredEnrichmentSuggestions {
  const result: StructuredEnrichmentSuggestions = {};
  const source = summarizeSource(suggestions.sources);
  const confidence = clampConfidence(suggestions.confidence);
  for (const field of mutableFields) {
    const value = suggestions[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    const current = prospect[field as keyof Prospect];
    if (sameSuggestionValue(current, value)) continue;
    result[field] = { value: value as EnrichmentFieldSuggestion["value"], source, confidence };
  }
  return result;
}

export function summarizeEnrichment(suggestions: StructuredEnrichmentSuggestions) {
  const entries = Object.values(suggestions);
  return {
    found: entries.length,
    complemented: entries.filter((entry) => entry.confidence >= 80).length,
    uncertain: entries.filter((entry) => entry.confidence > 0 && entry.confidence < 80).length,
    notFound: entries.length === 0 ? 1 : 0
  };
}

export async function fetchPublicPages(websiteUrl: string, fetcher: typeof fetch = fetch, options: FetchPublicPagesOptions = {}): Promise<PageFetchResult[]> {
  const originalBase = normalizeWebsiteUrl(websiteUrl);
  const baseVariants = buildBaseUrlVariants(websiteUrl);
  const failures: PageFetchResult[] = [];
  const pages: PageFetchResult[] = [];
  let selectedBase: URL | null = null;
  let attempt = 0;

  for (const candidateBase of baseVariants) {
    if (remainingBudget(options.deadlineAt) <= 250) break;
    attempt += 1;
    const probe = await probeBaseUrl(candidateBase, fetcher, options, attempt);
    if (probe.ok) {
      selectedBase = probe.url;
      break;
    }
    const failure = probe.error ?? { message: "Website nicht erreichbar", code: "WEBSITE_UNREACHABLE" as const, failedStep: "website_fetch" as const, sourceUrl: candidateBase.toString() };
    failures.push({
      url: candidateBase.toString(),
      text: "",
      ok: false,
      httpStatus: probe.status ?? null,
      fetchMethod: "HEAD",
      attempt,
      error: failure.message,
      errorCode: failure.code,
      failedStep: failure.failedStep
    });
  }

  const base = selectedBase ?? originalBase;
  const robotsRules = await fetchRobotsRules(base, fetcher);
  const queue = buildCandidateUrlsForBase(base, options.reduced);
  const seen = new Set<string>();
  const maxPages = options.reduced ? 3 : 10;
  const maxQueue = options.reduced ? queue.length : 36;

  if (selectedBase) {
    for (let index = 0; index < queue.length && pages.length < maxPages; index += 1) {
      if (remainingBudget(options.deadlineAt) <= 250) {
        pages.push({
          url: base.toString(),
          text: "",
          ok: false,
          error: "Crawler Timeout",
          errorCode: "CRAWLER_TIMEOUT",
          failedStep: "crawler",
          fetchMethod: "GET",
          attempt: attempt + index + 1
        });
        break;
      }
      const url = queue[index];
      const key = normalizePageKey(url);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isAllowedByRobots(url, robotsRules)) continue;
      try {
        const page = await fetchPageWithConsentHandling(url, fetcher, options, attempt + index + 1);
        if (!page) continue;
        pages.push(page);
        if (!options.reduced) {
          for (const link of discoverInternalLinks(page.html ?? "", url, base)) {
            if (queue.length >= maxQueue) break;
            const linkKey = normalizePageKey(link);
            if (!seen.has(linkKey) && !queue.some((queued) => normalizePageKey(queued) === linkKey)) {
              queue.push(link);
            }
          }
          queue.sort((a, b) => pagePriority(a) - pagePriority(b));
        }
      } catch (error) {
        const failure = classifyPageFetchError(error, url);
        pages.push({ url: url.toString(), text: "", ok: false, fetchMethod: "GET", attempt: attempt + index + 1, error: failure.message, errorCode: failure.code, failedStep: failure.failedStep });
        continue;
      }
    }
  }
  const successfulPages = pages.filter((page) => page.ok && page.text.trim().length > 0 && !page.cookieBlocked);
  const hasContactInfo = successfulPages.some((page) => extractEmail(page.text) || extractPhone(page.text));
  if (!hasContactInfo && successfulPages.length < 10) {
    const privacyUrl = new URL("/datenschutz", base);
    if (!seen.has(normalizePageKey(privacyUrl)) && isAllowedByRobots(privacyUrl, robotsRules)) {
      try {
        const response = await fetcher(privacyUrl, {
          headers: { "User-Agent": "TasklyticBot/1.0" },
          signal: AbortSignal.timeout(Math.min(10_000, Math.max(500, remainingBudget(options.deadlineAt) || 10_000)))
        });
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          const html = await response.text();
          const cookieBannerDetected = detectCookieBanner(html);
          const text = extractVisibleText(html);
          const cookieBlocked = cookieBannerDetected && !hasSubstantivePageText(text);
          if (!cookieBlocked) successfulPages.push({
            url: privacyUrl.toString(),
            title: extractMetaTitle(html),
            metaDescription: extractMetaDescription(html),
            text,
            html,
            ok: true,
            httpStatus: response.status,
            fetchMethod: "GET",
            attempt: pages.length + failures.length + 1,
            cookieBannerDetected,
            cookieBannerAction: cookieBannerDetected ? chooseCookieBannerAction(html) : null,
            cookieBlocked,
            privacySource: true
          });
        }
      } catch {
        // Datenschutz is only a fallback source for missing contact data.
      }
    }
  }
  if (successfulPages.length === 0 && options.browserFallback !== false && remainingBudget(options.deadlineAt) > 5_000) {
    const browserPage = await fetchPageWithBrowser(base, options, failures.length + pages.length + 1);
    if (browserPage.ok && browserPage.text.trim()) return [browserPage, ...successfulPages].slice(0, maxPages);
    if (browserPage.error) pages.push(browserPage);
  }
  if (successfulPages.length === 0 && pages.some((page) => page.cookieBannerDetected || page.cookieBlocked)) {
    console.info("COOKIE_BANNER_BLOCKED", { websiteUrl: base.toString(), pages: pages.length });
    return [{
      url: base.toString(),
      text: "",
      ok: false,
      error: "Cookie-Banner blockiert Analyse",
      errorCode: "COOKIE_BANNER_BLOCKED",
      failedStep: "crawler",
      cookieBannerDetected: true,
      cookieBlocked: true,
      cookieBannerAction: pages.find((page) => page.cookieBannerAction)?.cookieBannerAction ?? null
    }];
  }
  if (successfulPages.length === 0 && (pages.length > 0 || failures.length > 0)) return [bestFailurePage([...pages, ...failures], base.toString())];
  return successfulPages.slice(0, maxPages);
}

async function probeBaseUrl(url: URL, fetcher: typeof fetch, options: FetchPublicPagesOptions, attempt: number): Promise<BaseProbeResult> {
  const timeoutMs = Math.min(6_000, Math.max(500, remainingBudget(options.deadlineAt) || 6_000));
  try {
    const response = await fetcher(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "TasklyticBot/1.0" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (response.ok || [301, 302, 303, 307, 308, 401, 403, 405].includes(response.status)) {
      return { url: new URL(response.url || url.toString()), ok: true, status: response.status };
    }
    if (response.status === 404) {
      return {
        url,
        ok: false,
        status: response.status,
        error: { message: `Versuch ${attempt}: ${url.toString()} -> HTTP 404 ohne verwertbare Weiterleitung`, code: "WEBSITE_UNREACHABLE", failedStep: "website_fetch", sourceUrl: url.toString() }
      };
    }
  } catch {
    // HEAD is only a fast probe. GET decides whether the website is usable.
  }

  try {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "TasklyticBot/1.0", Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (response.ok || [401, 403].includes(response.status)) return { url: new URL(response.url || url.toString()), ok: true, status: response.status };
    return {
      url,
      ok: false,
      status: response.status,
      error: { message: `Versuch ${attempt}: ${url.toString()} -> HTTP ${response.status}`, code: "WEBSITE_UNREACHABLE", failedStep: "website_fetch", sourceUrl: url.toString() }
    };
  } catch (error) {
    return { url, ok: false, error: classifyPageFetchError(error, url) };
  }
}

async function fetchPageWithConsentHandling(url: URL, fetcher: typeof fetch, options: FetchPublicPagesOptions = {}, attempt?: number): Promise<PageFetchResult | null> {
  const timeoutMs = Math.min(10_000, Math.max(500, remainingBudget(options.deadlineAt) || 10_000));
  const response = await fetcher(url, {
    redirect: "follow",
    headers: { "User-Agent": "TasklyticBot/1.0", Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (response.status === 403 || response.status === 429) {
    throw new EnrichmentStepError({ message: "Bot-Schutz blockiert Website-Abruf", code: "BOT_PROTECTION", failedStep: stepForUrl(url), sourceUrl: url.toString() });
  }
  if (!response.ok) {
    throw new EnrichmentStepError({ message: `Website nicht erreichbar: HTTP ${response.status}`, code: "WEBSITE_UNREACHABLE", failedStep: stepForUrl(url), sourceUrl: url.toString() });
  }
  if (!response.headers.get("content-type")?.includes("text/html")) return null;
  const html = await response.text();
  const cookieBannerDetected = detectCookieBanner(html);
  const cookieBannerAction = cookieBannerDetected ? chooseCookieBannerAction(html) : null;
  if (cookieBannerDetected) {
    console.info("COOKIE_BANNER_DETECTED", { url: response.url || url.toString(), action: cookieBannerAction });
    if (cookieBannerAction) console.info("COOKIE_BANNER_ACTION_CLICKED", { url: response.url || url.toString(), action: cookieBannerAction });
  }
  const title = extractMetaTitle(html);
  const metaDescription = extractMetaDescription(html);
  const text = extractVisibleText(html);
  const cookieBlocked = cookieBannerDetected && !hasSubstantivePageText(text);
  if (cookieBannerDetected && !cookieBlocked) {
    console.info("CONTENT_AFTER_CONSENT_EXTRACTED", { url: response.url || url.toString(), textLength: text.length });
  }
  if (cookieBlocked) {
    console.info("COOKIE_BANNER_BLOCKED", { url: response.url || url.toString(), textLength: text.length });
  }
  return {
    url: response.url || url.toString(),
    title,
    metaDescription,
    text: cookieBlocked ? "" : text,
    html,
    ok: !cookieBlocked,
    httpStatus: response.status,
    fetchMethod: "GET",
    attempt,
    finalUrl: response.url || url.toString(),
    error: cookieBlocked ? "Cookie-Banner blockiert Analyse" : undefined,
    errorCode: cookieBlocked ? "COOKIE_BANNER_BLOCKED" : undefined,
    failedStep: cookieBlocked ? "crawler" : undefined,
    cookieBannerDetected,
    cookieBannerAction,
    cookieBlocked,
    privacySource: /\/(?:datenschutz|privacy)(?:\/|$)/i.test(url.pathname)
  };
}

async function fetchPageWithBrowser(base: URL, options: FetchPublicPagesOptions = {}, attempt?: number): Promise<PageFetchResult> {
  const timeoutMs = Math.min(30_000, Math.max(20_000, remainingBudget(options.deadlineAt) || 20_000));
  let browser: { close: () => Promise<void> } | null = null;
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
    const playwright = await dynamicImport("playwright");
    browser = await playwright.chromium.launch({ headless: true });
    const context = await (browser as any).newContext({
      userAgent: "Mozilla/5.0 (compatible; TasklyticBot/1.0; +https://tasklytic.de)",
      javaScriptEnabled: true
    });
    await context.route("**/*", (route: any) => {
      const type = route.request().resourceType();
      if (["image", "media", "font", "stylesheet"].includes(type)) return route.abort().catch(() => undefined);
      return route.continue().catch(() => undefined);
    });
    const page = await context.newPage();
    const response = await page.goto(base.toString(), { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(800).catch(() => undefined);
    const text = String(await page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""));
    const html = String(await page.content().catch(() => ""));
    const title = await page.title().catch(() => null);
    const finalUrl = page.url();
    const normalizedText = text.replace(/\s+/g, " ").trim().slice(0, 18000);
    const status = response?.status() ?? null;
    if (normalizedText && !isCookieOnlyText(normalizedText)) {
      return {
        url: finalUrl || base.toString(),
        finalUrl: finalUrl || base.toString(),
        title,
        metaDescription: extractMetaDescription(html),
        text: normalizedText,
        html,
        ok: true,
        httpStatus: status,
        fetchMethod: "BROWSER",
        attempt
      };
    }
    return {
      url: finalUrl || base.toString(),
      finalUrl: finalUrl || base.toString(),
      text: "",
      html,
      ok: false,
      httpStatus: status,
      fetchMethod: "BROWSER",
      attempt,
      error: "Browser-Fallback fand keinen verwertbaren Startseitentext",
      errorCode: "NO_USABLE_DATA",
      failedStep: "crawler"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return {
      url: base.toString(),
      text: "",
      ok: false,
      fetchMethod: "BROWSER",
      attempt,
      error: `Browser-Fallback fehlgeschlagen: ${message}`,
      errorCode: /playwright|Cannot find package|module/i.test(message) ? "RESEARCH_FAILED" : "CRAWLER_TIMEOUT",
      failedStep: "crawler"
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

async function fetchRobotsRules(baseUrl: URL, fetcher: typeof fetch): Promise<string[]> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl);
    const response = await fetcher(robotsUrl, {
      headers: { "User-Agent": "TasklyticBot/1.0" },
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return [];
    const text = await response.text();
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^disallow:/i.test(line))
      .map((line) => line.replace(/^disallow:/i, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isAllowedByRobots(url: URL, disallowedPaths: string[]): boolean {
  return !disallowedPaths.some((path) => path === "/" || url.pathname.startsWith(path));
}

export async function enrichProspect(prospect: Prospect) {
  const website = prospect.websiteUrl ? normalizeWebsiteUrl(prospect.websiteUrl) : null;
  const attemptAt = new Date();
  const deadlineAt = Date.now() + 45_000;
  const run = await prisma.prospectEnrichmentRun.create({
    data: {
      prospectId: prospect.id,
      status: "pending",
      sourceUrl: website?.toString() ?? prospect.companyName,
      suggestionsJson: {},
      sourcesJson: []
    }
  });

  try {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        researchStatus: "running",
        lastResearchAt: attemptAt,
        lastAttemptAt: attemptAt,
        sourceUrl: website?.toString() ?? null,
        lastResearchError: null,
        lastResearchErrorCode: null,
        failedStep: null,
        enrichmentNotes: null,
        enrichmentStatus: "in_progress",
        enrichmentUpdatedAt: attemptAt
      }
    }).catch(() => undefined);
    let pages: PageFetchResult[] = [];
    const websiteDecisions: WebsiteMatchDecision[] = [];
    if (website) {
      pages = await fetchPublicPages(website.toString(), fetch, { deadlineAt });
      const initialDecision = pages.some((page) => page.ok && page.text.trim())
        ? scoreWebsiteMatch(prospect, pages, website.toString(), "existing_website")
        : emptyWebsiteDecision(prospect, pages, pages[0]?.error ?? "Vorhandene Website konnte nicht belastbar geprüft werden");
      websiteDecisions.push(initialDecision);
    }
    const firstFailure = pages.length === 1 && pages[0]?.ok === false ? pages[0] : null;
    if (firstFailure && firstFailure.errorCode !== "COOKIE_BANNER_BLOCKED" && remainingBudget(deadlineAt) > 1_000 && website) {
      const retryPages = await fetchPublicPages(website.toString(), fetch, { reduced: true, deadlineAt });
      if (retryPages.some((page) => page.ok && page.text.trim())) pages = retryPages;
      else pages = [bestFailurePage([...retryPages, firstFailure], website.toString())];
    }

    const currentDecision = chooseBestWebsiteDecision(websiteDecisions);
    if ((!currentDecision || currentDecision.confidence < 60) && remainingBudget(deadlineAt) > 4_000) {
      const candidates = await searchCompanyWebsiteCandidates(prospect, fetch, deadlineAt);
      for (const candidate of candidates) {
        if (remainingBudget(deadlineAt) <= 4_000) break;
        if (website && rootDomain(candidate) === rootDomain(website.toString())) continue;
        const candidatePages = await fetchPublicPages(candidate, fetch, { reduced: true, deadlineAt, browserFallback: false });
        if (!candidatePages.some((page) => page.ok && page.text.trim())) continue;
        websiteDecisions.push(scoreWebsiteMatch(prospect, candidatePages, candidate, "company_name_search"));
      }
      const best = chooseBestWebsiteDecision(websiteDecisions);
      if (best && best.confidence >= Math.max(60, currentDecision?.confidence ?? 0)) {
        pages = best.pages;
      }
    }
    const websiteDecision = chooseBestWebsiteDecision(websiteDecisions) ?? emptyWebsiteDecision(prospect, pages, pages[0]?.error ?? "Keine Website geprüft");
    const cookieBlocked = pages.some((page) => page.cookieBlocked || page.error === "Cookie-Banner blockiert Analyse") && !pages.some((page) => page.ok && page.text.trim());
    const apiKey = await getEffectiveOpenAiApiKey();
    const offer = apiKey ? await requireOfferForProspect(prospect) : null;
    let analysisFailure: ResearchFailureDetails | null = null;
    const analysis = apiKey
      ? await analyzeProspectWithOpenAI(pages, prospect, apiKey, userOfferContextText(offer!), deadlineAt).catch((error) => {
          const failure = classifyAnalysisError(error, websiteDecision.url ?? website?.toString() ?? prospect.companyName);
          analysisFailure = failure;
          return analyzeProspectHeuristically(pages, prospect, failure.message);
        })
      : analyzeProspectHeuristically(pages, prospect, "KI-Analyse nicht verfügbar, nur Basisdaten extrahiert");
    const suggestions = suggestionsFromAnalysis(analysis);
    const structuredSuggestions = buildStructuredSuggestions(prospect, suggestions);
    const failedPage = pages.find((page) => page.ok === false || page.errorCode);
    const hasUsablePage = pages.some((page) => page.ok && page.text.trim() && !page.cookieBlocked);
    const hasPartialBaseData = Boolean(prospect.companyName && prospect.websiteUrl && prospect.city);
    const noUsableData = hasUsablePage && Object.keys(structuredSuggestions).length === 0 && analysis.confidence === 0;
    const failure = analysisFailure ?? (cookieBlocked
      ? { message: "Cookie-Banner blockiert Analyse", code: "COOKIE_BANNER_BLOCKED" as const, failedStep: "crawler" as const, sourceUrl: websiteDecision.url ?? website?.toString() ?? prospect.companyName }
      : !hasUsablePage
        ? {
            message: failedPage?.error ?? "Website nicht erreichbar",
            code: failedPage?.errorCode ?? "WEBSITE_UNREACHABLE",
            failedStep: failedPage?.failedStep ?? "website_fetch",
            sourceUrl: failedPage?.url ?? websiteDecision.url ?? website?.toString() ?? prospect.companyName
          }
        : noUsableData
          ? { message: "Keine verwertbaren Daten gefunden", code: "NO_USABLE_DATA" as const, failedStep: "analysis" as const, sourceUrl: pages[0]?.url ?? websiteDecision.url ?? website?.toString() ?? prospect.companyName }
          : null);
    const status = failure
      ? hasUsablePage || hasPartialBaseData || failure.code === "AI_TIMEOUT" ? "partial" : failure.code === "COOKIE_BANNER_BLOCKED" ? "cookie_banner_blocked" : "website_unreachable"
      : "completed";
    const failedResearch = status !== "completed" && status !== "partial";
    const attemptDetails = formatAttemptDetails(pages, failure?.message ?? null);
    const failureMessage = failure ? [failure.message, attemptDetails].filter(Boolean).join("\n") : null;
    const failureCode = failure?.code ?? null;
    const notes = [...analysis.warnings, analysis.message, attemptDetails].filter(Boolean) as string[];
    const prospectUpdate = buildProspectUpdateFromAnalysis(prospect, analysis, pages, websiteDecision.url ?? website?.toString() ?? "");
    const candidateEmail = analysis.companyContact.generalEmail;
    const selectedDomain = rootDomain(websiteDecision.url);
    const emailDomain = domainFromEmail(prospect.companyEmail || prospect.decisionMakerEmail);
    const candidateEmailDomain = domainFromEmail(candidateEmail);
    const emailVerified = Boolean(emailDomain && selectedDomain && (selectedDomain.includes(emailDomain) || emailDomain.includes(selectedDomain)));
    const candidateEmailPlausible = Boolean(candidateEmailDomain && selectedDomain && (selectedDomain.includes(candidateEmailDomain) || candidateEmailDomain.includes(selectedDomain)));
    if (websiteDecision.verified && websiteDecision.url && rootDomain(websiteDecision.url) !== rootDomain(prospect.websiteUrl)) {
      prospectUpdate.websiteUrl = websiteDecision.url;
    }
    Object.assign(prospectUpdate, {
      websiteOriginal: prospect.websiteOriginal ?? prospect.websiteUrl ?? null,
      websiteVerified: websiteDecision.verified,
      websiteCandidate: websiteDecision.candidateUrl,
      websiteConfidence: websiteDecision.confidence,
      emailOriginal: prospect.emailOriginal ?? prospect.companyEmail ?? prospect.decisionMakerEmail ?? null,
      emailVerified,
      emailCandidate: candidateEmail && candidateEmail !== prospect.companyEmail ? candidateEmail : null,
      emailConfidence: candidateEmailPlausible ? 85 : candidateEmail ? 60 : null,
      companyMatchConfidence: websiteDecision.confidence,
      companyMatchSource: `${websiteDecision.source}: ${websiteDecision.reason}`
    });
    const researchSources = buildResearchSources(pages, analysis, prospectUpdate);
    const completed = await prisma.prospectEnrichmentRun.update({
      where: { id: run.id },
      data: {
        status: failedResearch ? "failed" : "completed",
        pagesScanned: pages.length,
        confidence: analysis.confidence,
        rawSummary: failureMessage ?? analysis.icpPain.reasoning ?? analysis.message ?? null,
        suggestionsJson: structuredSuggestions,
        sourcesJson: buildSourcesJson(pages, analysis, prospectUpdate) as Prisma.InputJsonValue
      }
    });
    const updated = await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        ...(failedResearch ? {} : prospectUpdate),
        researchStatus: status,
        ...(failedResearch ? {} : { researchedAt: new Date(), lastSuccessfulResearchAt: new Date() }),
        lastResearchAt: new Date(),
        lastAttemptAt: attemptAt,
        lastResearchError: failedResearch ? failureMessage : null,
        lastResearchErrorCode: failedResearch ? failureCode : null,
        failedStep: failedResearch ? failure?.failedStep ?? null : null,
        sourceUrl: failure?.sourceUrl ?? websiteDecision.url ?? website?.toString() ?? null,
        researchSources: researchSources as Prisma.InputJsonValue,
        enrichmentStatus: failedResearch ? "failed" : status === "partial" || Object.keys(structuredSuggestions).length > 0 ? "partial" : "enriched",
        enrichmentUpdatedAt: new Date(),
        enrichmentSource: summarizeSource(suggestions.sources),
        enrichmentConfidence: analysis.confidence,
        enrichmentNotes: failureMessage ?? ([websiteDecision.suspicious ? "Website verdächtig / abweichend" : websiteDecision.verified ? "Website geprüft" : websiteDecision.candidateUrl ? "Neue Website vorgeschlagen" : null, notes.join("\n")].filter(Boolean).join("\n") || null),
        ...(failedResearch ? {} : { enrichmentSuggestions: structuredSuggestions })
      }
    });
    return { status, run: completed, prospect: updated, suggestions: structuredSuggestions, sources: suggestions.sources, notes, summary: summarizeEnrichment(structuredSuggestions) };
  } catch (error) {
    const failure = classifyResearchFailure(error);
    const failed = await prisma.prospectEnrichmentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: failure.message
      }
    });
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        enrichmentStatus: "failed",
        researchStatus: failure.status,
        lastResearchAt: new Date(),
        lastAttemptAt: attemptAt,
        lastResearchError: failure.message,
        lastResearchErrorCode: failure.code,
        failedStep: failure.failedStep,
        sourceUrl: failure.sourceUrl ?? website?.toString() ?? null,
        enrichmentUpdatedAt: new Date(),
        enrichmentNotes: failure.message
      }
    }).catch(() => undefined);
    throw Object.assign(error instanceof Error ? error : new Error("Anreicherung fehlgeschlagen"), { run: failed });
  }
}

export async function applyEnrichmentSuggestions(prospectId: string, fields?: string[], options: { minConfidence?: number; overwrite?: boolean } = {}) {
  const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: prospectId } });
  const suggestions = readStructuredSuggestions(prospect.enrichmentSuggestions);
  const selectedFields = fields?.length ? fields : Object.keys(suggestions);
  const minConfidence = options.minConfidence ?? 0;
  const data: Record<string, unknown> = {};
  for (const field of selectedFields) {
    const suggestion = suggestions[field];
    if (!suggestion || suggestion.confidence < minConfidence) continue;
    const current = prospect[field as keyof Prospect];
    if (!options.overwrite && !isEmptyValue(current)) continue;
    data[field] = suggestion.value;
    delete suggestions[field];
  }
  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      ...data,
      enrichmentSuggestions: suggestions,
      enrichmentStatus: Object.keys(suggestions).length > 0 ? "partial" : "enriched",
      enrichmentUpdatedAt: new Date()
    }
  });
  return { prospect: updated, applied: Object.keys(data), remainingSuggestions: suggestions };
}

export async function rejectEnrichmentSuggestions(prospectId: string, fields?: string[]) {
  const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: prospectId } });
  const suggestions = readStructuredSuggestions(prospect.enrichmentSuggestions);
  const selectedFields = fields?.length ? fields : Object.keys(suggestions);
  for (const field of selectedFields) delete suggestions[field];
  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      enrichmentSuggestions: suggestions,
      enrichmentStatus: Object.keys(suggestions).length > 0 ? "partial" : "not_started",
      enrichmentUpdatedAt: new Date()
    }
  });
  return { prospect: updated, rejected: selectedFields, remainingSuggestions: suggestions };
}

async function analyzeProspectWithOpenAI(pages: PageFetchResult[], prospect: Prospect, apiKey: string, offerContext: string, deadlineAt?: number): Promise<EnrichmentAnalysis> {
  const heuristic = analyzeProspectHeuristically(pages, prospect);
  const timeoutMs = Math.min(20_000, Math.max(500, remainingBudget(deadlineAt) || 20_000));
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Du bist ein B2B Prospect Research Parser. Antworte ausschliesslich mit JSON.",
            "Erfinde keine Quellen, Namen, LinkedIn URLs oder Zahlen.",
            "Firmennamen, Domainnamen, Team, Kontakt oder Abteilungsnamen duerfen niemals als Person gespeichert werden.",
            "Kontaktperson nur setzen, wenn eine echte Person zusammen mit Rolle/Kontext wie Geschaeftsfuehrer, Inhaber, Leitung, Disposition, Vertrieb, Ansprechpartner, Management oder Geschaeftsfuehrung im Text steht.",
            "Wenn keine eindeutige Person gefunden wird: alle contactPerson-Felder null.",
            "Wenn kein direkter Pain gefunden wird, erstelle trotzdem eine vorsichtige inferredPainHypothesis aus Branche, Leistungen, Standorten, Fuhrpark, Kontaktwegen und moeglicher manueller Abstimmung.",
            "Jedes wichtige Feld braucht in sources einen sourceUrl, ein kurzes extractedTextSnippet und confidence 0..1."
          ].join(" ")
        },
        {
          role: "user",
          content: `${offerContext}\n\nZielgruppe fuer ICP: Tasklytic Prozessautomatisierung fuer Spedition/Logistik.\nHigh ICP: Spedition, Transport, Logistik, Gueterverkehr, Stueckgut, Lagerlogistik, mittelstaendisch, mehrere Fahrzeuge/Standorte, operative Prozesse, Kontaktmoeglichkeit. Medium: logistiknah, aber Fuhrpark/Prozessbedarf unklar. Low: nicht logistiknah oder kaum Komplexitaet.\n\nGib exakt dieses JSON-Objekt aus: { contactPerson, companyContact, company, companyProfile, icpPain, sources, warnings, confidence, message }. Nutze null statt \"Nicht gefunden\". Quellen nur aus den gelieferten Seiten.\n\nVorhandene Heuristik:\n${JSON.stringify(heuristic).slice(0, 12000)}\n\nWebsite-Daten:\n${JSON.stringify({
              companyName: prospect.companyName,
              websiteUrl: prospect.websiteUrl,
              pages
            }).slice(0, 60000)}`
        }
      ]
    })
  });
  if (!response.ok) return analyzeProspectHeuristically(pages, prospect, `OpenAI Analyse nicht verfügbar: HTTP ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const raw = JSON.parse(content) as unknown;
    const parsed = enrichmentAnalysisSchema.parse(raw);
    return normalizeAnalysis(mergeAnalysis(heuristic, parsed), prospect, pages);
  } catch (error) {
    return {
      ...heuristic,
      warnings: [...heuristic.warnings, `OpenAI JSON konnte nicht validiert werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}`]
    };
  }
}

function classifyAnalysisError(error: unknown, sourceUrl: string): ResearchFailureDetails {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/AbortError|aborted|timeout|timed out|signal/i.test(message)) {
    return { message: "KI-Auswertung dauerte zu lange", code: "AI_TIMEOUT", failedStep: "ai_analysis", sourceUrl };
  }
  return { message: message || "KI-Auswertung fehlgeschlagen", code: "RESEARCH_FAILED", failedStep: "ai_analysis", sourceUrl };
}

function analyzeProspectHeuristically(pages: PageFetchResult[], prospect: Prospect, message?: string): EnrichmentAnalysis {
  const okPages = pages.filter((page) => page.ok && page.text.trim() && !page.cookieBlocked && !isCookieOnlyText(page.text));
  const cookieBlocked = pages.some((page) => page.cookieBlocked || page.error === "Cookie-Banner blockiert Analyse") && okPages.length === 0;
  const raw = extractRawData(pages, prospect);
  const text = okPages.map((page) => `URL: ${page.url}\n${page.title ?? ""}\n${page.metaDescription ?? ""}\n${page.text}`).join("\n\n");
  const lower = text.toLowerCase();
  const sourceFor = (field: string, terms: string[]): FieldSource | undefined => {
    const page = okPages.find((candidate) => terms.some((term) => candidate.text.toLowerCase().includes(term.toLowerCase()) || candidate.url.toLowerCase().includes(term.toLowerCase()))) ?? okPages[0];
    if (!page) return undefined;
    const snippet = bestSnippet(page.text, terms) ?? page.text.slice(0, 240);
    return { sourceUrl: page.url, extractedTextSnippet: snippet, confidence: field === "inferredPainHypothesis" ? 0.55 : 0.75 };
  };
  const companyEmail = raw.emails.find((email) => /^(info|kontakt|office|service|zentrale)@/i.test(email)) ?? extractEmail(text);
  const companyPhone = raw.phones[0] ?? extractPhone(text);
  const legalName = extractLegalName(text) ?? prospect.legalName ?? prospect.companyName;
  const address = extractAddress(text);
  const businessFields = detectBusinessFields(lower);
  const services = detectServices(lower);
  const logisticsNear = businessFields.some((field) => /spedition|transport|logistik|güterverkehr|gueterverkehr|lager/i.test(field)) || services.some((service) => /transport|logistik|lager/i.test(service));
  const fleet = numberNear(text, /(fahrzeuge|lkw|fuhrpark|trailer)/i);
  const locations = numberNear(text, /(standorte|niederlassungen|filialen)/i);
  const employees = numberNear(text, /(mitarbeiter|beschäftigte|beschaeftigte|team)/i);
  const contactCandidates = raw.contactCandidates;
  const contactPerson = contactCandidates[0] ? contactCandidateToPerson(contactCandidates[0]) : emptyContactPerson();
  const directPainSignal = bestSnippet(text, ["fahrer gesucht", "wir suchen", "karriere", "fax", "formular", "telefon", "pdf"]);
  const inferredPainHypothesis = buildPainHypothesis(businessFields, services, fleet, locations, companyEmail || companyPhone);
  const icpScore = scoreIcp(logisticsNear, fleet, locations, employees, Boolean(companyEmail || companyPhone), services);
  const painScore = clampConfidence((directPainSignal ? 35 : 0) + (logisticsNear ? 20 : 0) + (services.length >= 3 ? 15 : 0) + (companyEmail || companyPhone ? 10 : 0) + (fleet || locations ? 15 : 5));
  const industry = logisticsNear ? "Spedition / Logistik" : detectNonLogisticsIndustry(lower);
  const companySummary = buildCompanySummary(legalName, industry, businessFields, services);
  const analysis: EnrichmentAnalysis = {
    contactPerson,
    contactCandidates,
    companyContact: {
      generalEmail: companyEmail,
      generalPhone: companyPhone,
      contactPageUrl: raw.contactPageUrls[0] ?? okPages.find((page) => /kontakt|contact|impressum/i.test(page.url))?.url ?? null,
              websiteUrl: okPages[0]?.url ? new URL(okPages[0].url).origin : prospect.websiteUrl ? normalizeWebsiteUrl(prospect.websiteUrl).toString() : null
    },
    company: {
      companyName: prospect.companyName,
      legalName,
      street: address.street,
      zip: address.zip,
      city: address.city,
      state: null,
      country: address.country,
      businessFields,
      services,
      specialization: inferSpecialization(services, businessFields),
      locations: locations ? `${locations} Standorte/Niederlassungen` : null,
      fleetEstimate: fleet,
      employeeEstimate: employees,
      companyStatus: okPages.length > 0 ? "active" : "unclear"
    },
    companyProfile: {
      companySummary,
      whatTheyDo: companySummary,
      industry,
      logisticsType: logisticsNear ? businessFields.find((field) => /spedition|transport|logistik|lager/i.test(field)) ?? "Logistiknah" : null,
      serviceAreas: services,
      targetCustomers: null,
      operationalSignals: [
        ...businessFields,
        fleet ? `Fuhrpark-Signal: ${fleet}` : null,
        locations ? `Standort-Signal: ${locations}` : null,
        companyEmail || companyPhone ? "Öffentliche Kontaktwege vorhanden" : null
      ].filter(Boolean) as string[]
    },
    icpPain: {
      icpScore,
      icpLabel: icpLabel(icpScore),
      painScore,
      painType: logisticsNear ? "Operative Abstimmung / Prozessautomatisierung" : services.length ? "Prozessautomatisierung im operativen Geschäft" : null,
      painSummary: directPainSignal ?? inferredPainHypothesis,
      painHypothesis: inferredPainHypothesis,
      directPainSignal,
      inferredPainHypothesis,
      reasoning: buildIcpReasoning(logisticsNear, businessFields, services, fleet, locations, Boolean(companyEmail || companyPhone), icpScore),
      campaignSuggestion: buildCampaignSuggestion(logisticsNear, businessFields, services)
    },
    sources: {
      contactPerson: contactPerson.fullName && contactPerson.sourceUrl ? {
        sourceUrl: contactPerson.sourceUrl,
        extractedTextSnippet: contactPerson.sourceTextSnippet ?? contactPerson.fullName,
        confidence: contactPerson.confidence ?? 0.9
      } : undefined,
      legalName: sourceFor("legalName", ["gmbh", "impressum", prospect.companyName]),
      generalEmail: sourceFor("generalEmail", companyEmail ? [companyEmail] : ["e-mail", "email"]),
      generalPhone: sourceFor("generalPhone", ["telefon", "tel.", "+49"]),
      address: sourceFor("address", [address.street ?? "adresse", address.zip ?? ""]),
      businessFields: sourceFor("businessFields", [...businessFields, ...services]),
      companySummary: sourceFor("companySummary", [...businessFields, ...services]),
      inferredPainHypothesis: sourceFor("inferredPainHypothesis", [...businessFields, ...services]),
      icpScore: sourceFor("icpScore", [...businessFields, ...services, "transport", "logistik"])
    },
    warnings: cookieBlocked ? ["Cookie-Banner blockiert Analyse"] : [],
    confidence: okPages.length ? (apiIndependentConfidence(okPages, businessFields, services, companyEmail, companyPhone)) : 0,
    message: cookieBlocked ? "Cookie-Banner blockiert Analyse" : message
  };
  return normalizeAnalysis(analysis, prospect, pages);
}

function suggestionsFromAnalysis(analysis: EnrichmentAnalysis): EnrichmentSuggestions {
  return {
    companyName: analysis.company.companyName,
    legalName: analysis.company.legalName,
    websiteUrl: analysis.companyContact.websiteUrl,
    industry: analysis.companyProfile.industry,
    city: analysis.company.city,
    postalCode: analysis.company.zip,
    street: analysis.company.street,
    phone: analysis.companyContact.generalPhone,
    companyEmail: analysis.companyContact.generalEmail,
    employeeCount: analysis.company.employeeEstimate,
    businessFields: analysis.company.businessFields,
    vehicleCount: analysis.company.fleetEstimate,
    locationsCount: analysis.company.locations ? extractFirstNumber(analysis.company.locations) : null,
    decisionMakerName: analysis.contactPerson.fullName,
    decisionMakerRole: analysis.contactPerson.role,
    decisionMakerEmail: analysis.contactPerson.email ?? analysis.contactPerson.personalEmail,
    decisionMakerPhone: analysis.contactPerson.phone ?? analysis.contactPerson.personalPhone,
    linkedinUrl: analysis.contactPerson.linkedinUrl,
    customPainPoint: analysis.icpPain.painHypothesis,
    painSummary: analysis.icpPain.painSummary,
    painType: analysis.icpPain.painType,
    icpScore: analysis.icpPain.icpScore,
    icpFitScore: analysis.icpPain.icpScore,
    firstName: analysis.contactPerson.firstName,
    lastName: analysis.contactPerson.lastName,
    confidence: analysis.confidence,
    message: analysis.message,
    sources: Object.entries(analysis.sources)
      .filter(([, source]) => source?.sourceUrl)
      .map(([field, source]) => ({
        url: source!.sourceUrl,
        reason: field,
        field,
        snippet: source!.extractedTextSnippet,
        confidence: Math.round(source!.confidence * 100)
      }))
  };
}

function extractRawData(pages: PageFetchResult[], prospect: Prospect): RawExtraction {
  const okPages = pages.filter((page) => page.ok && page.text.trim() && !page.cookieBlocked && !isCookieOnlyText(page.text));
  const contactCandidatePages = okPages.filter((page) => !isPrivacyOrCookieSource(page.url, page.text));
  const combined = okPages.map((page) => page.text).join("\n");
  return {
    emails: uniqueStrings([...combined.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0])),
    phones: uniqueStrings([...combined.matchAll(/(?:\+49|0)\s?[\d\s()./-]{6,}/g)].map((match) => match[0].replace(/\s+/g, " ").trim())),
    contactCandidates: uniqueContactCandidates(contactCandidatePages.flatMap((page) => extractContactCandidates([page], prospect)))
      .sort((a, b) => contactCandidateScore(b, prospect) - contactCandidateScore(a, prospect))
      .slice(0, 8)
      .map((candidate, index) => ({ ...candidate, selectedAsPrimary: index === 0 })),
    contactPageUrls: okPages.filter((page) => /kontakt|contact|impressum|ansprechpartner|team/i.test(page.url) && !/datenschutz|privacy|cookie/i.test(page.url)).map((page) => page.url),
    errors: pages.filter((page) => page.error).map((page) => ({ url: page.url, error: page.error ?? "Abruf fehlgeschlagen" }))
  };
}

function buildProspectUpdateFromAnalysis(prospect: Prospect, analysis: EnrichmentAnalysis, pages: PageFetchResult[], websiteUrl: string): Prisma.ProspectUncheckedUpdateInput {
  const data: Prisma.ProspectUncheckedUpdateInput = {};
  const setText = (field: keyof Prospect, current: unknown, next: unknown, replaceInvalid = false) => {
    const invalid = replaceInvalid && typeof current === "string" && current.trim() && current.trim().toLowerCase() === "nicht gefunden";
    if ((isEmptyValue(current) || invalid) && typeof next === "string" && next.trim()) {
      (data as Record<string, unknown>)[field] = next.trim();
    }
  };
  const setNumber = (field: keyof Prospect, current: unknown, next: unknown) => {
    if ((current === null || current === undefined || current === 0) && typeof next === "number" && Number.isFinite(next) && next > 0) {
      (data as Record<string, unknown>)[field] = Math.round(next);
    }
  };
  const contact = analysis.contactPerson;
  const primaryCandidate = analysis.contactCandidates[0];
  if (isValidContactPerson(contact, prospect, websiteUrl) && (primaryCandidate?.score ?? 0) > 50) {
    const replaceContact = shouldReplaceContact(prospect, primaryCandidate);
    setText("salutation", prospect.salutation, contact.anrede);
    if (replaceContact && contact.firstName) data.firstName = contact.firstName;
    else setPersonText("firstName", prospect.firstName, contact.firstName, prospect);
    if (replaceContact && contact.lastName) data.lastName = contact.lastName;
    else setPersonText("lastName", prospect.lastName, contact.lastName, prospect);
    if (replaceContact && contact.fullName) data.decisionMakerName = contact.fullName;
    else setPersonText("decisionMakerName", prospect.decisionMakerName, contact.fullName, prospect);
    if (replaceContact && contact.role) data.decisionMakerRole = contact.role;
    else setText("decisionMakerRole", prospect.decisionMakerRole, contact.role, true);
    if (replaceContact && (contact.email ?? contact.personalEmail)) data.decisionMakerEmail = contact.email ?? contact.personalEmail;
    else setText("decisionMakerEmail", prospect.decisionMakerEmail, contact.email ?? contact.personalEmail);
    if (replaceContact && (contact.phone ?? contact.personalPhone)) data.decisionMakerPhone = contact.phone ?? contact.personalPhone;
    else setText("decisionMakerPhone", prospect.decisionMakerPhone, contact.phone ?? contact.personalPhone);
    setText("linkedinUrl", prospect.linkedinUrl, contact.linkedinUrl);
    data.decisionMakerSourceUrl = contact.sourceUrl ?? null;
    data.decisionMakerSourceTextSnippet = contact.sourceTextSnippet ?? analysis.sources.contactPerson?.extractedTextSnippet ?? null;
    data.decisionMakerFoundAt = new Date();
    data.decisionMakerConfidence = confidenceLabel(contact.confidence ?? 0.75);
  } else if (hasInvalidExistingPerson(prospect)) {
    data.firstName = null;
    data.lastName = null;
    data.decisionMakerName = null;
    data.decisionMakerRole = null;
  }
  setText("companyName", prospect.companyName, analysis.company.companyName);
  setText("legalName", prospect.legalName, analysis.company.legalName);
  setText("websiteUrl", prospect.websiteUrl, analysis.companyContact.websiteUrl ?? websiteUrl);
  setText("city", prospect.city, analysis.company.city);
  setText("postalCode", prospect.postalCode, analysis.company.zip);
  setText("street", prospect.street, analysis.company.street);
  setText("state", prospect.state, analysis.company.state);
  setText("country", prospect.country, analysis.company.country);
  setText("companyEmail", prospect.companyEmail, analysis.companyContact.generalEmail);
  setText("companyPhone", prospect.companyPhone, analysis.companyContact.generalPhone);
  setText("phone", prospect.phone, analysis.companyContact.generalPhone);
  setText("contactPageUrl", prospect.contactPageUrl, analysis.companyContact.contactPageUrl);
  setText("companyStatus", prospect.companyStatus === "unclear" ? null : prospect.companyStatus, analysis.company.companyStatus);
  setNumber("employeeCount", prospect.employeeCount, analysis.company.employeeEstimate);
  setNumber("employeeCountEstimate", prospect.employeeCountEstimate, analysis.company.employeeEstimate);
  setNumber("vehicleCount", prospect.vehicleCount, analysis.company.fleetEstimate);
  setNumber("fleetSizeEstimate", prospect.fleetSizeEstimate, analysis.company.fleetEstimate);
  const locationCount = analysis.company.locations ? extractFirstNumber(analysis.company.locations) : null;
  setNumber("locationsCount", prospect.locationsCount, locationCount);
  if (prospect.businessFields.length === 0 && analysis.company.businessFields.length > 0) data.businessFields = uniqueStrings(analysis.company.businessFields);
  if (isEmptyValue(prospect.services) && analysis.company.services.length > 0) data.services = uniqueStrings(analysis.company.services) as Prisma.InputJsonValue;
  setText("companyDescription", prospect.companyDescription, analysis.companyProfile.whatTheyDo, true);
  setText("companyProfileSummary", prospect.companyProfileSummary, analysis.companyProfile.companySummary, true);
  setText("industry", prospect.industry, analysis.companyProfile.industry);
  setText("specialization", prospect.specialization, analysis.company.specialization);
  setText("targetCustomers", prospect.targetCustomers, analysis.companyProfile.targetCustomers);
  setNumber("icpScore", prospect.icpScore, analysis.icpPain.icpScore);
  setNumber("icpFitScore", prospect.icpFitScore, analysis.icpPain.icpScore);
  if (!prospect.icpFitLabel || prospect.icpFitLabel === "low" || prospect.icpFitScore === 0) data.icpFitLabel = analysis.icpPain.icpLabel.toLowerCase();
  if (!prospect.icpCategory || prospect.icpCategory === "low" || prospect.fitScore === 0) data.icpCategory = analysis.icpPain.icpLabel.toLowerCase();
  setNumber("fitScore", prospect.fitScore, analysis.icpPain.icpScore);
  setNumber("painScore", prospect.painScore, analysis.icpPain.painScore);
  setText("painType", prospect.painType, analysis.icpPain.painType, true);
  setText("painSummary", prospect.painSummary, analysis.icpPain.painSummary ?? analysis.icpPain.painHypothesis, true);
  setText("customPainPoint", prospect.customPainPoint, analysis.icpPain.painHypothesis, true);
    setText("personalizationAngle", prospect.personalizationAngle, analysis.icpPain.campaignSuggestion);
  data.manualProcessSignal = prospect.manualProcessSignal || Boolean(analysis.icpPain.inferredPainHypothesis);
    data.digitalWeaknessSignal = prospect.digitalWeaknessSignal || /fax|telefon|e-mail|email|formular|pdf/i.test(pages.map((page) => page.text).join(" "));
  data.painEvidence = buildPainEvidence(analysis) as Prisma.InputJsonValue;
  data.contactCandidates = analysis.contactCandidates as Prisma.InputJsonValue;
  return data;

  function setPersonText(field: "firstName" | "lastName" | "decisionMakerName", current: unknown, next: unknown, currentProspect: Prospect) {
    if (typeof next !== "string" || !next.trim()) return;
    const invalidCurrent = typeof current === "string" && current.trim() && isInvalidExistingPersonValue(field, current, currentProspect);
    if (isEmptyValue(current) || invalidCurrent) {
      (data as Record<string, unknown>)[field] = next.trim();
    }
  }
}

function shouldReplaceContact(prospect: Prospect, candidate: ContactCandidate | undefined) {
  if (!candidate || candidate.score <= 50) return false;
  if (!prospect.decisionMakerName && !prospect.decisionMakerEmail && !prospect.decisionMakerPhone && !prospect.decisionMakerRole) return true;
  if (hasInvalidExistingPerson(prospect)) return true;
  if ((prospect.decisionMakerConfidence === "low" || prospect.decisionMakerConfidence === "medium") && candidate.confidenceLabel === "high") return true;
  return false;
}

function normalizeAnalysis(analysis: EnrichmentAnalysis, prospect: Prospect, pages: PageFetchResult[]): EnrichmentAnalysis {
  const warnings = [...analysis.warnings];
  if (isValidContactPerson(analysis.contactPerson, prospect, prospect.websiteUrl ?? "") && analysis.contactCandidates.length === 0) {
    analysis.contactCandidates = [personToContactCandidate(analysis.contactPerson)];
  }
  if (!isValidContactPerson(analysis.contactPerson, prospect, prospect.websiteUrl ?? "")) {
    const hadName = Boolean(analysis.contactPerson.fullName || analysis.contactPerson.firstName || analysis.contactPerson.lastName);
    if (hadName) warnings.push("Kontaktperson verworfen, weil Name/Rolle nicht eindeutig als echte Person validiert wurde.");
    analysis.contactPerson = emptyContactPerson();
  }
  analysis.contactCandidates = uniqueContactCandidates(analysis.contactCandidates.filter((candidate) => isValidContactPerson(contactCandidateToPerson(candidate), prospect, candidate.sourceUrl ?? prospect.websiteUrl ?? "")))
    .sort((a, b) => contactCandidateScore(b, prospect) - contactCandidateScore(a, prospect))
    .map((candidate, index) => ({ ...candidate, selectedAsPrimary: index === 0 }));
  if (analysis.contactCandidates[0]) analysis.contactPerson = contactCandidateToPerson(analysis.contactCandidates[0]);
  const icpScore = clampConfidence(analysis.icpPain.icpScore);
  const painHypothesis = analysis.icpPain.inferredPainHypothesis || analysis.icpPain.painHypothesis || buildPainHypothesis(analysis.company.businessFields, analysis.company.services, analysis.company.fleetEstimate, analysis.company.locations ? extractFirstNumber(analysis.company.locations) : null, Boolean(analysis.companyContact.generalEmail || analysis.companyContact.generalPhone));
  analysis.icpPain = {
    ...analysis.icpPain,
    icpScore,
    icpLabel: icpLabel(icpScore),
    painScore: clampConfidence(analysis.icpPain.painScore || (painHypothesis ? 45 : 0)),
    painHypothesis,
    inferredPainHypothesis: analysis.icpPain.inferredPainHypothesis || painHypothesis,
    painSummary: analysis.icpPain.painSummary || painHypothesis,
    reasoning: analysis.icpPain.reasoning || buildIcpReasoning(detectBusinessFields(pages.map((page) => page.text).join("\n").toLowerCase()).length > 0, analysis.company.businessFields, analysis.company.services, analysis.company.fleetEstimate, analysis.company.locations ? extractFirstNumber(analysis.company.locations) : null, Boolean(analysis.companyContact.generalEmail || analysis.companyContact.generalPhone), icpScore)
  };
  analysis.company.businessFields = uniqueStrings(analysis.company.businessFields);
  analysis.company.services = uniqueStrings(analysis.company.services);
  analysis.companyProfile.serviceAreas = uniqueStrings(analysis.companyProfile.serviceAreas);
  analysis.confidence = clampConfidence(analysis.confidence);
  analysis.warnings = uniqueStrings(warnings);
  return analysis;
}

function mergeAnalysis(base: EnrichmentAnalysis, next: EnrichmentAnalysis): EnrichmentAnalysis {
  return {
    ...base,
    ...next,
    contactPerson: { ...base.contactPerson, ...withoutNullish(next.contactPerson) },
    contactCandidates: next.contactCandidates.length ? uniqueContactCandidates([...base.contactCandidates, ...next.contactCandidates]) : base.contactCandidates,
    companyContact: { ...base.companyContact, ...withoutNullish(next.companyContact) },
    company: { ...base.company, ...withoutNullish(next.company), businessFields: next.company.businessFields.length ? next.company.businessFields : base.company.businessFields, services: next.company.services.length ? next.company.services : base.company.services },
    companyProfile: { ...base.companyProfile, ...withoutNullish(next.companyProfile), serviceAreas: next.companyProfile.serviceAreas.length ? next.companyProfile.serviceAreas : base.companyProfile.serviceAreas, operationalSignals: next.companyProfile.operationalSignals.length ? next.companyProfile.operationalSignals : base.companyProfile.operationalSignals },
    icpPain: { ...base.icpPain, ...withoutNullish(next.icpPain) },
    sources: { ...base.sources, ...next.sources },
    warnings: [...base.warnings, ...next.warnings],
    confidence: next.confidence || base.confidence
  };
}

function buildSourcesJson(pages: PageFetchResult[], analysis: EnrichmentAnalysis, persistedFields: Prisma.ProspectUncheckedUpdateInput = {}) {
  return {
    pages: pages.map((page) => ({ url: page.url, title: page.title, metaDescription: page.metaDescription })),
    fields: analysis.sources,
    contactCandidates: analysis.contactCandidates,
    enrichmentDebug: buildEnrichmentDebug(pages, analysis, persistedFields),
    warnings: analysis.warnings
  };
}

function buildResearchSources(pages: PageFetchResult[], analysis: EnrichmentAnalysis, persistedFields: Prisma.ProspectUncheckedUpdateInput = {}) {
  return {
    pages: pages.map((page) => ({ url: page.url, ok: true, title: page.title, metaDescription: page.metaDescription })),
    fields: analysis.sources,
    contactCandidates: analysis.contactCandidates,
    enrichmentDebug: buildEnrichmentDebug(pages, analysis, persistedFields),
    warnings: analysis.warnings
  };
}

function buildEnrichmentDebug(pages: PageFetchResult[], analysis: EnrichmentAnalysis, persistedFields: Prisma.ProspectUncheckedUpdateInput) {
  const raw = {
    emails: uniqueStrings(pages.flatMap((page) => [...page.text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]))),
    phones: uniqueStrings(pages.flatMap((page) => [...page.text.matchAll(/(?:\+49|0)\s?[\d\s()./-]{6,}/g)].map((match) => match[0].replace(/\s+/g, " ").trim()))),
    contactCandidates: analysis.contactCandidates,
    selectedPrimaryContact: analysis.contactCandidates.find((candidate) => candidate.selectedAsPrimary) ?? analysis.contactCandidates[0] ?? null
  };
  return {
    steps: {
      crawl: {
        urls: pages.map((page) => page.url),
        finalUrl: pages.find((page) => page.ok)?.url ?? null,
        errors: pages.filter((page) => page.error).map((page) => ({ url: page.url, error: page.error }))
      },
      rawExtraction: raw,
      normalization: {
        contactPerson: analysis.contactPerson,
        company: analysis.company,
        companyContact: analysis.companyContact,
        confidence: analysis.confidence,
        warnings: analysis.warnings
      },
      fieldMapping: {
        selectedPrimaryContact: raw.selectedPrimaryContact,
        mappedFields: Object.keys(persistedFields)
      },
      persistence: {
        savedFields: sanitizePersistedFields(persistedFields)
      }
    }
  };
}

function sanitizePersistedFields(fields: Prisma.ProspectUncheckedUpdateInput) {
  return Object.fromEntries(Object.entries(fields)
    .filter(([key]) => key !== "painEvidence" && key !== "contactCandidates")
    .map(([key, value]) => [key, value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(String) : typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null ? value : String(value)]));
}

function normalizeRawContactPerson(value: unknown) {
  if (typeof value === "string") return parseContactPersonString(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const fullName = typeof record.fullName === "string" ? record.fullName : typeof record.name === "string" ? record.name : null;
  const parsed = fullName || typeof record.raw === "string" ? parseContactPersonString([fullName, record.role, record.phone, record.personalPhone, record.email, record.personalEmail, record.raw].filter(Boolean).join(" ")) : {};
  return {
    ...parsed,
    ...record,
    fullName: fullName ?? (parsed as { fullName?: string | null }).fullName ?? null,
    firstName: typeof record.firstName === "string" ? record.firstName : (parsed as { firstName?: string | null }).firstName ?? null,
    lastName: typeof record.lastName === "string" ? record.lastName : (parsed as { lastName?: string | null }).lastName ?? null,
    role: typeof record.role === "string" ? record.role : (parsed as { role?: string | null }).role ?? null,
    personalEmail: typeof record.personalEmail === "string" ? record.personalEmail : typeof record.email === "string" ? record.email : (parsed as { personalEmail?: string | null }).personalEmail ?? null,
    personalPhone: typeof record.personalPhone === "string" ? record.personalPhone : typeof record.phone === "string" ? record.phone : (parsed as { personalPhone?: string | null }).personalPhone ?? null
  };
}

function parseContactPersonString(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const name = cleanString(text.match(/\b([A-ZÄÖÜ][a-zäöüß-]{2,}\s+[A-ZÄÖÜ][a-zäöüß-]{2,})\b/)?.[1] ?? null);
  const [firstName, ...lastParts] = name?.split(/\s+/) ?? [];
  const roleMatch = text.match(/\b(Geschäftsführer|Geschaeftsfuehrer|Geschäftsführung|Geschaeftsfuehrung|Inhaber(?:in)?|Managing Director|CEO|Ansprechpartner|Leitung|Management|Vertrieb|Disposition)\b/i)?.[1] ?? null;
  const phone = cleanString(text.match(/(?:\+49|0049|0)\s?(?:\(?\d{1,5}\)?[\s./-]?){2,8}\d/i)?.[0] ?? null);
  const email = cleanString(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null);
  return {
    anrede: text.match(/\b(Herr|Frau)\b/i)?.[1] ?? null,
    firstName: firstName ?? null,
    lastName: lastParts.join(" ") || null,
    fullName: name,
    role: roleMatch ? formatRole(roleMatch) : name ? "Ansprechpartner" : null,
    email,
    phone,
    personalEmail: email,
    personalPhone: phone,
    linkedinUrl: text.match(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^\s"'<>]+/i)?.[0] ?? null,
    sourceUrl: null,
    confidence: name ? 0.85 : 0
  };
}

function normalizePageKey(url: URL) {
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function pagePriority(url: URL) {
  const path = decodeURIComponent(url.pathname.toLowerCase());
  if (path === "/" || path === "") return 0;
  const index = priorityTerms.findIndex((term) => path.includes(term));
  if (index >= 0) return index + 1;
  if (/datenschutz|privacy/i.test(path)) return 90;
  return 50;
}

function discoverInternalLinks(html: string, currentUrl: URL, base: URL) {
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi), (match) => match[1])
    .map((href) => {
      try {
        return new URL(href, currentUrl);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => {
      if (!url) return false;
      return sameDomainOnly(base, [url]).length === 1;
    })
    .filter((url) => ["http:", "https:"].includes(url.protocol))
    .filter((url) => {
      const path = decodeURIComponent(url.pathname.toLowerCase());
      return priorityTerms.some((term) => path.includes(term)) || (!/datenschutz|privacy|agb|login|shop|warenkorb|pdf|jpg|png|zip/i.test(path) && path.split("/").filter(Boolean).length <= 2);
    });
  return links.sort((a, b) => pagePriority(a) - pagePriority(b));
}

function extractMetaTitle(html: string) {
  return decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || null;
}

function extractMetaDescription(html: string) {
  return decodeHtmlEntities(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)?.[1] ?? "").trim() || null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&uuml;/g, "ü")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&szlig;/g, "ß")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function extractLegalName(text: string) {
  return cleanString(text.match(/\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9 &.,'-]{2,90}\s(?:GmbH|UG|AG|KG|OHG|e\.K\.|GmbH\s*&\s*Co\.?\s*KG))\b/)?.[1] ?? null);
}

function extractAddress(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const match = normalized.match(/\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß .'-]{1,60}(?:straße|strasse|str\.|weg|allee|ring|platz|gasse|damm|ufer)\s+\d+[a-zA-Z]?(?:\s?[-–]\s?\d+[a-zA-Z]?)?)\s*,?\s*(?:D[-\s])?(\d{5})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß .'-]{2,50})\b/);
  return {
    street: cleanString(match?.[1] ?? null),
    zip: match?.[2] ?? null,
    city: cleanString(match?.[3]?.replace(/\bDeutschland\b.*$/i, "") ?? null),
    country: /deutschland|germany|\bDE\b/.test(normalized) ? "DE" : null
  };
}

function detectBusinessFields(lower: string) {
  const fields = [
    lower.includes("spedition") ? "Spedition" : null,
    lower.includes("transport") || lower.includes("güterverkehr") || lower.includes("gueterverkehr") ? "Transport" : null,
    lower.includes("logistik") ? "Logistik" : null,
    lower.includes("lager") ? "Lagerlogistik" : null,
    lower.includes("chemikalienhandel") || lower.includes("chemikalien") ? "Chemikalienhandel" : null,
    lower.includes("lohnabfüllung") || lower.includes("lohnabfuellung") ? "Lohnabfüllung" : null,
    lower.includes("anlagenbau") ? "Anlagenbau" : null
  ];
  return uniqueStrings(fields.filter(Boolean) as string[]);
}

function detectServices(lower: string) {
  const keywords = ["Transport", "Spedition", "Logistik", "Lagerung", "Lagerlogistik", "Lohnabfüllung", "Chemikalienhandel", "Klebstoffe", "Anlagenbau", "Produktentwicklung", "Reinigungsmittel", "Waschrohstoffe", "Gefahrstoff", "Güterverkehr", "Internationaler Transport"];
  return uniqueStrings(keywords.filter((keyword) => lower.includes(keyword.toLowerCase())));
}

function detectNonLogisticsIndustry(lower: string) {
  if (lower.includes("chemikalien") || lower.includes("chemie")) return "Chemiehandel / Industrie";
  if (lower.includes("grosshandel") || lower.includes("großhandel")) return "Großhandel";
  return null;
}

export function extractContactCandidates(pages: PageFetchResult[], prospect: Prospect): ContactCandidate[] {
  const candidates: ContactCandidate[] = [];
  for (const page of pages) {
    if (page.cookieBlocked || isCookieOnlyText(page.text) || isPrivacyOrCookieSource(page.url, page.text)) continue;
    const text = page.text.replace(/\s+/g, " ");
    for (const chunk of contactCandidateChunks(text)) {
      for (const cardCandidate of extractCardCandidates(chunk.text, page, prospect, chunk.area)) {
        candidates.push(cardCandidate);
      }
    }
    for (const match of text.matchAll(personNamePattern())) {
      const fullName = cleanPersonNameCandidate(match[0]);
      if (!fullName || !isPersonNameShape(fullName)) continue;
      const start = Math.max(0, (match.index ?? 0) - 260);
      const end = Math.min(text.length, (match.index ?? 0) + fullName.length + 360);
      const snippet = text.slice(start, end).trim();
      const role = extractRoleNear(snippet, fullName);
      const email = extractPersonalEmailNear(snippet, fullName);
      const phone = extractPhoneNearName(snippet, fullName);
      if (!role && !email && !phone) continue;
      const [firstName, ...lastParts] = fullName.split(/\s+/);
      const candidate = contactCandidate({
        anrede: snippet.match(/\b(Herr|Frau)\b/i)?.[1] ?? null,
        firstName,
        lastName: lastParts.join(" ") || null,
        fullName,
        role: role ?? "Ansprechpartner",
        email,
        phone,
        personalEmail: email,
        personalPhone: phone,
        linkedinUrl: snippet.match(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^\s"'<>]+/i)?.[0] ?? null,
        sourceUrl: page.url,
        sourceTextSnippet: snippet,
        sourceArea: inferSourceArea(snippet, page.url),
        score: 0,
        confidence: null
      }, page, prospect);
      if (isValidContactPerson(contactCandidateToPerson(candidate), prospect, page.url)) candidates.push(candidate);
    }

    for (const pattern of roleNamePatterns()) {
      for (const match of text.matchAll(pattern)) {
        const fullName = cleanPersonNameCandidate(match.groups?.name ?? match[1]);
        if (!fullName || !isPersonNameShape(fullName)) continue;
        const start = Math.max(0, (match.index ?? 0) - 120);
        const end = Math.min(text.length, (match.index ?? 0) + 420);
        const snippet = text.slice(start, end).trim();
        const role = extractRoleNear(snippet, fullName) ?? formatRole(match.groups?.role ?? match[0]);
        const email = extractPersonalEmailNear(snippet, fullName);
        const phone = extractPhoneNearName(snippet, fullName);
        const [firstName, ...lastParts] = fullName.split(/\s+/);
        const candidate = contactCandidate({
          anrede: snippet.match(/\b(Herr|Frau)\b/i)?.[1] ?? null,
          firstName,
          lastName: lastParts.join(" ") || null,
          fullName,
          role,
          email,
          phone,
          personalEmail: email,
          personalPhone: phone,
          linkedinUrl: snippet.match(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^\s"'<>]+/i)?.[0] ?? null,
          sourceUrl: page.url,
          sourceTextSnippet: snippet,
          sourceArea: inferSourceArea(snippet, page.url),
          score: 0,
          confidence: null
        }, page, prospect);
        if (isValidContactPerson(contactCandidateToPerson(candidate), prospect, page.url)) candidates.push(candidate);
      }
    }
  }
  const sorted = uniqueContactCandidates(candidates)
    .sort((a, b) => contactCandidateScore(b, prospect) - contactCandidateScore(a, prospect))
    .slice(0, 8);
  return sorted.map((candidate, index) => ({ ...candidate, selectedAsPrimary: index === 0 }));
}

function extractPersonName(text: string) {
  const patterns = [
    /Vertreten\s+durch\s*:?[\s\n]*([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)/i,
    /(?:Geschäftsführer|Geschaeftsfuehrer|Geschäftsführung|Geschaeftsfuehrung|Inhaber(?:in)?|Managing Director|CEO|Ansprechpartner|Leitung|Management|Vertrieb|Disposition)[:\s-]+(?:Herr\s+|Frau\s+|Dr\.\s+)?([A-ZÄÖÜ][a-zäöüß-]{1,}\s+[A-ZÄÖÜ][a-zäöüß-]{1,}(?:\s+[A-ZÄÖÜ][a-zäöüß-]{1,})?)/i,
    /(?:Herr\s+|Frau\s+|Dr\.\s+)?([A-ZÄÖÜ][a-zäöüß-]{1,}\s+[A-ZÄÖÜ][a-zäöüß-]{1,}(?:\s+[A-ZÄÖÜ][a-zäöüß-]{1,})?)\s+(?:Geschäftsführer|Geschaeftsfuehrer|Geschäftsführung|Geschaeftsfuehrung|Inhaber(?:in)?|Managing Director|CEO|Ansprechpartner|Leitung|Management|Vertrieb|Disposition)/i
  ];
  for (const pattern of patterns) {
    const candidate = cleanString(text.match(pattern)?.[1] ?? null);
    if (candidate && isPersonNameShape(candidate)) return candidate;
  }
  return null;
}

function contactCandidateChunks(text: string): Array<{ area: string | null; text: string }> {
  const chunks: Array<{ area: string | null; text: string }> = [];
  const areaPattern = /\[\[AREA:([^\]]+)\]\]\s*([\s\S]*?)\s*\[\[\/AREA:\1\]\]/gi;
  for (const match of text.matchAll(areaPattern)) {
    const area = match[1] ?? null;
    const areaText = cleanString(match[2]);
    if (areaText) chunks.push({ area, text: areaText });
  }
  chunks.push({ area: null, text });
  return chunks;
}

function extractCardCandidates(text: string, page: PageFetchResult, prospect: Prospect, area: string | null): ContactCandidate[] {
  const candidates: ContactCandidate[] = [];
  const names = [...text.matchAll(personNamePattern())];
  for (let index = 0; index < names.length; index += 1) {
    const match = names[index];
    const fullName = cleanPersonNameCandidate(match[0]);
    if (!fullName || !isPersonNameShape(fullName)) continue;
    const previousIndex = index > 0 ? names[index - 1].index ?? 0 : 0;
    const nextIndex = names[index + 1]?.index ?? text.length;
    const start = Math.max(previousIndex, (match.index ?? 0) - 180);
    const end = Math.min(text.length, nextIndex);
    const snippet = text.slice(start, end).trim();
    const role = extractRoleNear(snippet, fullName);
    const email = extractBestEmailForName(snippet, fullName);
    const phone = extractPhoneNearName(snippet, fullName);
    if (!role && !email && !phone) continue;
    const [firstName, ...lastParts] = fullName.split(/\s+/);
    const candidate = contactCandidate({
      anrede: snippet.match(/\b(Herr|Frau)\b/i)?.[1] ?? null,
      firstName,
      lastName: lastParts.join(" ") || null,
      fullName,
      role: role ?? "Ansprechpartner",
      email,
      phone,
      personalEmail: email,
      personalPhone: phone,
      linkedinUrl: snippet.match(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^\s"'<>]+/i)?.[0] ?? null,
      sourceUrl: page.url,
      sourceTextSnippet: snippet,
      sourceArea: area ?? inferSourceArea(snippet, page.url),
      score: 0,
      confidence: null
    }, page, prospect);
    if (isValidContactPerson(contactCandidateToPerson(candidate), prospect, page.url)) candidates.push(candidate);
  }
  return candidates;
}

function personNamePattern() {
  return /\b(?:Herr\s+|Frau\s+|Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß-]{1,}\s+[A-ZÄÖÜ][a-zäöüß-]{1,}(?:\s+[A-ZÄÖÜ][a-zäöüß-]{1,})?\b/g;
}

function cleanPersonNameCandidate(value: string | null | undefined) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  return cleaned
    .replace(/\s+(?:E-Mail|Email|Telefon|Tel|Fax|Kontakt)$/i, "")
    .replace(/^(?:Herr|Frau|Dr\.)\s+/i, "")
    .trim();
}

function roleNamePatterns() {
  const role = "(?<role>Vertreten\\s+durch|Geschäftsführer(?:\\s*&\\s*(?:Dispo|Disposition))?|Geschaeftsfuehrer(?:\\s*&\\s*(?:Dispo|Disposition))?|Geschäftsführung|Geschaeftsfuehrung|Inhaber(?:in)?|Leitung(?:\\s+Disposition)?|Disposition|Dispo|Logistikleitung|Betriebsleitung|Fuhrparkleitung|Vertrieb(?:\\s+[A-ZÄÖÜ]{2,})?|Verkauf|Verwaltung|Lademittelmanagement|Ansprechpartner|Kontakt)";
  const name = "(?<name>(?:Herr\\s+|Frau\\s+|Dr\\.\\s+)?[A-ZÄÖÜ][a-zäöüß-]{1,}\\s+[A-ZÄÖÜ][a-zäöüß-]{1,}(?:\\s+[A-ZÄÖÜ][a-zäöüß-]{1,})?)";
  return [
    new RegExp(`${role}\\s*[:\\-–]?\\s*${name}`, "gi"),
    new RegExp(`${name}\\s*[,|\\-–]?\\s*${role}`, "gi")
  ];
}

function extractRoleNear(snippet: string, fullName: string) {
  const escapedName = escapeRegExp(fullName);
  const afterName = snippet.match(new RegExp(`${escapedName}\\s*(?:[,|\\-–:]\\s*)?([^@\\n]{0,90})`, "i"))?.[1] ?? "";
  const beforeName = snippet.match(new RegExp(`([^@\\n]{0,90})${escapedName}`, "i"))?.[1] ?? "";
  const roleSource = [afterName, beforeName, snippet].find((value) => roleTerms.some((role) => normalizeAscii(value).includes(normalizeAscii(role)))) ?? "";
  const roleMatch = roleSource.match(/(Geschäftsführer(?:\s*&\s*(?:Dispo|Disposition))?|Geschaeftsfuehrer(?:\s*&\s*(?:Dispo|Disposition))?|Geschäftsführung|Geschaeftsfuehrung|Inhaber(?:in)?|Leitung(?:\s+Disposition)?|Disposition|Dispo|Logistikleitung|Betriebsleitung|Fuhrparkleitung|Vertrieb(?:\s+[A-ZÄÖÜ]{2,})?|Verkauf|Verwaltung|Lademittelmanagement|Ansprechpartner|Kontakt)/i);
  if (roleMatch?.[1]) return formatRole(roleMatch[1]);
  const genericRole = beforeName
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:Fon|Tel\.?|Telefon|Fax|E-Mail|Mail)\s*:?[\s+\d()./-]+/gi, " ")
    .match(/([A-ZÄÖÜ][A-ZÄÖÜa-zäöüß&\s/-]{4,50})\s*$/)?.[1];
  return genericRole ? formatRole(genericRole.trim()) : null;
}

function contactCandidate(input: Omit<ContactCandidate, "foundAt" | "confidenceLabel">, _page: PageFetchResult, prospect: Prospect): ContactCandidate {
  const score = contactCandidateScore(input, prospect);
  const confidence = Math.max(0.35, Math.min(0.98, score / 100));
  return {
    ...input,
    foundAt: new Date().toISOString(),
    score,
    confidence,
    confidenceLabel: confidenceLabel(confidence)
  };
}

function contactCandidateScore(candidate: Pick<ContactCandidate, "role" | "email" | "phone" | "sourceUrl" | "sourceTextSnippet" | "sourceArea" | "fullName">, prospect: Prospect) {
  const role = normalizeAscii(candidate.role ?? "");
  const sourceUrl = normalizeAscii(candidate.sourceUrl ?? "");
  const sourceArea = normalizeAscii(candidate.sourceArea ?? "");
  let score = 0;
  if (!candidate.fullName || !isPersonNameShape(candidate.fullName)) score -= 100;
  if (candidate.fullName && hasInvalidPersonNameTerm(candidate.fullName)) score -= 120;
  if (/geschaeftsfuehrer|inhaber|ceo/.test(role)) score += 60;
  if (/leitung/.test(role)) score += 45;
  if (/dispo|disposition|logistikleitung|betriebsleitung|fuhrparkleitung/.test(role)) score += 40;
  if (/vertrieb|verkauf/.test(role)) score += 25;
  if (/verwaltung/.test(role)) score += 15;
  if (candidate.email && isPersonalEmail(candidate.email)) score += 30;
  if (candidate.phone) score += 20;
  if (/kontakt|contact|ansprechpartner|team/.test(sourceUrl)) score += 20;
  if (/impressum/.test(sourceUrl)) score += 5;
  if (/footer/.test(sourceArea) || /area:footer|footer/.test(normalizeAscii(candidate.sourceTextSnippet ?? ""))) score += 10;
  if (candidate.email && !isPersonalEmail(candidate.email)) score -= 30;
  if (candidate.fullName && isLikelyCompanyName(candidate.fullName, prospect)) score -= 70;
  return score;
}

function confidenceLabel(value: number): "high" | "medium" | "low" {
  if (value >= 0.8) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}

function contactCandidateToPerson(candidate: ContactCandidate): EnrichmentAnalysis["contactPerson"] {
  return {
    anrede: candidate.anrede,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    fullName: candidate.fullName,
    role: candidate.role,
    email: candidate.email,
    phone: candidate.phone,
    personalEmail: candidate.personalEmail,
    personalPhone: candidate.personalPhone,
    linkedinUrl: candidate.linkedinUrl,
    sourceUrl: candidate.sourceUrl,
    sourceTextSnippet: candidate.sourceTextSnippet,
    sourceArea: candidate.sourceArea,
    confidence: candidate.confidence
  };
}

function personToContactCandidate(person: EnrichmentAnalysis["contactPerson"]): ContactCandidate {
  const confidence = person.confidence ?? 0.75;
  return {
    anrede: person.anrede,
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: person.fullName,
    role: person.role,
    email: person.email ?? person.personalEmail,
    phone: person.phone ?? person.personalPhone,
    personalEmail: person.personalEmail ?? person.email ?? null,
    personalPhone: person.personalPhone ?? person.phone ?? null,
    linkedinUrl: person.linkedinUrl,
    sourceUrl: person.sourceUrl ?? null,
    sourceTextSnippet: person.sourceTextSnippet ?? person.fullName,
    sourceArea: null,
    foundAt: new Date().toISOString(),
    score: Math.round(confidence * 100),
    confidence,
    confidenceLabel: confidenceLabel(confidence)
  };
}

function emptyContactPerson(): EnrichmentAnalysis["contactPerson"] {
  return { anrede: null, firstName: null, lastName: null, fullName: null, role: null, email: null, phone: null, personalEmail: null, personalPhone: null, linkedinUrl: null, sourceUrl: null, sourceTextSnippet: null, sourceArea: null, confidence: null };
}

function uniqueContactCandidates(candidates: ContactCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = normalizeAscii(`${candidate.fullName ?? ""}|${candidate.email ?? ""}|${candidate.role ?? ""}`);
    if (!candidate.fullName || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isLikelyCompanyName(value: string, prospect: Prospect) {
  const normalized = normalizeAscii(value);
  const companyTokens = companyIdentityTokens(prospect);
  const parts = normalized.split(/\s+/);
  return companyNameTerms.some((term) => normalized.includes(normalizeAscii(term))) || parts.every((part) => companyTokens.includes(part));
}

function isValidContactPerson(person: EnrichmentAnalysis["contactPerson"], prospect: Prospect, websiteUrl: string) {
  if (!person.fullName) return false;
  if (!isPersonNameShape(person.fullName)) return false;
  const normalizedName = normalizeAscii(person.fullName);
  if (person.sourceUrl && /datenschutz|privacy|cookie|cookies/i.test(person.sourceUrl)) return false;
  if (person.sourceTextSnippet && isPrivacyOrCookieText(person.sourceTextSnippet)) return false;
  if (hasInvalidPersonNameTerm(person.fullName)) return false;
  if (person.sourceArea && /title|heading|headline|h[1-6]/i.test(person.sourceArea)) return false;
  const normalizedRole = normalizeAscii(person.role ?? "");
  const hasTrustedRole = roleTerms.some((role) => normalizedRole.includes(normalizeAscii(role)));
  const hasPriorityRole = primaryRoleTerms.some((role) => normalizedRole.includes(normalizeAscii(role)));
  const hasFullName = Boolean(person.firstName && person.lastName);
  const hasPersonalEmail = Boolean((person.personalEmail || person.email) && isPersonalEmail(person.personalEmail || person.email));
  if (!hasFullName && !hasTrustedRole && !hasPersonalEmail) return false;
  if (person.role && !hasTrustedRole && !hasPersonalEmail) return false;
  if (normalizedRole === "kontakt") return false;
  const companyTokens = [prospect.companyName, prospect.legalName, websiteUrl ? normalizeWebsiteUrl(websiteUrl).hostname : ""]
    .filter(Boolean)
    .flatMap((value) => normalizeAscii(String(value)).split(/[^a-z0-9]+/))
    .filter((token) => token.length > 2);
  const parts = normalizeAscii(person.fullName).split(/\s+/);
  if (parts.length < 2) return false;
  if (companyNameTerms.some((term) => normalizedName.includes(normalizeAscii(term)))) return false;
  if (parts.every((part) => companyTokens.includes(part))) return false;
  if (["team", "kontakt", "info", "service"].some((term) => parts.includes(term))) return false;
  if (!hasPriorityRole && !hasPersonalEmail && person.role && /ansprechpartner|kontakt|verwaltung/.test(normalizedRole)) return false;
  if (person.linkedinUrl && !/^https?:\/\/(?:[\w-]+\.)?linkedin\.com\//i.test(person.linkedinUrl)) return false;
  return true;
}

function isInvalidExistingPersonValue(field: "firstName" | "lastName" | "decisionMakerName", value: string, prospect: Prospect) {
  const companyTokens = companyIdentityTokens(prospect);
  if (field === "decisionMakerName") return !isPersonNameShape(value);
  const normalized = normalizeAscii(value);
  return !isPersonNamePart(value) || companyTokens.includes(normalized);
}

function hasInvalidExistingPerson(prospect: Prospect) {
  const companyTokens = companyIdentityTokens(prospect);
  const firstName = prospect.firstName ? normalizeAscii(prospect.firstName) : null;
  const lastName = prospect.lastName ? normalizeAscii(prospect.lastName) : null;
  return Boolean(
    (prospect.firstName && (!isPersonNamePart(prospect.firstName) || companyTokens.includes(firstName ?? ""))) ||
    (prospect.lastName && (!isPersonNamePart(prospect.lastName) || companyTokens.includes(lastName ?? ""))) ||
    (prospect.decisionMakerName && (!isPersonNameShape(prospect.decisionMakerName) || hasInvalidPersonNameTerm(prospect.decisionMakerName)))
  );
}

function hasInvalidPersonNameTerm(value: string) {
  const normalized = normalizeAscii(value);
  return invalidPersonNameTerms.some((term) => normalized.includes(normalizeAscii(term)));
}

function isPersonalEmail(value: string | null | undefined) {
  if (!value) return false;
  const localPart = value.split("@")[0]?.toLowerCase() ?? "";
  return !genericEmailPrefixes.some((prefix) => localPart === prefix || localPart.startsWith(`${prefix}.`) || localPart.startsWith(`${prefix}-`) || localPart.startsWith(`${prefix}_`));
}

function companyIdentityTokens(prospect: Prospect) {
  return [prospect.companyName, prospect.legalName, prospect.websiteUrl]
    .filter(Boolean)
    .flatMap((value) => normalizeAscii(String(value)).split(/[^a-z0-9]+/))
    .filter((token) => token.length > 2);
}

function isPersonNameShape(value: string) {
  const parts = value.trim().split(/\s+/);
  return parts.length >= 2 && parts.length <= 3 && parts.every(isPersonNamePart) && !companyNameTerms.some((term) => normalizeAscii(value).includes(normalizeAscii(term)));
}

function isPersonNamePart(value: string) {
  return /^[A-ZÄÖÜ][a-zäöüß-]{1,}$/.test(value.trim());
}

function extractPersonalEmailNear(text: string, name: string) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  if (!email) return null;
  return /^(info|kontakt|office|service|zentrale|disposition)@/i.test(email) ? null : email;
}

function extractBestEmailForName(text: string, name: string) {
  const emails = [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]);
  if (emails.length === 0) return null;
  const parts = normalizeAscii(name).split(/\s+/).filter(Boolean);
  const matching = emails.find((email) => {
    const local = normalizeAscii(email.split("@")[0] ?? "");
    return parts.some((part) => part.length > 2 && local.includes(part));
  });
  const email = matching ?? emails[0];
  return /^(info|kontakt|office|service|zentrale|disposition)@/i.test(email) ? null : email;
}

function inferSourceArea(snippet: string, sourceUrl: string) {
  const normalized = normalizeAscii(`${snippet} ${sourceUrl}`);
  if (normalized.includes("[[area:footer]]") || normalized.includes("footer")) return "footer";
  if (normalized.includes("contact-card") || normalized.includes("kontakt")) return "kontaktbereich";
  if (normalized.includes("impressum")) return "impressum";
  if (normalized.includes("team") || normalized.includes("ansprechpartner")) return "team";
  if (normalized.includes("address")) return "address";
  return null;
}

function buildPainHypothesis(fields: string[], services: string[], fleet: number | null, locations: number | null, hasContact: boolean | string | null) {
  const domain = fields.find((field) => /spedition|transport|logistik|lager/i.test(field)) ?? services.find((service) => /transport|logistik|lager/i.test(service)) ?? fields[0] ?? services[0];
  if (!domain) return null;
  const complexity = [fleet ? "Fuhrpark" : null, locations ? "mehreren Standorten" : null, hasContact ? "öffentlichen Kontaktwegen" : null].filter(Boolean).join(", ");
  return `Als Unternehmen mit ${domain}${complexity ? ` und ${complexity}` : ""} entstehen wahrscheinlich manuelle Abstimmungen zwischen Auftragseingang, interner Koordination, Dokumenten und Statusrückfragen.`;
}

function scoreIcp(logisticsNear: boolean, fleet: number | null, locations: number | null, employees: number | null, hasContact: boolean, services: string[]) {
  return clampConfidence(
    (logisticsNear ? 45 : services.some((service) => /chemikalienhandel|lohnabfüllung|lager/i.test(service)) ? 25 : 0) +
    (fleet ? 15 : 0) +
    (locations && locations > 1 ? 15 : locations ? 8 : 0) +
    (employees && employees >= 10 ? 10 : 0) +
    (services.length >= 3 ? 10 : 0) +
    (hasContact ? 10 : 0)
  );
}

function icpLabel(score: number): "High" | "Medium" | "Low" {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function buildIcpReasoning(logisticsNear: boolean, fields: string[], services: string[], fleet: number | null, locations: number | null, hasContact: boolean, score: number) {
  const signals = [
    logisticsNear ? `logistiknahe Signale: ${fields.filter((field) => /spedition|transport|logistik|lager/i.test(field)).join(", ") || services.join(", ")}` : `keine klare klassische Spedition, aber operative Leistungen: ${services.join(", ") || fields.join(", ")}`,
    fleet ? `Fuhrparkzahl gefunden: ${fleet}` : null,
    locations ? `Standortzahl gefunden: ${locations}` : null,
    hasContact ? "Kontaktmöglichkeit vorhanden" : "keine klare Kontaktmöglichkeit gefunden",
    `Score ${score}/100 nach Tasklytic-ICP-Regeln`
  ].filter(Boolean);
  return signals.join("; ");
}

function buildCampaignSuggestion(logisticsNear: boolean, fields: string[], services: string[]) {
  if (logisticsNear) return "Prozessautomatisierung für Auftragsannahme, Disposition, Fahrerkommunikation, Dokumente und Statusrückfragen positionieren.";
  if (fields.includes("Chemikalienhandel") || services.includes("Chemikalienhandel")) return "Prozessautomatisierung für Chemiehandel, Lager, Abfüllung und Versandkoordination positionieren.";
  return "Prozessautomatisierung für wiederkehrende operative Abstimmungen und Dokumentenprozesse positionieren.";
}

function buildCompanySummary(name: string | null, industry: string | null, fields: string[], services: string[]) {
  const activities = uniqueStrings([...fields, ...services]).slice(0, 6);
  if (!activities.length) return null;
  return `${name ?? "Das Unternehmen"} ist im Bereich ${industry ?? activities[0]} tätig und bietet ${activities.join(", ")}.`;
}

function inferSpecialization(services: string[], fields: string[]) {
  if (services.includes("Chemikalienhandel")) return "Chemikalienhandel und damit verbundene operative Prozesse";
  if (services.some((service) => /transport|logistik/i.test(service))) return "Transport- und Logistikprozesse";
  return fields[0] ?? services[0] ?? null;
}

function apiIndependentConfidence(pages: PageFetchResult[], fields: string[], services: string[], email: string | null, phone: string | null) {
  return clampConfidence(35 + Math.min(pages.length, 8) * 4 + (fields.length ? 15 : 0) + (services.length ? 15 : 0) + (email ? 8 : 0) + (phone ? 8 : 0));
}

function bestSnippet(text: string, terms: string[]) {
  const clean = text.replace(/\s+/g, " ");
  const lower = clean.toLowerCase();
  const term = terms.filter(Boolean).find((item) => lower.includes(item.toLowerCase()));
  if (!term) return null;
  const index = Math.max(0, lower.indexOf(term.toLowerCase()));
  return clean.slice(Math.max(0, index - 80), Math.min(clean.length, index + 220)).trim();
}

function buildPainEvidence(analysis: EnrichmentAnalysis) {
  return [
    analysis.icpPain.directPainSignal ? { type: "directPainSignal", keyword: analysis.icpPain.painType ?? "Pain", source: findSourceUrl(analysis, "directPainSignal"), excerpt: analysis.icpPain.directPainSignal } : null,
    analysis.icpPain.inferredPainHypothesis ? { type: "inferredPainHypothesis", keyword: analysis.icpPain.painType ?? "Hypothese", source: findSourceUrl(analysis, "inferredPainHypothesis"), excerpt: analysis.icpPain.inferredPainHypothesis } : null,
    analysis.icpPain.reasoning ? { type: "icpReasoning", keyword: "ICP", source: findSourceUrl(analysis, "icpScore"), excerpt: analysis.icpPain.reasoning } : null
  ].filter(Boolean);
}

function findSourceUrl(analysis: EnrichmentAnalysis, field: string) {
  return analysis.sources[field]?.sourceUrl ?? Object.values(analysis.sources).find(Boolean)?.sourceUrl ?? "website";
}

function extractFirstNumber(value: string) {
  const number = value.match(/\b\d{1,5}\b/)?.[0];
  return number ? Number(number) : null;
}

function cleanString(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function withoutNullish<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined && entry !== "")) as Partial<T>;
}

function normalizeAscii(value: string) {
  return value.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatRole(role: string) {
  const normalized = normalizeAscii(role);
  if (normalized.includes("vertreten durch")) return "Geschäftsführung";
  if (normalized.includes("geschaeftsfuehrer") && normalized.includes("dispo")) return "Geschäftsführer & Dispo";
  if (normalized.includes("geschaeftsfuehrer")) return "Geschäftsführer";
  if (normalized.includes("geschaeftsfuehrung")) return "Geschäftsführung";
  if (normalized.includes("inhaber")) return "Inhaber";
  if (normalized.includes("vertrieb")) return "Vertrieb";
  if (normalized.includes("lademittelmanagement")) return "Lademittelmanagement";
  if (normalized.includes("disposition")) return "Disposition";
  if (normalized.includes("dispo")) return "Dispo";
  if (normalized.includes("leitung")) return "Leitung";
  return role
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join(" ")
    .replace(/\bDpf\b/g, "DPF");
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function numberNear(text: string, keyword: RegExp): number | null {
  const sentences = text.split(/[.!?\n]/).filter((sentence) => keyword.test(sentence));
  for (const sentence of sentences) {
    const match = sentence.match(/\b(\d{1,5})\b/);
    if (match) return Number(match[1]);
  }
  return null;
}

function clampConfidence(value: unknown): number {
  const number = typeof value === "number" ? value : 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function extractPhone(text: string): string | null {
  return text.match(/(?:\+49|0)\s?[\d\s()./-]{6,}/)?.[0]?.replace(/\s+/g, " ").trim() ?? null;
}

function extractPhoneNearName(text: string, name: string): string | null {
  const escapedName = escapeRegExp(name);
  const afterName = text.match(new RegExp(`${escapedName}([\\s\\S]{0,220})`, "i"))?.[1] ?? text;
  return extractPhone(afterName) ?? extractPhone(text);
}

function summarizeSource(sources: EnrichmentSource[]): string {
  const impressum = sources.find((source) => source.url.toLowerCase().includes("impressum"));
  if (impressum) return "impressum";
  const contact = sources.find((source) => source.url.toLowerCase().includes("kontakt"));
  if (contact) return "website";
  return sources.length > 0 ? "website" : "unknown";
}

function enrichmentStatusFromSuggestions(suggestions: StructuredEnrichmentSuggestions, pagesScanned: number): "enriched" | "partial" | "failed" {
  if (pagesScanned === 0) return "failed";
  const count = Object.keys(suggestions).length;
  if (count === 0) return "partial";
  return Object.values(suggestions).every((suggestion) => suggestion.confidence >= 80) ? "enriched" : "partial";
}

function readStructuredSuggestions(value: unknown): StructuredEnrichmentSuggestions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as StructuredEnrichmentSuggestions;
}

function sameSuggestionValue(current: unknown, suggestion: unknown) {
  return JSON.stringify(normalizeComparable(current)) === JSON.stringify(normalizeComparable(suggestion));
}

function normalizeComparable(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  return value;
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
