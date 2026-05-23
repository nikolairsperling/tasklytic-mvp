import type { Offer, Prospect } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defaultUserId, missingOfferMessage } from "@/lib/user-offer-constants";

export { defaultUserId, missingOfferMessage };
export const defaultWorkspaceId = "default";

const listField = z.union([z.array(z.string()), z.string()]).transform((value) => {
  const entries = Array.isArray(value) ? value : value.split(/\r?\n|,/);
  return entries.map((entry) => entry.trim()).filter(Boolean);
});

export const offerSchema = z.object({
  name: z.string().trim().optional().default("Standard-Angebot"),
  targetGroupId: z.string().trim().nullable().optional().transform((value) => value || null),
  businessName: z.string().trim().nullable().optional().transform((value) => value || null),
  serviceDescription: z.string().trim().min(1, "Bitte beschreibe dein Angebot."),
  targetAudienceDescription: z.string().trim().nullable().optional().transform((value) => value || null),
  coreProblems: listField.pipe(z.array(z.string()).min(1, "Bitte nenne mindestens ein Problem.")),
  solutions: listField.pipe(z.array(z.string()).min(1, "Bitte beschreibe mindestens eine Loesung.")),
  valueProposition: z.string().trim().nullable().optional().transform((value) => value || null),
  toneOfVoice: z.string().trim().nullable().optional().transform((value) => value || null),
  isDefault: z.boolean().optional().default(false)
});

export type UserOfferInput = z.infer<typeof offerSchema>;

export function parseUserOfferPayload(payload: unknown): UserOfferInput {
  return offerSchema.parse(payload);
}

export async function getUserOffer(workspaceId = defaultWorkspaceId) {
  return getDefaultOrFirstOffer(workspaceId);
}

export async function upsertUserOffer(input: UserOfferInput, workspaceId = defaultWorkspaceId) {
  const existing = await getDefaultOffer(workspaceId);
  if (existing) {
    return updateOffer(existing.id, { ...input, isDefault: true }, workspaceId);
  }
  return createOffer({ ...input, isDefault: true }, workspaceId);
}

export async function listOffers(workspaceId = defaultWorkspaceId) {
  return prisma.offer.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" }
  });
}

export async function getOffer(id: string, workspaceId = defaultWorkspaceId) {
  return prisma.offer.findFirstOrThrow({
    where: { id, workspaceId }
  });
}

