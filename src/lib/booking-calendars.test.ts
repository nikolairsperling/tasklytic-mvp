import { describe, expect, it } from "vitest";
import { bookingVariablesForUrl, normalizeBookingProvider, normalizeBookingUrl } from "@/lib/booking-calendars";
import { renderMessageTemplate } from "@/lib/message-templates";
import { resolveTemplateVariables } from "@/lib/landingpage-templates";

describe("booking calendars", () => {
  it("normalizes providers and booking URLs", () => {
    expect(normalizeBookingProvider("calendly")).toBe("calendly");
    expect(normalizeBookingProvider("unknown")).toBe("custom");
    expect(normalizeBookingUrl("cal.com/tasklytic/15min")).toBe("https://cal.com/tasklytic/15min");
  });

  it("provides all booking variable aliases", () => {
    const variables = bookingVariablesForUrl("https://cal.com/tasklytic/15min");

    expect(variables.Terminlink).toBe("https://cal.com/tasklytic/15min");
    expect(variables.Calendly_Link).toBe("https://cal.com/tasklytic/15min");
    expect(variables.Booking_URL).toBe("https://cal.com/tasklytic/15min");
  });

  it("renders booking variables in message templates", () => {
    const result = renderMessageTemplate("Termin: {{Terminlink}} {{Calendly_Link}} {{Booking_URL}}");

    expect(result.missingVariables).toEqual([]);
    expect(result.rendered).toContain("https://cal.com/tasklytic/15min");
  });

  it("renders booking variables in landingpage templates", () => {
    const rendered = resolveTemplateVariables("Termin: {{Terminlink}} {{Booking_URL}}", {
      calendarUrl: "https://cal.example/meeting"
    });

    expect(rendered).toBe("Termin: https://cal.example/meeting https://cal.example/meeting");
  });
});
