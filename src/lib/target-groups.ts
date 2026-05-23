import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type TargetGroupLike = {
  id: string;
  name: string;
  defaultOfferId?: string | null;
  description: string;
  industryKeywords: string[];
  painKeywords: string[];
  icpRules: Record<string, unknown>;
  emailTone: string;
  landingpageStyle: string;
  videoStyle: string;
};

export const defaultTargetGroup: TargetGroupLike = {
  id: "default-spedition",
  name: "Spedition",
  defaultOfferId: null,
  description: "Transport- und Logistikunternehmen mit operativen Prozessen, Fuhrpark und Disposition.",
  industryKeywords: ["spedition", "transport", "logistik", "lkw", "fuhrpark", "fracht", "disposition"],
  painKeywords: ["fahrer", "berufskraftfahrer", "disponent", "karriere", "stellenangebote", "bewerbung", "telefon", "fax", "pdf"],
  icpRules: { industry: "logistics", employeeMin: 5, employeeMax: 100 },
  emailTone: "direkt",
  landingpageStyle: "operativ, konkret, faktenbasiert",
  videoStyle: "kurz, persönlich, mit Bezug auf Fuhrpark oder Disposition"
};

const jsonListField = z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).transform((value) => {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : value.split(",");
  return entries.map((entry) => entry.trim()).filter(Boolean);
});

const jsonRulesField = z.union([z.record(z.unknown()), z.string(), z.null(), z.undefined()]).transform((value) => {
  if (!value) return {};
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { text: value };
  }
});

export const targetGroupSchema = z.object({
  name: z.string().trim().min(1),
  defaultOfferId: z.string().trim().nullable().optional().transform((value) => value || null),
  description: z.string().trim().optional().nullable().transform((value) => value || null),
  industryKeywords: jsonListField,
  painKeywords: jsonListField,
  icpRules: jsonRulesField,
  emailTone: z.string().trim().optional().default("direkt"),
  landingpageStyle: z.string().trim().optional().default("professionell"),
  videoStyle: z.string().trim().optional().default("kurz und persönlich")
});

export type TargetGroupInput = z.infer<typeof targetGroupSchema>;

export function parseTargetGroupPayload(payload: unknown): TargetGroupInput {
  return targetGroupSchema.parse(payload);
}

export async function getTargetGroupOrDefault(targetGroupId?: string | null) {
  if (!targetGroupId) return defaultTargetGroup;
  const targetGroup = await prisma.targetGroup.findUnique({ where: { id: targetGroupId } });
  if (!targetGroup) return defaultTargetGroup;
  return {
    id: targetGroup.id,
    name: targetGroup.name,
    defaultOfferId: targetGroup.defaultOfferId,
    description: targetGroup.description ?? "",
    industryKeywords: toStringArray(targetGroup.industryKeywords),
    painKeywords: toStringArray(targetGroup.painKeywords),
    icpRules: targetGroup.icpRules && typeof targetGroup.icpRules === "object" ? targetGroup.icpRules as Record<string, unknown> : {},
    emailTone: targetGroup.emailTone,
    landingpageStyle: targetGroup.landingpageStyle,
    videoStyle: targetGroup.videoStyle
  };
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function targetGroupContextText(targetGroup: TargetGroupLike) {
  return [
    `Zielgruppe: ${targetGroup.name}`,
    targetGroup.description ? `Beschreibung: ${targetGroup.description}` : "",
    `Branchen-Keywords: ${targetGroup.industryKeywords.join(", ")}`,
    `Pain-Keywords: ${targetGroup.painKeywords.join(", ")}`,
    `E-Mail-Ton: ${targetGroup.emailTone}`,
    `Landingpage-Stil: ${targetGroup.landingpageStyle}`,
    `Video-Stil: ${targetGroup.videoStyle}`
  ].filter(Boolean).join("\n");
}
