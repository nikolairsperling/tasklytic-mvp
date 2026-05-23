import { NextResponse } from "next/server";
import type { Prisma, Prospect } from "@prisma/client";
import { z } from "zod";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { ProspectInput } from "@/lib/prospects";
import { parseProspectPayload } from "@/lib/prospects";
import { prospectStatuses } from "@/lib/prospect-status";
import { calculateProspectScore } from "@/lib/scoring";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const editableProspectFields = [
  "salutation",
  "firstName",
  "lastName",
  "decisionMakerName",
  "decisionMakerRole",
  "decisionMakerEmail",
  "decisionMakerPhone",
  "decisionMakerSourceUrl",
  "decisionMakerConfidence",
  "companyEmail",
  "companyPhone",
  "contactPageUrl",
  "generalContactLabel",
  "phone",
  "linkedinUrl",
  "companyName",
  "legalName",
  "websiteUrl",
  "city",
  "postalCode",
  "street",
  "state",
  "country",
  "employeeRange",
  "employeeCount",
  "vehicleCount",
  "trailerCount",
  "locationsCount",
  "businessFields",
  "companyStatus",
  "painType",
  "painSummary",
  "customPainPoint",
  "icpScore",
  "notes",
  "status",
  "leadStatus",
  "followUpAt",
  "followUpReason",
  "followUpStatus",
  "assignedTo",
  "showInCrm",
  "source",
  "targetGroupId",
  "suggestedOfferId"
] as const;

const editableProspectFieldSet = new Set<string>(editableProspectFields);
const legacyProspectFieldSet = new Set<string>([
  ...editableProspectFields,
  "landingpageTemplateId",
  "isFamilyOwned",
  "openDispatcherJob",
  "jobUrl",
  "jobSignalText",
  "fleetSignalText",
  "locationSignalText",
  "contactStructureSignalText",
  "websiteMaturitySignal",
  "videoUrl",
  "calendarUrl",
  "bookingUrl",
  "customHeroHeadline",
  "customHeroSubline",
  "customHeroBodyText",
  "customHeroCtaText",
  "customHeroCtaUrl",
  "personalVideoUrl",
  "personalVideoThumbnailUrl",
  "personalVideoScript",
  "personalVideoStatus",
  "personalVideoProvider",
  "personalVideoJobId",
  "personalVideoError",
  "explainerVideoUrl",
  "individualCtaText",
  "icpFitScore",
  "icpFitLabel",
  "industry",
  "timingScore",
  "painScore",
  "painType",
  "painSummary",
  "painEvidence",
  "personalizationAngle",
  "researchStatus",
  "researchSources",
  "researchedAt",
  "companyDescription",
  "services",
  "companySizeLabel",
  "employeeCountEstimate",
  "fleetSizeEstimate",
  "specialization",
  "targetCustomers",
  "companyProfileSummary",
  "fitScore",
  "icpCategory",
  "painSignals",
  "isHotLead",
  "contactQualityScore",
  "totalScore",
  "slug"
]);

const nullableText = z.union([z.string(), z.null()]).transform((value) => {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
});

const requiredText = z.string().trim().min(1);
const nullableEmail = nullableText.refine((value) => value === null || z.string().email().safeParse(value).success, "Ungültige E-Mail-Adresse");
const nullableInt = z.union([z.coerce.number().int().nonnegative(), z.literal(""), z.null()]).transform((value) => value === "" ? null : value);
const nullableScore = z.union([z.coerce.number().int().min(0).max(100), z.literal(""), z.null()]).transform((value) => value === "" ? null : value);
const nullableUrl = nullableText.transform((value, context) => {
  if (value === null) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültige URL" });
      return z.NEVER;
    }
    return url.toString();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültige URL" });
    return z.NEVER;
  }
});

