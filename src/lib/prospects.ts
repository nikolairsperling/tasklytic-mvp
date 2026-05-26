import { z } from "zod";
import { isProspectStatus, prospectStatuses, type ProspectStatus } from "@/lib/prospect-status";

const urlField = z
  .union([z.string().trim().url(), z.literal(""), z.undefined()])
  .transform((value) => value || undefined);

const optionalTextField = z
  .union([z.string().trim(), z.literal(""), z.undefined()])
  .transform((value) => value || undefined);

const optionalNumberField = z
  .union([z.coerce.number().int().nonnegative(), z.literal(""), z.undefined()])
  .transform((value) => (value === "" || value === undefined ? undefined : value));

const optionalBooleanField = z
  .union([z.boolean(), z.string(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    return normalizeBoolean(value);
  });

const booleanField = z.union([z.boolean(), z.string()]).transform((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  return normalizeBoolean(value);
});

export const prospectInputSchema = z.object({
  companyName: z.string().trim().min(1),
  landingpageTemplateId: optionalTextField,
  legalName: optionalTextField,
  websiteUrl: urlField,
  city: optionalTextField.default(""),
  postalCode: optionalTextField,
  street: optionalTextField,
  phone: optionalTextField,
  companyEmail: z
    .union([z.string().email(), z.literal(""), z.undefined()])
    .transform((value) => value || undefined),
  state: optionalTextField,
  country: z.string().trim().min(2).default("DE"),
  companyStatus: z.enum(["active", "inactive", "unclear", "unreachable"]).optional().default("unclear"),
  employeeRange: optionalTextField,
  employeeCount: optionalNumberField,
  vehicleCount: optionalNumberField,
  trailerCount: optionalNumberField,
  locationsCount: optionalNumberField,
  businessFields: z
    .union([z.array(z.string()), z.string(), z.undefined()])
    .transform((value) =>
      value === undefined
        ? []
        : Array.isArray(value)
        ? value
        : value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
    ),
  isFamilyOwned: optionalBooleanField,
  decisionMakerName: optionalTextField,
  decisionMakerRole: optionalTextField,
  decisionMakerEmail: z
    .union([z.string().email(), z.literal(""), z.undefined()])
    .transform((value) => value || undefined),
  salutation: optionalTextField,
  firstName: optionalTextField,
  lastName: optionalTextField,
  linkedinUrl: urlField,
  openDispatcherJob: booleanField.default(false),
  jobUrl: urlField,
  jobSignalText: optionalTextField,
  fleetSignalText: optionalTextField,
  locationSignalText: optionalTextField,
  contactStructureSignalText: optionalTextField,
  websiteMaturitySignal: optionalTextField,
  videoUrl: urlField,
  calendarUrl: urlField,
  bookingUrl: urlField,
  customPainPoint: optionalTextField,
  customHeroHeadline: optionalTextField,
  customHeroSubline: optionalTextField,
  customHeroBodyText: optionalTextField,
  customHeroCtaText: optionalTextField,
  customHeroCtaUrl: urlField,
  personalVideoUrl: urlField,
  personalVideoThumbnailUrl: urlField,
  personalVideoScript: optionalTextField,
  personalVideoStatus: z.enum(["none", "pending", "script_ready", "processing", "ready", "failed"]).optional().default("none"),
  personalVideoProvider: optionalTextField,
  personalVideoJobId: optionalTextField,
  personalVideoError: optionalTextField,
  explainerVideoUrl: urlField,
  individualCtaText: optionalTextField,
  icpScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  icpFitScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  timingScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  painScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  fitScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  icpCategory: optionalTextField.default("low"),
  painSignals: z.unknown().optional().default([]),
  isHotLead: z.boolean().optional().default(false),
  contactQualityScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  totalScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  leadStatus: optionalTextField.default("open"),
  followUpAt: z
    .union([z.coerce.date(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value === "" || value === null ? undefined : value)),
  assignedTo: optionalTextField,
  showInCrm: optionalBooleanField.default(true),
  source: optionalTextField,
  status: z.enum(prospectStatuses).optional().default("draft"),
  slug: optionalTextField
});

export type ProspectInput = z.infer<typeof prospectInputSchema>;

export function parseProspectPayload(payload: unknown): ProspectInput {
  const parsed = prospectInputSchema.parse(payload);
  return applyNameParts(parsed);
}

export function normalizeBoolean(value: string): boolean {
  return ["true", "1", "yes", "ja"].includes(value.trim().toLowerCase());
}

export function serializeStatus(status?: string): ProspectStatus {
  if (status && isProspectStatus(status)) {
    return status;
  }

  return "draft";
}

export function splitDecisionMakerName(name: string | null | undefined): { firstName?: string; lastName?: string } {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined
  };
}

export function composeDecisionMakerName(firstName?: string | null, lastName?: string | null): string | undefined {
  const fullName = [firstName, lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || undefined;
}

export function hasProspectContactPerson(prospect: Partial<ProspectInput>): boolean {
  const hasFullName = Boolean(prospect.decisionMakerName || composeDecisionMakerName(prospect.firstName, prospect.lastName));
  return Boolean(hasFullName && prospect.decisionMakerRole);
}

function applyNameParts(input: ProspectInput): ProspectInput {
  const composedName = composeDecisionMakerName(input.firstName, input.lastName);
  const decisionMakerName = input.decisionMakerName ?? composedName;

  if (!decisionMakerName) return input;

  const parts = splitDecisionMakerName(decisionMakerName);
  return {
    ...input,
    decisionMakerName,
    firstName: input.firstName ?? parts.firstName,
    lastName: input.lastName ?? parts.lastName
  };
}
