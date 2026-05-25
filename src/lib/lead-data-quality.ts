export type LeadContactCandidate = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  sourceUrl?: string | null;
  sourceArea?: string | null;
  score?: number;
  confidenceLabel?: "high" | "medium" | "low" | string | null;
  selectedAsPrimary?: boolean;
};

export type LeadQualityProspect = {
  companyName: string;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string | null;
  street?: string | null;
  industry?: string | null;
  businessFields?: string[] | null;
  services?: unknown;
  companyDescription?: string | null;
  companyProfileSummary?: string | null;
  painSummary?: string | null;
  painType?: string | null;
  painEvidence?: unknown;
  painSignals?: unknown;
  manualProcessSignal?: boolean | null;
  digitalWeaknessSignal?: boolean | null;
  hiringSignal?: boolean | null;
  growthSignal?: boolean | null;
  researchSources?: unknown;
  sourceUrl?: string | null;
  websiteUrl?: string | null;
  contactCandidates?: unknown;
  decisionMakerName?: string | null;
  decisionMakerRole?: string | null;
  decisionMakerEmail?: string | null;
  decisionMakerPhone?: string | null;
  decisionMakerConfidence?: string | null;
  slug?: string | null;
  landingpageUrl?: string | null;
};

const firstTwoDigitState: Record<number, string> = {
  1: "Sachsen",
  2: "Sachsen",
  3: "Sachsen",
  4: "Sachsen",
  6: "Sachsen-Anhalt",
  7: "Thüringen",
  8: "Thüringen",
  9: "Thüringen",
  10: "Berlin",
  11: "Berlin",
  12: "Berlin",
  13: "Berlin",
  14: "Brandenburg",
  15: "Brandenburg",
  16: "Brandenburg",
  17: "Mecklenburg-Vorpommern",
  18: "Mecklenburg-Vorpommern",
  19: "Mecklenburg-Vorpommern",
  20: "Hamburg",
  21: "Hamburg",
  22: "Hamburg",
  23: "Schleswig-Holstein",
  24: "Schleswig-Holstein",
  25: "Schleswig-Holstein",
  26: "Niedersachsen",
  27: "Niedersachsen",
  28: "Bremen",
  29: "Niedersachsen",
  30: "Niedersachsen",
  31: "Niedersachsen",
  32: "Nordrhein-Westfalen",
  33: "Nordrhein-Westfalen",
  34: "Hessen",
  35: "Hessen",
  36: "Hessen",
  37: "Niedersachsen",
  38: "Niedersachsen",
  39: "Sachsen-Anhalt",
  40: "Nordrhein-Westfalen",
  41: "Nordrhein-Westfalen",
  42: "Nordrhein-Westfalen",
  44: "Nordrhein-Westfalen",
  45: "Nordrhein-Westfalen",
  46: "Nordrhein-Westfalen",
  47: "Nordrhein-Westfalen",
  48: "Nordrhein-Westfalen",
  49: "Niedersachsen",
  50: "Nordrhein-Westfalen",
  51: "Nordrhein-Westfalen",
  52: "Nordrhein-Westfalen",
  53: "Nordrhein-Westfalen",
  54: "Rheinland-Pfalz",
  55: "Rheinland-Pfalz",
  56: "Rheinland-Pfalz",
  57: "Nordrhein-Westfalen",
  58: "Nordrhein-Westfalen",
  59: "Nordrhein-Westfalen",
  60: "Hessen",
  61: "Hessen",
  62: "Hessen",
  63: "Hessen",
  64: "Hessen",
  65: "Hessen",
  66: "Saarland",
  67: "Rheinland-Pfalz",
  68: "Baden-Württemberg",
  69: "Baden-Württemberg",
  70: "Baden-Württemberg",
  71: "Baden-Württemberg",
  72: "Baden-Württemberg",
  73: "Baden-Württemberg",
  74: "Baden-Württemberg",
  75: "Baden-Württemberg",
  76: "Baden-Württemberg",
  77: "Baden-Württemberg",
  78: "Baden-Württemberg",
  79: "Baden-Württemberg",
  80: "Bayern",
  81: "Bayern",
  82: "Bayern",
  83: "Bayern",
  84: "Bayern",
  85: "Bayern",
  86: "Bayern",
  87: "Bayern",
  88: "Baden-Württemberg",
  89: "Bayern",
  90: "Bayern",
  91: "Bayern",
  92: "Bayern",
  93: "Bayern",
  94: "Bayern",
  95: "Bayern",
  96: "Bayern",
  97: "Bayern",
  98: "Thüringen",
  99: "Thüringen"
};

const navigationTerms = [
  "home",
  "startseite",
  "über uns",
  "ueber uns",
  "kontakt",
  "impressum",
  "datenschutz",
  "agb",
  "cookie",
  "cookies",
  "deutsch",
  "english",
  "sprache",
  "navigation",
  "menü",
  "menu",
  "login",
  "sitemap",
  "google analytics",
  "tracking",
  "akzeptieren",
  "ablehnen"
];