const manualPatchSchema = z.object({
  salutation: nullableText.optional(),
  firstName: nullableText.optional(),
  lastName: nullableText.optional(),
  decisionMakerName: nullableText.optional(),
  decisionMakerRole: nullableText.optional(),
  decisionMakerEmail: nullableEmail.optional(),
  decisionMakerPhone: nullableText.optional(),
  decisionMakerSourceUrl: nullableUrl.optional(),
  decisionMakerConfidence: z.enum(["high", "medium", "low"]).nullable().optional(),
  companyEmail: nullableEmail.optional(),
  companyPhone: nullableText.optional(),
  contactPageUrl: nullableUrl.optional(),
  generalContactLabel: nullableText.optional(),
  phone: nullableText.optional(),
  linkedinUrl: nullableUrl.optional(),
  companyName: requiredText.optional(),
  legalName: nullableText.optional(),
  websiteUrl: nullableUrl.optional(),
  city: requiredText.optional(),
  postalCode: nullableText.optional(),
  street: nullableText.optional(),
  state: nullableText.optional(),
  country: requiredText.optional(),
  employeeRange: nullableText.optional(),
  employeeCount: nullableInt.optional(),
  vehicleCount: nullableInt.optional(),
  trailerCount: nullableInt.optional(),
  locationsCount: nullableInt.optional(),
  businessFields: z.union([z.array(z.string()), z.string(), z.null()]).transform((value) => {
    if (value === null) return [];
    const entries = Array.isArray(value) ? value : value.split(",");
    return entries.map((entry) => entry.trim()).filter(Boolean);
  }).optional(),
  companyStatus: z.enum(["active", "inactive", "unclear", "unreachable"]).optional(),
  painType: nullableText.optional(),
  painSummary: nullableText.optional(),
  customPainPoint: nullableText.optional(),
  icpScore: nullableScore.optional(),
  notes: nullableText.optional(),
  status: z.enum(prospectStatuses).optional(),
  leadStatus: z.enum(["open", "in_progress", "interested", "not_interested", "meeting", "customer"]).optional(),
  followUpAt: z.union([z.string().datetime(), z.literal(""), z.null()]).transform((value) => value ? new Date(value) : null).optional(),
  followUpReason: nullableText.optional(),
  followUpStatus: z.enum(["open", "done", "snoozed", "dismissed"]).optional(),
  assignedTo: nullableText.optional(),
  showInCrm: z.boolean().optional(),
  source: nullableText.optional(),
  targetGroupId: nullableText.optional(),
  suggestedOfferId: nullableText.optional()
}).strict();

const prospectDetailInclude = {
  notes: { orderBy: { createdAt: "desc" } },
  events: { orderBy: { createdAt: "desc" }, take: 100 },
  campaignEnrollments: {
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, name: true, status: true, offerId: true, targetGroupId: true, offer: { select: { id: true, name: true } } } }
    }
  },
  targetGroup: { select: { id: true, name: true } },
  suggestedOffer: { select: { id: true, name: true } }
} satisfies Prisma.ProspectInclude;

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: prospectDetailInclude
    });

    if (!prospect) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(prospect);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Prospect konnte nicht geladen werden.") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = await request.json();
    const current = await prisma.prospect.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    const bodyRecord = assertOnlyAllowedFields(body);
    const hasLegacyFields = Object.keys(bodyRecord).some((key) => !editableProspectFieldSet.has(key));
    if (hasLegacyFields) {
      const data = buildLegacyProspectUpdate(bodyRecord, current);
      const prospect = await prisma.prospect.update({ where: { id }, data });
      return NextResponse.json(prospect);
    }

    const parsedPatch = manualPatchSchema.parse(bodyRecord);
    const noteText = "notes" in parsedPatch ? parsedPatch.notes : undefined;
    const data = buildManualProspectUpdate(parsedPatch, current);
    await prisma.prospect.update({
      where: { id },
      data
    });
    if (noteText) {
      await prisma.prospectNote.create({ data: { prospectId: id, text: noteText } });
    }
    const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id }, include: prospectDetailInclude });

    return NextResponse.json(prospect);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: getErrorMessage(error, "Aktualisierung fehlgeschlagen")
      },
      { status: 400 }
    );
  }
}

