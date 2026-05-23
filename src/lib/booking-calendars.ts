export const bookingProviders = ["calendly", "tidycal", "cal_com", "custom", "microsoft_bookings"] as const;

export const bookingProviderLabels: Record<(typeof bookingProviders)[number], string> = {
  calendly: "Calendly",
  tidycal: "TidyCal",
  cal_com: "Cal.com",
  custom: "Eigener Buchungslink",
  microsoft_bookings: "Microsoft Bookings"
};

export const bookingVariables = ["{{Terminlink}}", "{{Calendly_Link}}", "{{Booking_URL}}"] as const;

export function normalizeBookingProvider(value: unknown): (typeof bookingProviders)[number] {
  return bookingProviders.includes(value as (typeof bookingProviders)[number]) ? value as (typeof bookingProviders)[number] : "custom";
}

export function normalizeBookingUrl(value: unknown) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function bookingVariablesForUrl(url: string) {
  return {
    Terminlink: url,
    Calendly_Link: url,
    Booking_URL: url,
    calendarUrl: url,
    bookingUrl: url
  };
}

export async function testBookingUrl(url: string) {
  const normalizedUrl = normalizeBookingUrl(url);
  if (!normalizedUrl) {
    return { status: "failed", statusCode: null, message: "Kein Buchungslink hinterlegt." };
  }

  try {
    const response = await fetch(normalizedUrl, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    return {
      status: response.ok ? "reachable" : "failed",
      statusCode: response.status,
      message: response.ok ? "Link erreichbar." : `Link antwortet mit HTTP ${response.status}.`
    };
  } catch {
    try {
      const response = await fetch(normalizedUrl, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
      return {
        status: response.ok ? "reachable" : "failed",
        statusCode: response.status,
        message: response.ok ? "Link erreichbar." : `Link antwortet mit HTTP ${response.status}.`
      };
    } catch {
      return { status: "failed", statusCode: null, message: "Link konnte nicht erreicht werden." };
    }
  }
}
