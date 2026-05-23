import { z } from "zod";
import { imageUrlHint, isDirectImageUrl } from "@/lib/image-url";
import { prisma } from "@/lib/prisma";

export const themeModeSchema = z.enum(["light", "dark", "system"]);
export const trackingConsentModeSchema = z.enum(["legitimate_interest", "consent_required", "disabled"]);
export const fontFamilySchema = z.enum(["Inter", "Lato", "Poppins", "System", "Serif", "Mono"]);

const optionalImageUrlSchema = z
  .union([z.string().trim(), z.literal(""), z.null(), z.undefined()])
  .refine((value) => !value || isDirectImageUrl(value), imageUrlHint)
  .transform((value) => value || null);

const optionalDomainSchema = z
  .union([z.string().trim().min(1), z.literal(""), z.null(), z.undefined()])
  .transform((value) => value || null);

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Farbe muss im Format #RRGGBB angegeben werden.")
  .transform((value) => value.toLowerCase());

export const trackingSettingsSchema = z.object({
  openTrackingEnabled: z.boolean().default(true),
  clickTrackingEnabled: z.boolean().default(true),
  trackingDomain: optionalDomainSchema,
  appendUtmParams: z.boolean().default(false),
  utmSource: z.string().trim().default("tasklytic"),
  utmMedium: z.string().trim().default("email"),
  utmCampaign: z.string().trim().default("outreach"),
  privacyNoticeText: z.string().trim().default(""),
  trackingConsentMode: trackingConsentModeSchema.default("legitimate_interest")
});

export const callProviderModeSchema = z.enum(["tel-link", "sip", "twilio"]);
export const voiceAiVoiceSchema = z.enum(["neutral", "männlich", "weiblich"]);

const optionalPhoneSchema = z
  .union([z.string().trim().min(1), z.literal(""), z.null(), z.undefined()])
  .transform((value) => value || null);

export const callingSettingsSchema = z.object({
  ownPhoneNumber: optionalPhoneSchema,
  defaultCountryDialCode: z
    .string()
    .trim()
    .regex(/^\+?\d{1,4}$/, "Ländervorwahl muss als +49 oder 49 angegeben werden.")
    .transform((value) => (value.startsWith("+") ? value : `+${value}`))
    .default("+49"),
  callProviderMode: callProviderModeSchema.default("tel-link"),
  voiceAiProvider: z.string().trim().min(1).default("test"),
  voiceAiDefaultVoice: voiceAiVoiceSchema.default("neutral"),
  voiceAiEnabled: z.boolean().default(false)
});

export const designSettingsSchema = z.object({
  appName: z.string().trim().min(1).max(80).default("Tasklytic"),
  themeMode: themeModeSchema.default("system"),
  primaryColor: colorSchema.default("#0891b2"),
  secondaryColor: colorSchema.default("#ecfeff"),
  accentColor: colorSchema.default("#ecfeff"),
  backgroundColor: colorSchema.default("#f8fafc"),
  textColor: colorSchema.default("#0f172a"),
  buttonRadius: z.coerce.number().int().min(0).max(32).default(12),
  cardRadius: z.coerce.number().int().min(0).max(32).default(16),
  selectedFont: fontFamilySchema.default("Inter"),
  fontFamily: fontFamilySchema.default("Inter"),
  logoUrl: optionalImageUrlSchema,
  iconUrl: optionalImageUrlSchema,
  faviconUrl: optionalImageUrlSchema
});

export const appSettingsSchema = trackingSettingsSchema.merge(designSettingsSchema);
export const fullAppSettingsSchema = appSettingsSchema.merge(callingSettingsSchema);

export type ThemeMode = z.infer<typeof themeModeSchema>;
export type TrackingSettingsPayload = z.infer<typeof trackingSettingsSchema>;
export type DesignSettingsPayload = z.infer<typeof designSettingsSchema>;
export type CallingSettingsPayload = z.infer<typeof callingSettingsSchema>;
export type AppSettingsPayload = z.infer<typeof fullAppSettingsSchema>;

