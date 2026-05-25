import type { Prospect } from "@prisma/client";
import type { LandingpageSectionSettings, LeadForTemplate } from "@/lib/landingpage-templates";
import { normalizeBookingProvider, normalizeBookingUrl } from "@/lib/booking-calendars";

export type BookingCalendarReference = {
  id?: string;
  provider?: string | null;
  displayName?: string | null;
  bookingUrl?: string | null;
  description?: string | null;
  isActive?: boolean | null;
  isDefault?: boolean | null;
};

export type ResolvedBookingEmbed = {
  active: boolean;
  buttonText: string;
  displayName: string;
  embedUrl: string;
  externalUrl: string;
  provider: string;
  source: NonNullable<LandingpageSectionSettings["bookingSource"]>;
  timezone: string;
};

export function defaultBookingCalendar(calendars: BookingCalendarReference[] | null | undefined) {
  const items = calendars ?? [];
  return items.find((calendar) => calendar.isDefault && calendar.isActive !== false)
    ?? items.find((calendar) => calendar.isActive !== false)
    ?? items[0]
    ?? null;
}

export function resolveBookingEmbed(
  settings: LandingpageSectionSettings | null | undefined,
  prospect?: (LeadForTemplate & Partial<Prospect>) | null,
  fallbackCalendar?: BookingCalendarReference | null
): ResolvedBookingEmbed {
  const source = normalizeBookingSource(settings?.bookingSource);
  const embedFromCode = extractIframeSrc(settings?.bookingEmbedCode);
  const configuredUrl = source === "global_default"
    ? ""
    : source === "custom_embed"
      ? embedFromCode || settings?.bookingEmbedUrl || settings?.bookingUrl || ""
      : settings?.bookingEmbedUrl || embedFromCode || settings?.bookingUrl || "";
  const prospectUrl = prospect?.bookingUrl || prospect?.calendarUrl || "";
  const fallbackUrl = fallbackCalendar?.bookingUrl || "";
  const rawUrl = configuredUrl || prospectUrl || fallbackUrl;
  const externalUrl = normalizeBookingUrl(settings?.bookingUrl || rawUrl);
  const embedUrl = source === "external_url" ? "" : normalizeBookingUrl(rawUrl);
  const provider = normalizeBookingProvider(settings?.bookingProvider || providerFromSource(source) || fallbackCalendar?.provider || inferBookingProvider(embedUrl || externalUrl));

  return {
    active: settings?.bookingCalendarActive !== false && fallbackCalendar?.isActive !== false && Boolean(embedUrl || externalUrl),
    buttonText: settings?.bookingButtonText || "Nach Terminbuchung weiter",
    displayName: settings?.bookingCalendarName || fallbackCalendar?.displayName || providerLabel(provider),
    embedUrl,
    externalUrl,
    provider,
    source,
    timezone: settings?.bookingTimezone || "Europe/Berlin"
  };
}

export function extractIframeSrc(embedCode: string | null | undefined): string {
  const value = String(embedCode ?? "").trim();
  if (!value) return "";
  const match = value.match(/<iframe\b[^>]*\bsrc=(["'])(.*?)\1/i);
  return normalizeBookingUrl(match?.[2] ?? "");
}

export function sanitizeIframeEmbedCode(value: string | null | undefined): string {
  const src = extractIframeSrc(value);
  if (!src) return "";
  return `<iframe src="${src}" loading="lazy"></iframe>`;
}

function normalizeBookingSource(value: LandingpageSectionSettings["bookingSource"] | null | undefined): NonNullable<LandingpageSectionSettings["bookingSource"]> {
  if (value === "tidycal" || value === "cal_com" || value === "custom_embed" || value === "external_url") return value;
  return "global_default";
}

function providerFromSource(source: NonNullable<LandingpageSectionSettings["bookingSource"]>) {
  if (source === "tidycal") return "tidycal";
  if (source === "cal_com") return "cal_com";
  return undefined;
}

function inferBookingProvider(url: string) {
  if (/tidycal\.com/i.test(url)) return "tidycal";
  if (/cal\.com/i.test(url)) return "cal_com";
  if (/calendly\.com/i.test(url)) return "calendly";
  if (/bookings\.microsoft\.com/i.test(url)) return "microsoft_bookings";
  return "custom";
}

function providerLabel(provider: string) {
  if (provider === "tidycal") return "TidyCal";
  if (provider === "cal_com") return "Cal.com";
  if (provider === "calendly") return "Calendly";
  if (provider === "microsoft_bookings") return "Microsoft Bookings";
  return "Buchungskalender";
}
