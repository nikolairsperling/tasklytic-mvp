import type { ProspectInput } from "@/lib/prospects";
import { composeDecisionMakerName, hasProspectContactPerson } from "@/lib/prospects";

export type ProspectScores = {
  icpScore: number;
  icpFitScore: number;
  timingScore: number;
  painScore: number;
  fitScore: number;
  icpCategory: string;
  painSignals: PainSignal[];
  isHotLead: boolean;
  contactQualityScore: number;
  totalScore: number;
};

export type PainSignalType =
  | "recruiting"
  | "fleet_size"
  | "online_request"
  | "outdated_website"
  | "contact_visibility";

export type PainSignal = {
  type: PainSignalType;
  label: string;
  strength: number;
};

export type ScoreOfferContext = {
  targetAudienceDescription?: string | null;
  coreProblems?: unknown;
  serviceDescription?: string | null;
};

const logisticsIndustryPattern = /logistik|spedition|transport|fracht|dispo|warehousing|fulfillment/i;
const recruitingPattern = /fahrer\s*gesucht|fahrer gesucht|fahrer\/in|lkw fahrer|kraftfahrer|disponent gesucht|mitarbeiter gesucht|personal gesucht|stellenangebot|karriere/i;
const onlineRequestPattern = /kein formular|kontaktformular fehlt|online[- ]?anfrage fehlt|keine online[- ]?anfrage|nur telefonisch|telefonisch erreichbar|anfrage nur per telefon|nur telefonnummer sichtbar|telefonnummer sichtbar/i;
const outdatedWebsitePattern = /veraltet|altmodisch|nicht responsiv|responsive fehlt|modernisierungsbedarf|outdated|jahr 20\d{2}|flash|frames?/i;
const fleetPattern = /fuhrpark|fahrzeuge|lkw|trailer|flotte|viele fahrzeuge/i;
const contactVisibilityPattern = /nur telefonisch|nur telefon|telefonnummer sichtbar|keine e[- ]?mail|email fehlt|kontakt nur per telefon/i;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rangeMatches(value: string | null | undefined, min: number, max: number): boolean {
  if (!value) return false;
  const digits = value.match(/\d+/g)?.map(Number) ?? [];
  if (digits.length === 0) return false;
  const lower = digits[0];
  const upper = digits[1] ?? digits[0];
  return lower <= max && upper >= min;
}

