import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const legalModeSchema = z.enum(["external", "content"]);

export const legalSettingsSchema = z.object({
  imprintMode: legalModeSchema.default("content"),
  imprintUrl: z.string().trim().optional().nullable().transform((value) => value || null),
  imprintContent: z.string().optional().default(""),
  privacyMode: legalModeSchema.default("content"),
  privacyUrl: z.string().trim().optional().nullable().transform((value) => value || null),
  privacyContent: z.string().optional().default(""),
  cookiesMode: legalModeSchema.default("content"),
  cookiesUrl: z.string().trim().optional().nullable().transform((value) => value || null),
  cookiesContent: z.string().optional().default("")
});

export type LegalSettingsInput = z.infer<typeof legalSettingsSchema>;
export type LegalKind = "impressum" | "datenschutz" | "cookies";

export async function getLegalSettings() {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  return {
    imprintMode: normalizeMode(settings.imprintMode),
    imprintUrl: settings.imprintUrl,
    imprintContent: settings.imprintContent,
    privacyMode: normalizeMode(settings.privacyMode),
    privacyUrl: settings.privacyUrl,
    privacyContent: settings.privacyContent,
    cookiesMode: normalizeMode(settings.cookiesMode),
    cookiesUrl: settings.cookiesUrl,
    cookiesContent: settings.cookiesContent
  };
}

export async function updateLegalSettings(payload: unknown) {
  const input = legalSettingsSchema.parse(payload);
  return prisma.appSettings.upsert({
    where: { id: "default" },
    update: input,
    create: { id: "default", ...input }
  });
}

export function getLegalLink(settings: Awaited<ReturnType<typeof getLegalSettings>>, kind: LegalKind) {
  const entry = getLegalEntry(settings, kind);
  if (entry.mode === "external" && entry.url) {
    return { href: entry.url, external: true };
  }
  return { href: `/legal/${kind}`, external: false };
}

export function getLegalEntry(settings: Awaited<ReturnType<typeof getLegalSettings>>, kind: LegalKind) {
  if (kind === "impressum") {
    return { title: "Impressum", mode: settings.imprintMode, url: settings.imprintUrl, content: settings.imprintContent };
  }
  if (kind === "datenschutz") {
    return { title: "Datenschutz", mode: settings.privacyMode, url: settings.privacyUrl, content: settings.privacyContent };
  }
  return { title: "Cookies", mode: settings.cookiesMode, url: settings.cookiesUrl, content: settings.cookiesContent };
}

function normalizeMode(value: string) {
  return value === "external" ? "external" as const : "content" as const;
}