const genericEmailPrefixes = /^(info|kontakt|contact|office|service|zentrale|verwaltung|disposition|bewerbung|jobs|karriere|sales|vertrieb)@/i;

export function stateFromGermanPostalCode(postalCode: string | null | undefined) {
  const match = postalCode?.match(/\b(\d{5})\b/);
  if (!match) return null;
  const prefix = Number(match[1].slice(0, 2));
  return firstTwoDigitState[prefix] ?? null;
}

export function cleanLeadText(value: string | null | undefined, maxSentences = 5) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const navHits = navigationTerms.filter((term) => lower.includes(term)).length;
  const looksLikeMenu = navHits >= 4 || /\b(home|kontakt|impressum|datenschutz)\b.*\b(home|kontakt|impressum|datenschutz)\b/i.test(text);
  if (looksLikeMenu && text.length > 80) return null;
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && navigationTerms.filter((term) => sentence.toLowerCase().includes(term)).length < 3);
  return (sentences.length ? sentences : [text]).slice(0, maxSentences).join(" ");
}

export function contactCandidatesFromPossiblyMergedName(name: string | null | undefined): LeadContactCandidate[] {
  const clean = name?.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.split(" ");
  if (parts.length === 2 && isPersonName(clean)) return [candidateFromParts(parts[0], parts[1], "high")];
  if (parts.length === 3 && parts.every(isNamePart)) {
    const [first, likelyLast, secondFirst] = parts;
    return uniqueCandidates([
      candidateFromParts(first, likelyLast, "medium"),
      candidateFromParts(secondFirst, likelyLast, "medium")
    ]);
  }
  return [];
}

export function normalizeLeadContactCandidates(value: unknown, fallbackName?: string | null): LeadContactCandidate[] {
  const raw = Array.isArray(value) ? value : [];
  const candidates = raw
    .map((entry) => normalizeCandidate(entry))
    .filter((candidate): candidate is LeadContactCandidate => Boolean(candidate?.fullName && isPersonName(candidate.fullName)));
  return uniqueCandidates([...candidates, ...contactCandidatesFromPossiblyMergedName(fallbackName)]);
}

export function getReliablePrimaryContact(prospect: LeadQualityProspect) {
  const direct = prospect.decisionMakerName?.trim();
  const directIsReliable = direct && isPersonName(direct) && !looksLikeAmbiguousMergedName(direct);
  if (directIsReliable) {
    return {
      fullName: direct,
      role: prospect.decisionMakerRole,
      email: prospect.decisionMakerEmail,
      phone: prospect.decisionMakerPhone,
      confidenceLabel: prospect.decisionMakerConfidence ?? (prospect.decisionMakerEmail && !genericEmailPrefixes.test(prospect.decisionMakerEmail) ? "high" : "medium")
    };
  }
  return null;
}

export function buildCompanyDescription(prospect: LeadQualityProspect) {
  const existing = cleanLeadText(prospect.companyDescription, 2);
  if (existing && !isWeakCompanyDescription(existing)) return existing;
  const fields = [
    prospect.industry,
    ...safeStringArray(prospect.businessFields),
    ...safeStringArray(prospect.services)
  ].filter((field): field is string => Boolean(field));
  const serviceText = uniqueStrings(fields).slice(0, 5).join(", ");
  const location = [prospect.city, prospect.state].filter(Boolean).join(", ");
  if (serviceText) {
    return `${prospect.companyName} ist ein ${/logistik|spedition|transport/i.test(serviceText) ? "Logistikunternehmen" : "B2B-Unternehmen"}${location ? ` aus ${location}` : ""} mit Fokus auf ${serviceText}.`;
  }
  return existing ?? `${prospect.companyName}${location ? ` aus ${location}` : ""} konnte noch nicht eindeutig beschrieben werden.`;
}

export function buildPainHypothesis(prospect: LeadQualityProspect) {
  const existing = cleanLeadText(prospect.painSummary, 4);
  if (existing) return existing;
  const fields = uniqueStrings([prospect.industry, ...safeStringArray(prospect.businessFields), ...safeStringArray(prospect.services)].filter(Boolean) as string[]);
  const process = /logistik|spedition|transport|lager|fracht/i.test(fields.join(" "))
    ? "Anfragen, Disposition, Statusrückfragen und Dokumentenprozesse"
    : "wiederkehrende Kunden-, Backoffice- und Angebotsprozesse";
  const evidence = [
    prospect.manualProcessSignal ? "manuelle Prozesssignale" : null,
    prospect.digitalWeaknessSignal ? "digitale Reibungspunkte" : null,
    prospect.hiringSignal ? "Personal- oder Kapazitätssignale" : null,
    prospect.websiteUrl ? "öffentliche Website-Daten" : null
  ].filter(Boolean).join(", ");
  return `Hypothese: Bei ${prospect.companyName} könnten ${process} noch teilweise manuell laufen. Tasklytic passt, wenn operative Teams wiederkehrende Abstimmungen automatisieren und schneller auf Anfragen reagieren sollen.${evidence ? ` Hinweise: ${evidence}.` : ""}`;
}