type AppSettingsStore = {
  appSettings: {
    findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
    upsert(args: {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<Record<string, unknown>>;
  };
};

export const DEFAULT_TRACKING_SETTINGS: TrackingSettingsPayload = {
  openTrackingEnabled: true,
  clickTrackingEnabled: true,
  trackingDomain: null,
  appendUtmParams: false,
  utmSource: "tasklytic",
  utmMedium: "email",
  utmCampaign: "outreach",
  privacyNoticeText: "",
  trackingConsentMode: "legitimate_interest"
};

export const DEFAULT_DESIGN_SETTINGS: DesignSettingsPayload = {
  appName: "Tasklytic",
  themeMode: "system",
  primaryColor: "#0891b2",
  secondaryColor: "#ecfeff",
  accentColor: "#ecfeff",
  backgroundColor: "#f8fafc",
  textColor: "#0f172a",
  buttonRadius: 12,
  cardRadius: 16,
  selectedFont: "Inter",
  fontFamily: "Inter",
  logoUrl: null,
  iconUrl: null,
  faviconUrl: null
};

export const DEFAULT_CALLING_SETTINGS: CallingSettingsPayload = {
  ownPhoneNumber: null,
  defaultCountryDialCode: "+49",
  callProviderMode: "tel-link",
  voiceAiProvider: "test",
  voiceAiDefaultVoice: "neutral",
  voiceAiEnabled: false
};

export const DEFAULT_APP_SETTINGS: AppSettingsPayload = {
  ...DEFAULT_TRACKING_SETTINGS,
  ...DEFAULT_DESIGN_SETTINGS,
  ...DEFAULT_CALLING_SETTINGS
};

export function parseThemeMode(value: unknown): ThemeMode {
  return themeModeSchema.parse(value);
}

export function normalizeAppSettingsPayload(payload: unknown): AppSettingsPayload {
  return fullAppSettingsSchema.parse({ ...DEFAULT_APP_SETTINGS, ...(payload ?? {}) });
}

export function normalizeCallingSettingsPayload(payload: unknown): CallingSettingsPayload {
  return callingSettingsSchema.parse({ ...DEFAULT_CALLING_SETTINGS, ...(payload ?? {}) });
}

export function normalizeTrackingSettingsPayload(payload: unknown): TrackingSettingsPayload {
  return trackingSettingsSchema.parse({ ...DEFAULT_TRACKING_SETTINGS, ...(payload ?? {}) });
}

export function normalizeDesignSettingsPayload(payload: unknown): DesignSettingsPayload {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const input = { ...DEFAULT_DESIGN_SETTINGS, ...raw } as Record<string, unknown>;
  if (!raw.selectedFont && raw.fontFamily) input.selectedFont = raw.fontFamily;
  if (!raw.fontFamily && raw.selectedFont) input.fontFamily = raw.selectedFont;
  return designSettingsSchema.parse(input);
}

export async function readAppSettings(store: AppSettingsStore = prisma): Promise<AppSettingsPayload> {
  const settings = await store.appSettings.findUnique({ where: { id: "default" } });
  return normalizeAppSettingsPayload(settings ?? DEFAULT_APP_SETTINGS);
}

export async function saveAppSettings(payload: unknown, store: AppSettingsStore = prisma): Promise<AppSettingsPayload> {
  const current = await readAppSettings(store);
  const data = normalizeAppSettingsPayload({ ...current, ...(payload ?? {}) });
  const settings = await store.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data
  });
  return normalizeAppSettingsPayload(settings);
}

export async function readTrackingSettings(store: AppSettingsStore = prisma): Promise<TrackingSettingsPayload> {
  return normalizeTrackingSettingsPayload(await readAppSettings(store));
}

export async function saveTrackingSettings(payload: unknown, store: AppSettingsStore = prisma): Promise<TrackingSettingsPayload> {
  return normalizeTrackingSettingsPayload(await saveAppSettings(normalizeTrackingSettingsPayload(payload), store));
}

export async function readDesignSettings(store: AppSettingsStore = prisma): Promise<DesignSettingsPayload> {
  return normalizeDesignSettingsPayload(await readAppSettings(store));
}

export async function saveDesignSettings(payload: unknown, store: AppSettingsStore = prisma): Promise<DesignSettingsPayload> {
  const current = await readDesignSettings(store);
  return normalizeDesignSettingsPayload(await saveAppSettings(normalizeDesignSettingsPayload({ ...current, ...(payload ?? {}) }), store));
}

export async function readCallingSettings(store: AppSettingsStore = prisma): Promise<CallingSettingsPayload> {
  return normalizeCallingSettingsPayload(await readAppSettings(store));
}

export async function saveCallingSettings(payload: unknown, store: AppSettingsStore = prisma): Promise<CallingSettingsPayload> {
  return normalizeCallingSettingsPayload(await saveAppSettings(normalizeCallingSettingsPayload(payload), store));
}

export function appendUtmParams(url: string, settings: TrackingSettingsPayload): string {
  if (!url || !settings.appendUtmParams) return url;
  try {
    const parsed = new URL(url, "http://localhost");
    if (settings.utmSource) parsed.searchParams.set("utm_source", settings.utmSource);
    if (settings.utmMedium) parsed.searchParams.set("utm_medium", settings.utmMedium);
    if (settings.utmCampaign) parsed.searchParams.set("utm_campaign", settings.utmCampaign);
    return url.startsWith("/") ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
  } catch {
    return url;
  }
}

export function getTrackingBaseUrl(settings: TrackingSettingsPayload, env: NodeJS.ProcessEnv = process.env): string {
  const configured = settings.trackingDomain?.trim() || env.NEXT_PUBLIC_APP_URL || env.PUBLIC_APP_URL || "";
  if (!configured) return "";
  return /^https?:\/\//i.test(configured) ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
}

export function resolveEmailTracking(settings: TrackingSettingsPayload, campaignTrackingEnabled = true) {
  const globallyDisabled = settings.trackingConsentMode === "disabled";
  return {
    openEnabled: campaignTrackingEnabled && !globallyDisabled && settings.openTrackingEnabled,
    clickEnabled: campaignTrackingEnabled && !globallyDisabled && settings.clickTrackingEnabled
  };
}

export function appendOpenTrackingPixel(html: string, token: string | undefined, settings: TrackingSettingsPayload): string {
  if (!token) return html;
  const src = `${getTrackingBaseUrl(settings)}/api/track/open/${token}`;
  return `${html}<img src="${src}" width="1" height="1" alt="" style="display:none" />`;
}

export function buildTrackingClickUrl(token: string, settings: TrackingSettingsPayload): string {
  return `${getTrackingBaseUrl(settings)}/api/track/click/${token}`;
}