function hasLogisticsSignal(prospect: Partial<ProspectInput>, offer?: ScoreOfferContext): boolean {
  const haystack = [
    prospect.companyName,
    prospect.legalName,
    prospect.decisionMakerRole,
    ...(prospect.businessFields ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return logisticsIndustryPattern.test(haystack) || offerAudienceMatches(haystack, offer);
}

function normalizeFieldText(...values: Array<string | null | undefined>): string {
  return values.filter(Boolean).join(" ").toLowerCase();
}

export function calculateProspectScore(prospect: Partial<ProspectInput>, offer?: ScoreOfferContext): ProspectScores {
  const normalizedDecisionMakerName = prospect.decisionMakerName ?? composeDecisionMakerName(prospect.firstName, prospect.lastName);

  const hasIndustryFit = hasLogisticsSignal(prospect, offer);
  const hasWebsite = Boolean(prospect.websiteUrl);
  const hasEmployeeInfo = Boolean(prospect.employeeCount || prospect.employeeRange);
  const hasContactPerson = hasProspectContactPerson({
    ...prospect,
    decisionMakerName: normalizedDecisionMakerName
  });
  const hasEmail = Boolean(prospect.decisionMakerEmail || prospect.companyEmail);

  let icpScore = 0;
  if (hasIndustryFit) icpScore += 45;
  if (hasWebsite) icpScore += 15;
  if (hasEmployeeInfo) icpScore += 15;
  if (hasContactPerson) icpScore += 15;
  if (hasEmail) icpScore += 10;

  if (prospect.companyStatus === "active") icpScore += 5;
  else if (prospect.companyStatus === "unclear") icpScore += 3;

  if (prospect.vehicleCount !== undefined) {
    if (prospect.vehicleCount >= 10 && prospect.vehicleCount <= 80) icpScore += 5;
    else if (prospect.vehicleCount > 80) icpScore += 3;
  }

  if (rangeMatches(prospect.employeeRange, 10, 250)) {
    icpScore += 5;
  }

  const painSignals = detectPainSignals(prospect, offer);
  let timingScore = 0;
  if (prospect.openDispatcherJob) timingScore += 40;
  if (prospect.jobSignalText) timingScore += 15;
  if (prospect.websiteMaturitySignal && outdatedWebsitePattern.test(prospect.websiteMaturitySignal)) timingScore += 10;

  let contactQualityScore = 0;
  if (prospect.decisionMakerEmail) {
    contactQualityScore += prospect.decisionMakerEmail.toLowerCase().startsWith("info@") ? 10 : 50;
  }
  if (normalizedDecisionMakerName) contactQualityScore += 15;
  if (prospect.linkedinUrl) contactQualityScore += 10;
  if (prospect.decisionMakerRole) contactQualityScore += 10;

  const painScore = clampScore(
    painSignals.reduce((sum, signal) => sum + signal.strength, 0) +
      (prospect.vehicleCount && prospect.vehicleCount >= 20 ? 10 : 0) +
      (prospect.locationsCount && prospect.locationsCount > 1 ? 10 : 0)
  );

  const normalizedIcpScore = clampScore(icpScore);
  const fitScore = clampScore((normalizedIcpScore + painScore) / 2);
  const icpCategory = fitScore > 70 ? "hot" : fitScore >= 40 ? "medium" : "low";
  const totalScore = fitScore;

  return {
    icpScore: normalizedIcpScore,
    icpFitScore: normalizedIcpScore,
    timingScore: clampScore(timingScore),
    painScore,
    fitScore,
    icpCategory,
    painSignals,
    isHotLead: fitScore > 70,
    contactQualityScore: clampScore(contactQualityScore),
    totalScore
  };
}

export function detectPainSignals(prospect: Partial<ProspectInput>, offer?: ScoreOfferContext): PainSignal[] {
  const text = normalizeFieldText(
    prospect.jobSignalText,
    prospect.fleetSignalText,
    prospect.locationSignalText,
    prospect.contactStructureSignalText,
    prospect.websiteMaturitySignal,
    prospect.customPainPoint,
    prospect.companyName,
    prospect.businessFields?.join(" ")
  );
  const signals: PainSignal[] = [];

  if (prospect.openDispatcherJob || recruitingPattern.test(text)) {
    signals.push({ type: "recruiting", label: "Fahrer oder Disponent gesucht", strength: 30 });
  }
  if ((prospect.vehicleCount ?? 0) >= 20 || fleetPattern.test(text)) {
    signals.push({ type: "fleet_size", label: "Großer Fuhrpark", strength: 20 });
  }
  if (onlineRequestPattern.test(text)) {
    signals.push({ type: "online_request", label: "Keine Online-Anfrage sichtbar", strength: 22 });
  }
  if (outdatedWebsitePattern.test(text)) {
    signals.push({ type: "outdated_website", label: "Veraltete Website", strength: 22 });
  }
  if (contactVisibilityPattern.test(text)) {
    signals.push({ type: "contact_visibility", label: "Nur Telefon sichtbar", strength: 16 });
  }
  const offerProblem = matchingOfferProblem(text, offer);
  if (offerProblem) {
    signals.push({ type: "online_request", label: offerProblem, strength: 18 });
  }

  return signals;
}

function offerAudienceMatches(haystack: string, offer?: ScoreOfferContext) {
  return offerTokens(offer?.targetAudienceDescription).some((token) => haystack.includes(token));
}

function matchingOfferProblem(haystack: string, offer?: ScoreOfferContext) {
  return offerList(offer?.coreProblems).find((problem) =>
    offerTokens(problem).some((token) => haystack.includes(token))
  );
}

function offerList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
  return [];
}

function offerTokens(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 5);
}
