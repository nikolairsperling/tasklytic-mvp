import type { LandingpageSectionSettings } from "@/lib/landingpage-templates";

export type HeaderLogoType = "image" | "text";

export type ResolvedHeaderLogo = {
  type: HeaderLogoType;
  text: string;
  imageUrl: string;
  alt: string;
  width: string;
  height: string;
};

export function resolveHeaderLogo(settings: LandingpageSectionSettings): ResolvedHeaderLogo {
  const imageUrl = nonEmpty(settings.logoImageUrl) ?? nonEmpty(settings.headerLogoUrl) ?? nonEmpty(settings.logoUrl) ?? "";
  const text = nonEmpty(settings.logoText) ?? nonEmpty(settings.headerTextFallback) ?? "Tasklytic";
  const explicitType = settings.logoType === "image" || settings.logoType === "text" ? settings.logoType : undefined;
  return {
    type: explicitType ?? (imageUrl ? "image" : "text"),
    text,
    imageUrl,
    alt: nonEmpty(settings.logoAlt) ?? nonEmpty(settings.headerLogoAlt) ?? text,
    width: nonEmpty(settings.logoWidth) ?? nonEmpty(settings.headerLogoWidth) ?? "140",
    height: nonEmpty(settings.logoHeight) ?? nonEmpty(settings.headerLogoHeight) ?? ""
  };
}

export function headerLogoCompatibilityPatch(patch: Partial<LandingpageSectionSettings>): Partial<LandingpageSectionSettings> {
  const next: Partial<LandingpageSectionSettings> = { ...patch };
  if ("logoText" in patch) next.headerTextFallback = patch.logoText;
  if ("logoImageUrl" in patch) {
    next.headerLogoUrl = patch.logoImageUrl;
    next.logoUrl = patch.logoImageUrl;
  }
  if ("logoAlt" in patch) next.headerLogoAlt = patch.logoAlt;
  if ("logoWidth" in patch) next.headerLogoWidth = patch.logoWidth;
  if ("logoHeight" in patch) next.headerLogoHeight = patch.logoHeight;
  return next;
}

export function normalizeHeaderLogoSettings(settings: LandingpageSectionSettings): LandingpageSectionSettings {
  const resolved = resolveHeaderLogo(settings);
  return {
    ...settings,
    logoType: resolved.type,
    logoText: resolved.text,
    logoImageUrl: resolved.imageUrl,
    logoAlt: resolved.alt,
    logoWidth: resolved.width,
    logoHeight: resolved.height,
    logoUrl: resolved.imageUrl,
    headerLogoUrl: resolved.imageUrl,
    headerLogoAlt: resolved.alt,
    headerLogoWidth: resolved.width,
    headerLogoHeight: resolved.height,
    headerTextFallback: resolved.text,
    headerShowTextFallback: settings.headerShowTextFallback !== false
  };
}

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