export function buildStructuredLeadInsights(prospect: LeadQualityProspect) {
  const sources = extractSources(prospect.researchSources, prospect.sourceUrl, prospect.websiteUrl);
  const relevantSignals = uniqueStrings([
    prospect.industry ? `Branche: ${prospect.industry}` : null,
    ...safeStringArray(prospect.businessFields).slice(0, 4).map((field) => `Geschäftsfeld: ${field}`),
    ...safeStringArray(prospect.services).slice(0, 4).map((service) => `Leistung: ${service}`),
    prospect.manualProcessSignal ? "Manuelle Prozesssignale erkannt" : null,
    prospect.digitalWeaknessSignal ? "Digitale Schwäche/Reibung möglich" : null,
    prospect.hiringSignal ? "Personal-/Kapazitätssignal erkannt" : null
  ].filter(Boolean) as string[]);
  return {
    relevantSignals: relevantSignals.length ? relevantSignals : ["Noch wenige belastbare Signale vorhanden."],
    possiblePainPoints: [buildPainHypothesis(prospect)],
    tasklyticFit: [
      "Tasklytic passt, wenn wiederkehrende Backoffice-, Anfrage- oder Abstimmungsprozesse automatisiert werden sollen.",
      "Der Ansatz ist besonders relevant für operative B2B-Teams mit hoher Kommunikations- und Dokumentenlast."
    ],
    sources: sources.length ? sources : ["Keine technische Quelle hinterlegt."],
    uncertainty: getLeadDataQuality(prospect).pain === "niedrig"
      ? "Niedrigere Sicherheit: Es fehlen klare Quellen oder konkrete Prozesssignale."
      : "Mittlere Sicherheit: Hypothese basiert auf angereicherten Firmen- und Website-Signalen."
  };
}

export function getLeadDataQuality(prospect: LeadQualityProspect) {
  const candidates = normalizeLeadContactCandidates(prospect.contactCandidates, prospect.decisionMakerName);
  const contact = getReliablePrimaryContact(prospect);
  const hasSources = extractSources(prospect.researchSources, prospect.sourceUrl, prospect.websiteUrl).length > 0;
  const painText = cleanLeadText(prospect.painSummary, 4);
  return {
    contact: contact ? "sicher" : candidates.length > 0 ? "unsicher" : "fehlt",
    pain: painText && hasSources ? "mittel" : painText ? "niedrig" : "fehlt",
    sources: hasSources ? "vorhanden" : "fehlt",
    landingpage: prospect.slug || prospect.landingpageUrl ? "bereit" : "unvollständig"
  };
}

export function looksLikeAmbiguousMergedName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length === 3 && parts.every(isNamePart);
}

function normalizeCandidate(value: unknown): LeadContactCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const fullName = stringValue(record.fullName) ?? stringValue(record.name);
  if (!fullName) return null;
  const [firstName, ...lastParts] = fullName.split(/\s+/);
  return {
    fullName,
    firstName: stringValue(record.firstName) ?? firstName,
    lastName: stringValue(record.lastName) ?? lastParts.join(" "),
    role: stringValue(record.role),
    email: stringValue(record.email) ?? stringValue(record.personalEmail),
    phone: stringValue(record.phone) ?? stringValue(record.personalPhone),
    sourceUrl: stringValue(record.sourceUrl),
    sourceArea: stringValue(record.sourceArea),
    score: typeof record.score === "number" ? record.score : undefined,
    confidenceLabel: stringValue(record.confidenceLabel) ?? stringValue(record.decisionMakerConfidence),
    selectedAsPrimary: typeof record.selectedAsPrimary === "boolean" ? record.selectedAsPrimary : undefined
  };
}

function candidateFromParts(firstName: string, lastName: string, confidenceLabel: string): LeadContactCandidate {
  return {
    fullName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    confidenceLabel,
    score: confidenceLabel === "high" ? 90 : 62
  };
}

function isPersonName(value: string) {
  const parts = value.trim().split(/\s+/);
  return parts.length >= 2 && parts.length <= 3 && parts.every(isNamePart);
}

function isNamePart(value: string) {
  return /^[A-ZÄÖÜ][a-zäöüß-]{1,}$/.test(value);
}

function isWeakCompanyDescription(value: string) {
  return value.length < 45 || /nicht gefunden|unternehmen aus|dienstleistungen/i.test(value) && value.length < 80;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function extractSources(value: unknown, sourceUrl?: string | null, websiteUrl?: string | null) {
  const sources: string[] = [];
  if (sourceUrl) sources.push(sourceUrl);
  if (websiteUrl) sources.push(websiteUrl);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const pages = (value as { pages?: unknown }).pages;
    if (Array.isArray(pages)) {
      for (const page of pages.slice(0, 5)) {
        if (page && typeof page === "object") {
          const url = stringValue((page as Record<string, unknown>).url);
          if (url) sources.push(url);
        }
      }
    }
  }
  return uniqueStrings(sources);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueCandidates(candidates: LeadContactCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.fullName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