export async function getDefaultOffer(workspaceId = defaultWorkspaceId) {
  return prisma.offer.findFirst({
    where: { workspaceId, isDefault: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function getDefaultOrFirstOffer(workspaceId = defaultWorkspaceId) {
  const defaultOffer = await getDefaultOffer(workspaceId);
  if (defaultOffer) return defaultOffer;
  return prisma.offer.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createOffer(input: UserOfferInput, workspaceId = defaultWorkspaceId) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.offer.updateMany({ where: { workspaceId, isDefault: true }, data: { isDefault: false } });
    }
    const shouldBeDefault = input.isDefault || (await tx.offer.count({ where: { workspaceId } })) === 0;
    return tx.offer.create({
      data: {
        workspaceId,
        name: input.name || "Standard-Angebot",
        targetGroupId: input.targetGroupId,
        businessName: input.businessName,
        serviceDescription: input.serviceDescription,
        targetAudienceDescription: input.targetAudienceDescription,
        coreProblems: input.coreProblems,
        solutions: input.solutions,
        valueProposition: input.valueProposition,
        toneOfVoice: input.toneOfVoice,
        isDefault: shouldBeDefault
      }
    });
  });
}

export async function updateOffer(id: string, input: UserOfferInput, workspaceId = defaultWorkspaceId) {
  return prisma.$transaction(async (tx) => {
    await tx.offer.findFirstOrThrow({ where: { id, workspaceId } });
    if (input.isDefault) {
      await tx.offer.updateMany({ where: { workspaceId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return tx.offer.update({
      where: { id },
      data: {
        name: input.name || "Standard-Angebot",
        targetGroupId: input.targetGroupId,
        businessName: input.businessName,
        serviceDescription: input.serviceDescription,
        targetAudienceDescription: input.targetAudienceDescription,
        coreProblems: input.coreProblems,
        solutions: input.solutions,
        valueProposition: input.valueProposition,
        toneOfVoice: input.toneOfVoice,
        isDefault: input.isDefault
      }
    });
  });
}

export async function deleteOffer(id: string, workspaceId = defaultWorkspaceId) {
  await prisma.offer.deleteMany({ where: { id, workspaceId } });
}

export async function duplicateOffer(id: string, workspaceId = defaultWorkspaceId) {
  const offer = await prisma.offer.findFirstOrThrow({ where: { id, workspaceId } });
  return createOffer({
    name: `${offer.name} Kopie`,
    targetGroupId: offer.targetGroupId,
    businessName: offer.businessName,
    serviceDescription: offer.serviceDescription,
    targetAudienceDescription: offer.targetAudienceDescription,
    coreProblems: jsonList(offer.coreProblems),
    solutions: jsonList(offer.solutions),
    valueProposition: offer.valueProposition,
    toneOfVoice: offer.toneOfVoice,
    isDefault: false
  }, workspaceId);
}

export async function setDefaultOffer(id: string, workspaceId = defaultWorkspaceId) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findFirstOrThrow({ where: { id, workspaceId } });
    await tx.offer.updateMany({ where: { workspaceId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    return tx.offer.update({ where: { id: offer.id }, data: { isDefault: true } });
  });
}

export async function requireUserOffer(workspaceId = defaultWorkspaceId) {
  const offer = await getDefaultOrFirstOffer(workspaceId);
  if (!offer) {
    throw new Error(missingOfferMessage);
  }
  return offer;
}

export async function resolveOfferForProspect(
  prospect: Pick<Prospect, "targetGroupId" | "suggestedOfferId">,
  options: { campaignId?: string | null; campaignOfferId?: string | null; userId?: string } = {}
) {
  const workspaceId = options.userId ?? defaultWorkspaceId;
  if (options.campaignOfferId) return prisma.offer.findFirst({ where: { id: options.campaignOfferId, workspaceId } });
  if (options.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: options.campaignId }, select: { offerId: true } });
    if (campaign?.offerId) return prisma.offer.findFirst({ where: { id: campaign.offerId, workspaceId } });
  }
  if (prospect.suggestedOfferId) {
    const suggested = await prisma.offer.findFirst({ where: { id: prospect.suggestedOfferId, workspaceId } });
    if (suggested) return suggested;
  }
  if (prospect.targetGroupId) {
    const targetGroup = await prisma.targetGroup.findUnique({ where: { id: prospect.targetGroupId }, select: { defaultOfferId: true } });
    if (targetGroup?.defaultOfferId) {
      const targetOffer = await prisma.offer.findFirst({ where: { id: targetGroup.defaultOfferId, workspaceId } });
      if (targetOffer) return targetOffer;
    }
    const assignedOffer = await prisma.offer.findFirst({
      where: { workspaceId, targetGroupId: prospect.targetGroupId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });
    if (assignedOffer) return assignedOffer;
  }
  return getDefaultOrFirstOffer(workspaceId);
}

export async function requireOfferForProspect(
  prospect: Pick<Prospect, "targetGroupId" | "suggestedOfferId">,
  options: { campaignId?: string | null; campaignOfferId?: string | null; userId?: string } = {}
) {
  const offer = await resolveOfferForProspect(prospect, options);
  if (!offer) throw new Error(missingOfferMessage);
  return offer;
}

export function userOfferContextText(offer: Pick<Offer,
  | "businessName"
  | "serviceDescription"
  | "targetAudienceDescription"
  | "coreProblems"
  | "solutions"
  | "valueProposition"
  | "toneOfVoice"
> & { name?: string | null }) {
  return [
    "Offer-Kontext:",
    offer.name ? `Angebot: ${offer.name}` : "",
    offer.businessName ? `Unternehmen: ${offer.businessName}` : "",
    `Dienstleistung: ${offer.serviceDescription}`,
    offer.targetAudienceDescription ? `Zielgruppe: ${offer.targetAudienceDescription}` : "",
    `Typische Probleme: ${formatJsonList(offer.coreProblems)}`,
    `Loesung: ${formatJsonList(offer.solutions)}`,
    offer.valueProposition ? `Unterscheidung: ${offer.valueProposition}` : "",
    offer.toneOfVoice ? `Tonalitaet: ${offer.toneOfVoice}` : "",
    "Nutze diesen Offer-Kontext verbindlich. Kein generischer Text ohne Bezug zu Dienstleistung, Zielgruppe, Problemen und Loesung."
  ].filter(Boolean).join("\n");
}

export function offerFormValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (typeof value === "string") return value;
  return "";
}

function formatJsonList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function jsonList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
  return [];
}

export function safeDatabaseUrlForLog(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return "unset";

  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = "***";
    if (url.username) url.username = url.username ? "***" : "";
    return url.toString();
  } catch {
    return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@");
  }
}
