import type { Offer, Prisma, Prospect, TargetGroup } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProspectInput } from "@/lib/prospects";
import { calculateProspectScore, type ScoreOfferContext } from "@/lib/scoring";
import { defaultTargetGroup, getTargetGroupOrDefault, type TargetGroupLike } from "@/lib/target-groups";
import { resolveOfferForProspect } from "@/lib/user-offer";

const defaultWorkspaceId = "default";

export type ProspectRecalculateResult = {
  prospect: Prospect;
  targetGroup: TargetGroupLike;
  suggestedCampaignId: string | null;
  suggestedCampaignTemplateId: string | null;
};

export async function recalculateProspect(prospectId: string): Promise<ProspectRecalculateResult> {
  const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: prospectId } });
  const targetGroup = await getTargetGroupOrDefault(prospect.targetGroupId);
  const offer = await resolveOfferForProspect(prospect);
  const offerContext = buildScoreOfferContext(offer, targetGroup);
  const scores = calculateProspectScore(prospectToScoreInput(prospect), offerContext);
  const primaryPain = scores.painSignals[0] ?? null;
  const suggestedCampaign = await findSuggestedCampaign(prospect.targetGroupId);

  console.log("[recalculate] TargetGroup", targetGroup.name);
  console.log("[recalculate] ICP Score", scores.icpFitScore);
  console.log("[recalculate] Pain", primaryPain?.type ?? null, primaryPain?.label ?? null);

  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      ...scores,
      icpFitLabel: scoreLabel(scores.icpFitScore),
      painType: primaryPain?.type ?? prospect.painType,
      painSummary: primaryPain?.label ?? prospect.painSummary,
      painEvidence: primaryPain ? { source: "recalculate", signal: primaryPain } : prospect.painEvidence as Prisma.InputJsonValue,
      personalizationAngle: buildPersonalizationAngle(primaryPain?.label, targetGroup, offer),
      suggestedOfferId: offer?.id ?? prospect.suggestedOfferId,
      researchStatus: prospect.researchStatus === "running" ? "running" : "completed",
      researchedAt: new Date()
    }
  });

  return {
    prospect: updated,
    targetGroup,
    suggestedCampaignId: suggestedCampaign?.id ?? null,
    suggestedCampaignTemplateId: null
  };
}

export async function recalculateProspectsForTargetGroup(targetGroupId: string) {
  const prospects = await prisma.prospect.findMany({
    where: { targetGroupId }
  });
  const targetGroup = await getTargetGroupOrDefault(targetGroupId);
  const offer = await prisma.offer.findFirst({
    where: { workspaceId: defaultWorkspaceId, OR: [{ targetGroupId }, { isDefault: true }] },
    orderBy: [{ targetGroupId: "desc" }, { isDefault: "desc" }, { updatedAt: "desc" }]
  });
  return recalculateProspectBatch(prospects, new Map([[targetGroup.id, targetGroup]]), offer);
}

export async function recalculateAllProspects() {
  const [prospects, targetGroups, offer] = await Promise.all([
    prisma.prospect.findMany(),
    prisma.targetGroup.findMany(),
    prisma.offer.findFirst({ where: { workspaceId: defaultWorkspaceId, isDefault: true }, orderBy: { updatedAt: "desc" } })
  ]);
  const targetGroupMap = new Map(
    targetGroups.map((targetGroup) => [targetGroup.id, toTargetGroupLike(targetGroup)])
  );
  return recalculateProspectBatch(prospects, targetGroupMap, offer);
}

async function recalculateProspectBatch(
  prospects: Prospect[],
  targetGroupMap: Map<string, TargetGroupLike>,
  offer: Offer | null
) {
  if (prospects.length === 0) return [];
  const updates = prospects.map((prospect) => {
    const targetGroup = prospect.targetGroupId ? targetGroupMap.get(prospect.targetGroupId) ?? defaultTargetGroup : defaultTargetGroup;
    return prisma.prospect.update({
      where: { id: prospect.id },
      data: buildRecalculateUpdate(prospect, targetGroup, offer)
    });
  });

  return prisma.$transaction(updates);
}

function buildScoreOfferContext(offer: Offer | null, targetGroup: TargetGroupLike): ScoreOfferContext {
  return {
    targetAudienceDescription: [
      offer?.targetAudienceDescription,
      targetGroup.name,
      targetGroup.description,
      targetGroup.industryKeywords.join(" ")
    ].filter(Boolean).join(" "),
    coreProblems: [
      ...jsonList(offer?.coreProblems),
      ...targetGroup.painKeywords
    ],
    serviceDescription: offer?.serviceDescription ?? targetGroup.landingpageStyle
  };
}

