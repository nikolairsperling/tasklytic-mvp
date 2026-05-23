import { describe, expect, it } from "vitest";
import {
  addLandingpageSection,
  defaultLandingpageTemplate,
  renderLandingpageSections,
  renderLandingpageModel,
  renderText,
  resolveTemplateVariables,
  previewLead,
  resolveBookingCtaUrl,
  resolveCtaUrl
} from "@/lib/landingpage-templates";

const baseProspect = {
  id: "p1",
  slug: "acme-berlin",
  landingpageTemplateId: null,
  companyName: "Acme Logistik",
  legalName: null,
  websiteUrl: null,
  city: "Berlin",
  state: null,
  country: "DE",
  employeeRange: null,
  vehicleCount: 20,
  trailerCount: null,
  locationsCount: 2,
  businessFields: ["Spedition"],
  isFamilyOwned: null,
  decisionMakerName: "Max Bauer",
  decisionMakerRole: "Geschäftsführer",
  decisionMakerEmail: "max@example.com",
  salutation: "Herr",
  firstName: "Max",
  lastName: "Bauer",
  linkedinUrl: null,
  openDispatcherJob: false,
  jobUrl: null,
  jobSignalText: null,
  fleetSignalText: null,
  locationSignalText: null,
  contactStructureSignalText: null,
  websiteMaturitySignal: null,
  videoUrl: null,
  calendarUrl: "https://cal.example/max",
  bookingUrl: null,
  customPainPoint: "manuelle Übergaben",
  customHeroHeadline: null,
  customHeroSubline: null,
  customHeroBodyText: null,
  customHeroCtaText: null,
  customHeroCtaUrl: null,
  personalVideoUrl: null,
  personalVideoThumbnailUrl: null,
  personalVideoScript: null,
  personalVideoStatus: "none" as const,
  personalVideoProvider: null,
  personalVideoJobId: null,
  personalVideoError: null,
  explainerVideoUrl: null,
  individualCtaText: null,
  icpFitScore: 0,
  timingScore: 0,
  painScore: 0,
  painSummary: "manuelle Abstimmung",
  contactQualityScore: 0,
  totalScore: 0,
  status: "draft" as const,
  createdAt: new Date(),
  updatedAt: new Date()
};

