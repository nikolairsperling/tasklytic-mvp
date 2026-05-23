import { describe, expect, it } from "vitest";
import { buildProspectReportPdf, shouldRecommendPrintMailing } from "@/lib/report-assets";

const prospect = {
  id: "p1",
  slug: "acme",
  companyName: "Acme Logistik",
  decisionMakerName: "Max Bauer",
  decisionMakerRole: "Geschäftsführer",
  industry: "Logistik",
  painType: "Backoffice",
  painSummary: "Viele manuelle Rückfragen",
  customPainPoint: null,
  icpScore: 62,
  icpFitScore: 60,
  fitScore: 40,
  calendarUrl: "https://cal.example/acme",
  bookingUrl: null,
  landingpageUrl: null
};

describe("report assets", () => {
  it("creates a PDF buffer with report content", () => {
    const pdf = buildProspectReportPdf(prospect, "acme", "https://tasklytic.example");

    expect(pdf.subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(pdf.toString("utf8")).toContain("Acme Logistik");
    expect(pdf.toString("utf8")).toContain("ICP Score: 62");
  });

  it("recommends print mailing only for visited high-fit leads without booking", () => {
    expect(shouldRecommendPrintMailing({ icpScore: 60, events: [{ type: "page_view" }] })).toBe(true);
    expect(shouldRecommendPrintMailing({ icpScore: 60, events: [{ type: "page_view" }, { type: "booking_completed" }] })).toBe(false);
    expect(shouldRecommendPrintMailing({ icpScore: 59, events: [{ type: "page_view" }] })).toBe(false);
  });
});