function buildRecalculateUpdate(prospect: Prospect, targetGroup: TargetGroupLike, offer: Offer | null): Prisma.ProspectUncheckedUpdateInput {
  const offerContext = buildScoreOfferContext(offer, targetGroup);
  const scores = calculateProspectScore(prospectToScoreInput(prospect), offerContext);
  const primaryPain = scores.painSignals[0] ?? null;

  return {
    ...scores,
    icpFitLabel: scoreLabel(scores.icpFitScore),
    painType: primaryPain?.type ?? prospect.painType,
    painSummary: primaryPain?.label ?? prospect.painSummary,
    painEvidence: primaryPain ? { source: "recalculate", signal: primaryPain } : prospect.painEvidence as Prisma.InputJsonValue,
    personalizationAngle: buildPersonalizationAngle(primaryPain?.label, targetGroup, offer),
    suggestedOfferId: offer?.id ?? prospect.suggestedOfferId,
    researchStatus: prospect.researchStatus === "running" ? "running" : "completed",
    researchedAt: new Date()
  };
}

function prospectToScoreInput(prospect: Prospect): Partial<ProspectInput> {
  return {
    ...prospect,
    landingpageTemplateId: prospect.landingpageTemplateId ?? undefined,
    slug: prospect.slug ?? undefined,
    legalName: prospect.legalName ?? undefined,
    websiteUrl: prospect.websiteUrl ?? undefined,
    postalCode: prospect.postalCode ?? undefined,
    street: prospect.street ?? undefined,
    phone: prospect.phone ?? undefined,
    companyEmail: prospect.companyEmail ?? undefined,
    state: prospect.state ?? undefined,
    employeeRange: prospect.employeeRange ?? undefined,
    firstName: prospect.firstName ?? undefined,
    lastName: prospect.lastName ?? undefined,
    linkedinUrl: prospect.linkedinUrl ?? undefined,
    jobUrl: prospect.jobUrl ?? undefined,
    jobSignalText: prospect.jobSignalText ?? undefined,
    fleetSignalText: prospect.fleetSignalText ?? undefined,
    locationSignalText: prospect.locationSignalText ?? undefined,
    contactStructureSignalText: prospect.contactStructureSignalText ?? undefined,
    websiteMaturitySignal: prospect.websiteMaturitySignal ?? undefined,
    customPainPoint: prospect.customPainPoint ?? prospect.painSummary ?? undefined
  } as Partial<ProspectInput>;
}

async function findSuggestedCampaign(targetGroupId: string | null) {
  if (!targetGroupId) return null;
  return prisma.campaign.findFirst({
    where: {
      targetGroupId,
      status: { in: ["active", "draft"] }
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true, name: true }
  });
}

function scoreLabel(score: number) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function buildPersonalizationAngle(painLabel: string | undefined, targetGroup: TargetGroupLike, offer: Offer | null) {
  if (painLabel) {
    return `Ansprache ueber ${painLabel}${offer?.serviceDescription ? ` mit Bezug auf ${offer.serviceDescription}` : ""}.`;
  }
  if (targetGroup !== defaultTargetGroup) {
    return `Ansprache mit Bezug auf Zielgruppe ${targetGroup.name}.`;
  }
  return offer?.serviceDescription ? `Ansprache mit Bezug auf ${offer.serviceDescription}.` : null;
}

function jsonList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
  return [];
}

function toTargetGroupLike(targetGroup: TargetGroup): TargetGroupLike {
  return {
    id: targetGroup.id,
    name: targetGroup.name,
    defaultOfferId: targetGroup.defaultOfferId,
    description: targetGroup.description ?? "",
    industryKeywords: Array.isArray(targetGroup.industryKeywords) ? targetGroup.industryKeywords.map(String).filter(Boolean) : [],
    painKeywords: Array.isArray(targetGroup.painKeywords) ? targetGroup.painKeywords.map(String).filter(Boolean) : [],
    icpRules: targetGroup.icpRules && typeof targetGroup.icpRules === "object" ? targetGroup.icpRules as Record<string, unknown> : {},
    emailTone: targetGroup.emailTone,
    landingpageStyle: targetGroup.landingpageStyle,
    videoStyle: targetGroup.videoStyle
  };
}