function template() {
  return {
    ...defaultLandingpageTemplate(),
    id: "t1",
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("landingpage template rendering", () => {
  it("renders variables with neutral fallbacks for known lead placeholders", () => {
    expect(renderText("Hey {{vorname}} von {{companyName}} {{missing}}", baseProspect)).toBe(
      "Hey Max von Acme Logistik"
    );
    expect(renderText("Hey {{vorname}} von {{companyName}}", { ...baseProspect, firstName: null, decisionMakerName: null, companyName: null as unknown as string })).toBe(
      "Hallo, von Ihr Unternehmen"
    );
  });

  it("uses Max only for explicit template preview data", () => {
    expect(resolveTemplateVariables("Hey {{vorname}} von {{companyName}}", { lead: previewLead, isPreview: true })).toBe("Hey Max von Muster Spedition GmbH");
  });

  it("renders real lead Michael and never falls back to Max", () => {
    const rendered = renderText("Hey {{vorname}} von {{companyName}}", { ...baseProspect, firstName: "Michael", decisionMakerName: "Michael Schneider", companyName: "Schneider Logistik" });
    expect(rendered).toBe("Hey Michael von Schneider Logistik");
    expect(rendered).not.toContain("Max");
  });

  it("renders first name from firstName", () => {
    expect(renderText("Hey {{vorname}}, ich habe dir ein kurzes Video aufgenommen", { ...baseProspect, firstName: "Thomas" })).toBe(
      "Hey Thomas, ich habe dir ein kurzes Video aufgenommen"
    );
  });

  it("renders German and English placeholder aliases", () => {
    expect(renderText("{{firma}} in {{stadt}} fuer {{entscheidungstraeger}}", baseProspect)).toBe(
      "Acme Logistik in Berlin fuer Max Bauer"
    );
    expect(renderText("{{anrede}} {{nachname}}", baseProspect)).toBe("Herr Bauer");
  });

  it("renders Du address form placeholders", () => {
    expect(renderText("Hey {{firstName}}, ich habe dir ein kurzes Video aufgenommen.", baseProspect)).toBe(
      "Hey Max, ich habe dir ein kurzes Video aufgenommen."
    );
  });

  it("renders Sie address form placeholders", () => {
    expect(renderText("Hallo {{salutation}} {{lastName}}, ich habe Ihnen ein kurzes Video aufgenommen.", baseProspect)).toBe(
      "Hallo Herr Bauer, ich habe Ihnen ein kurzes Video aufgenommen."
    );
  });

  it("derives first name from decisionMakerName", () => {
    expect(renderText("Hey {{vorname}}, ich habe dir ein kurzes Video aufgenommen", { ...baseProspect, firstName: null, lastName: null, decisionMakerName: "Thomas Müller" })).toBe(
      "Hey Thomas, ich habe dir ein kurzes Video aufgenommen"
    );
  });

  it("falls back to neutral greeting when no name exists", () => {
    const rendered = renderText("Hey {{vorname}}, ich habe dir ein kurzes Video aufgenommen", { ...baseProspect, firstName: null, lastName: null, decisionMakerName: null });
    expect(rendered).toBe("Hallo, ich habe dir ein kurzes Video aufgenommen");
    expect(rendered).not.toContain("Hey ,");
    expect(rendered).not.toContain("Max");
    expect(rendered).not.toContain("  ");
  });

  it("standard template works without videoUrl", () => {
    const model = renderLandingpageModel(template(), baseProspect);
    expect(model.hero.headline).toContain("Max");
    expect(model.personalVideo.enabled).toBe(false);
  });

  it("shows personal video when URL exists and hides it when disabled", () => {
    const t = template();
    const withVideo = { ...baseProspect, personalVideoUrl: "https://video.example/p" };
    expect(renderLandingpageModel(t, withVideo).personalVideo.enabled).toBe(true);
    expect(renderLandingpageModel({ ...t, personalVideoEnabled: false }, withVideo).personalVideo.enabled).toBe(false);
  });

  it("uses prospect personal video before template video", () => {
    const model = renderLandingpageModel(
      { ...template(), personalVideoUrl: "https://video.example/template" },
      { ...baseProspect, personalVideoUrl: "https://video.example/prospect" }
    );
    expect(model.personalVideo.url).toBe("https://video.example/prospect");
  });

  it("keeps header logo fields compatible with text fallback", () => {
    const t = template();
    expect(t.headerShowTextFallback).toBe(true);
    expect(t.headerTextFallback).toBe("Tasklytic");
    expect(t.headerLogoUrl).toBeNull();
  });

  it("provides PDF and ROI report section defaults with company personalization", () => {
    const sections = [
      addLandingpageSection([], "pdf_report_download")[0],
      addLandingpageSection([], "print_report_cta")[0],
      addLandingpageSection([], "roi_report")[0]
    ];

    const rendered = renderLandingpageSections({ ...template(), sectionsJson: sections }, baseProspect);

    expect(rendered.map((section) => section.type)).toEqual(["pdf_report_download", "print_report_cta", "roi_report"]);
    expect(rendered[0].settings.headline).toBe("Kurzreport für Acme Logistik herunterladen");
    expect(rendered[1].settings.bodyText).toContain("PDF speichern");
    expect(rendered[2].settings.roiMonthlyLoss).toBe("8.100 EUR");
  });

  it("shows explainer video when URL exists", () => {
    const model = renderLandingpageModel({ ...template(), explainerVideoUrl: "https://video.example/e" }, baseProspect);
    expect(model.explainerVideo.enabled).toBe(true);
  });

  it("uses calendar URL and then template default as CTA fallback", () => {
    expect(resolveCtaUrl("", baseProspect, template())).toBe("https://cal.example/max");
    expect(resolveCtaUrl("", { ...baseProspect, calendarUrl: null }, template())).toBe("mailto:nikolai@tasklytic.de");
  });

  it("custom hero fields override template fields", () => {
    const prospect = { ...baseProspect, customHeroHeadline: "Custom Headline", customHeroCtaText: "Custom CTA", customHeroCtaUrl: "https://custom.example" };
    const model = renderLandingpageModel(template(), prospect);
    expect(model.hero.headline).toBe("Custom Headline");
    expect(model.hero.ctaText).toBe("Custom CTA");
    expect(model.hero.ctaUrl).toBe("https://custom.example");
  });

  it("renders landingpage from template sectionsJson in configured order", () => {
    let sections = addLandingpageSection([], "hero");
    sections = addLandingpageSection(sections, "explainer_video");
    sections = addLandingpageSection(sections, "comparison");
    const rendered = renderLandingpageSections({ ...template(), sectionsJson: sections }, baseProspect);
    expect(rendered.map((section) => section.type)).toEqual(["hero", "explainer_video", "comparison"]);
  });

  it("template section changes affect rendering without prospect overwrite", () => {
    const sections = addLandingpageSection([], "hero").map((section) => ({
      ...section,
      settings: { ...section.settings, headline: "Neue Template Headline für {{vorname}}" }
    }));
    const rendered = renderLandingpageSections({ ...template(), sectionsJson: sections }, baseProspect);
    expect(rendered[0].settings.headline).toBe("Neue Template Headline für Max");
  });

  it("keeps prospect custom hero fields before template defaults", () => {
    const sections = addLandingpageSection([], "hero").map((section) => ({
      ...section,
      settings: { ...section.settings, headline: "Template Headline" }
    }));
    const rendered = renderLandingpageSections({ ...template(), sectionsJson: sections }, { ...baseProspect, customHeroHeadline: "Custom Headline" });
    expect(rendered[0].settings.headline).toBe("Custom Headline");
  });

  it("CTA leads to embedded booking page for embedded_page mode", () => {
    const prospect = { ...baseProspect, bookingUrl: "https://calendly.com/demo" };
    expect(resolveBookingCtaUrl("{{calendarUrl}}", prospect, { ...template(), bookingMode: "embedded_page" })).toBe(
      "/p/acme-berlin/booking"
    );
  });

  it("CTA leads directly to bookingUrl for external_link mode", () => {
    const prospect = { ...baseProspect, bookingUrl: "https://tidycal.com/demo" };
    expect(resolveBookingCtaUrl("{{calendarUrl}}", prospect, { ...template(), bookingMode: "external_link" })).toBe(
      "https://tidycal.com/demo"
    );
  });
});