function assertOnlyAllowedFields(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Ungültiger Request Body");
  }

  const bodyRecord = body as Record<string, unknown>;
  const unknownKeys = Object.keys(bodyRecord).filter((key) => !legacyProspectFieldSet.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Feld nicht erlaubt: ${unknownKeys.join(", ")}`);
  }
  return bodyRecord;
}

function buildLegacyProspectUpdate(body: Record<string, unknown>, current: Prospect): Prisma.ProspectUncheckedUpdateInput {
  const parsedPayload = parseProspectPayload(body);
  const payload = {
    ...parsedPayload,
    leadStatus: "leadStatus" in body ? parsedPayload.leadStatus : current.leadStatus,
    followUpAt: "followUpAt" in body ? parsedPayload.followUpAt : current.followUpAt ?? undefined,
    assignedTo: "assignedTo" in body ? parsedPayload.assignedTo : current.assignedTo ?? undefined,
    showInCrm: "showInCrm" in body ? parsedPayload.showInCrm : current.showInCrm,
    source: "source" in body ? parsedPayload.source : current.source ?? undefined,
    salutation: "salutation" in body ? parsedPayload.salutation : current.salutation ?? undefined
  };
  const scoreInput = {
    ...current,
    ...payload,
    slug: current.slug ?? undefined,
    landingpageTemplateId: current.landingpageTemplateId ?? undefined,
    legalName: current.legalName ?? undefined,
    websiteUrl: current.websiteUrl ?? undefined,
    postalCode: current.postalCode ?? undefined,
    street: current.street ?? undefined,
    phone: current.phone ?? undefined,
    companyEmail: current.companyEmail ?? undefined,
    state: current.state ?? undefined,
    employeeRange: current.employeeRange ?? undefined,
    firstName: current.firstName ?? undefined,
    lastName: current.lastName ?? undefined,
    linkedinUrl: current.linkedinUrl ?? undefined,
    jobUrl: current.jobUrl ?? undefined,
    jobSignalText: current.jobSignalText ?? undefined,
    fleetSignalText: current.fleetSignalText ?? undefined,
    locationSignalText: current.locationSignalText ?? undefined,
    contactStructureSignalText: current.contactStructureSignalText ?? undefined,
    websiteMaturitySignal: current.websiteMaturitySignal ?? undefined,
    videoUrl: current.videoUrl ?? undefined,
    calendarUrl: current.calendarUrl ?? undefined,
    bookingUrl: current.bookingUrl ?? undefined,
    customPainPoint: current.customPainPoint ?? undefined,
    customHeroHeadline: current.customHeroHeadline ?? undefined,
    customHeroSubline: current.customHeroSubline ?? undefined,
    customHeroBodyText: current.customHeroBodyText ?? undefined,
    customHeroCtaText: current.customHeroCtaText ?? undefined,
    customHeroCtaUrl: current.customHeroCtaUrl ?? undefined,
    personalVideoUrl: current.personalVideoUrl ?? undefined,
    personalVideoThumbnailUrl: current.personalVideoThumbnailUrl ?? undefined,
    personalVideoScript: current.personalVideoScript ?? undefined,
    personalVideoProvider: current.personalVideoProvider ?? undefined,
    personalVideoJobId: current.personalVideoJobId ?? undefined,
    personalVideoError: current.personalVideoError ?? undefined,
    explainerVideoUrl: current.explainerVideoUrl ?? undefined,
    individualCtaText: current.individualCtaText ?? undefined
  } as Partial<ProspectInput>;
  const scores = calculateProspectScore(scoreInput);
  return { ...payload, ...scores } as Prisma.ProspectUncheckedUpdateInput;
}

function buildManualProspectUpdate(
  patch: z.infer<typeof manualPatchSchema>,
  current: Prospect
): Prisma.ProspectUncheckedUpdateInput {
  const data: Prisma.ProspectUncheckedUpdateInput = {};
  const directFields = [
    "salutation",
    "firstName",
    "lastName",
    "decisionMakerName",
    "decisionMakerRole",
    "decisionMakerEmail",
    "decisionMakerPhone",
    "decisionMakerSourceUrl",
    "decisionMakerConfidence",
    "companyEmail",
    "companyPhone",
    "contactPageUrl",
    "generalContactLabel",
    "phone",
    "linkedinUrl",
    "companyName",
    "legalName",
    "websiteUrl",
    "city",
    "postalCode",
    "street",
    "state",
    "country",
    "employeeRange",
    "employeeCount",
    "vehicleCount",
    "trailerCount",
    "locationsCount",
    "businessFields",
    "companyStatus",
    "icpScore",
    "status",
    "leadStatus",
    "followUpAt",
    "followUpReason",
    "followUpStatus",
    "assignedTo",
    "showInCrm",
    "source",
    "targetGroupId",
    "suggestedOfferId"
  ] as const;

  for (const field of directFields) {
    if (field in patch) {
      if (field === "icpScore" && patch.icpScore === null) {
        continue;
      }
      data[field] = patch[field] as never;
    }
  }

  if ("painSummary" in patch || "customPainPoint" in patch) {
    data.customPainPoint = patch.painSummary ?? patch.customPainPoint ?? null;
    data.painSummary = patch.painSummary ?? patch.customPainPoint ?? null;
  }

  if ("painType" in patch) {
    data.painType = patch.painType;
    const currentSignals = Array.isArray(current.painSignals) ? current.painSignals as Array<Record<string, unknown>> : [];
    const [firstSignal, ...restSignals] = currentSignals;
    data.painSignals = (patch.painType
      ? [{ ...(firstSignal ?? {}), type: patch.painType, label: patch.painSummary ?? firstSignal?.label ?? patch.painType }, ...restSignals]
      : restSignals) as Prisma.InputJsonValue;
  } else if ("painSummary" in patch && patch.painSummary) {
    const currentSignals = Array.isArray(current.painSignals) ? current.painSignals as Array<Record<string, unknown>> : [];
    if (currentSignals.length > 0) {
      const [firstSignal, ...restSignals] = currentSignals;
      data.painSignals = [{ ...firstSignal, label: patch.painSummary }, ...restSignals] as Prisma.InputJsonValue;
    }
  }

  return data;
}

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    await prisma.prospect.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(
      { error: getErrorMessage(error, "Löschen fehlgeschlagen") },
      { status: 400 }
    );
  }
}
