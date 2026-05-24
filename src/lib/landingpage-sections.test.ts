import { describe, expect, it } from "vitest";
import {
  addLandingpageSection,
  defaultGlobalDesign,
  defaultLandingpageTemplate,
  getGlobalLandingpageDesign,
  getBookingUrl,
  deleteLandingpageSection,
  moveLandingpageSection,
  previewLead,
  renderLandingpageSections,
  resolveTemplateVariables,
  toggleLandingpageSection,
  updateLandingpageSection
} from "@/lib/landingpage-templates";

const prospect = {
  companyName: "Acme Logistik",
  city: "Berlin",
  firstName: "Max",
  lastName: "Bauer",
  decisionMakerName: "Max Bauer",
  decisionMakerRole: "Geschäftsführer",
  businessFields: ["Logistik"],
  vehicleCount: 12,
  locationsCount: 2,
  calendarUrl: "https://cal.example/max",
  slug: "acme"
} as any;

function template(sectionsJson: unknown) {
  return {
    ...defaultLandingpageTemplate(),
    id: "t1",
    sectionsJson,
    globalDesignJson: {},
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;
}

describe("landingpage sections", () => {
  it("adds and deletes sections", () => {
    const added = addLandingpageSection([], "hero");
    expect(added).toHaveLength(1);
    expect(deleteLandingpageSection(added, added[0].id)).toHaveLength(0);
  });

  it("disables sections and preview renders only active sections", () => {
    const sections = addLandingpageSection(addLandingpageSection([], "hero"), "faq");
    const disabled = toggleLandingpageSection(sections, sections[0].id);
    expect(disabled[0].enabled).toBe(false);
    expect(renderLandingpageSections(template(disabled), prospect).map((section) => section.type)).toEqual(["faq"]);
  });

  it("changes order with up and down controls", () => {
    const sections = addLandingpageSection(addLandingpageSection([], "hero"), "cta");
    const moved = moveLandingpageSection(sections, sections[1].id, "up");
    expect(moved[0].type).toBe("cta");
  });

  it("renders text changes with variables", () => {
    const sections = addLandingpageSection([], "hero");
    const updated = updateLandingpageSection(sections, sections[0].id, {
      settings: { ...sections[0].settings, headline: "Hallo {{vorname}}" }
    });
    expect(renderLandingpageSections(template(updated), prospect)[0].settings.headline).toBe("Hallo Max");
  });

  it("applies design settings to rendered sections", () => {
    const sections = addLandingpageSection([], "hero");
    const updated = updateLandingpageSection(sections, sections[0].id, {
      settings: { ...sections[0].settings, backgroundColor: "#ff0000", textColor: "#111111" }
    });
    const rendered = renderLandingpageSections(template(updated), prospect)[0];
    expect(rendered.settings.backgroundColor).toBe("#ff0000");
    expect(rendered.settings.textColor).toBe("#111111");
  });

  it("renders hero section and personalized header cta", () => {
    let sections = addLandingpageSection([], "header");
    sections = addLandingpageSection(sections, "hero");
    const rendered = renderLandingpageSections(template(sections), prospect);
    expect(rendered[0].settings.headerCtaText).toBe("Lass uns sprechen Max");
    expect(rendered[1].settings.headline).toContain("Max");
    expect(rendered[1].settings.ctaText).toBe("Gratis Termin vereinbaren");
  });

  it("renders explainer video section", () => {
    const sections = addLandingpageSection([], "explainer_video");
    const rendered = renderLandingpageSections(template(sections), prospect)[0];
    expect(rendered.settings.headline).toContain("90 Sekunden");
    expect(rendered.settings.ctaText).toBe("Jetzt Abläufe gemeinsam durchgehen");
  });

  it("renders comparison section with both cards data", () => {
    const sections = addLandingpageSection([], "comparison");
    const rendered = renderLandingpageSections(template(sections), prospect)[0];
    expect(rendered.settings.beforeItems?.length).toBeGreaterThan(0);
    expect(rendered.settings.afterItems?.length).toBeGreaterThan(0);
  });

  it("uses bookingUrl before calendarUrl for embedded booking", () => {
    expect(getBookingUrl({ ...prospect, bookingUrl: "https://tidycal.example/max" })).toBe("https://tidycal.example/max");
  });

  it("renders thank-you headline personalized", () => {
    const sections = addLandingpageSection([], "thank_you");
    const rendered = renderLandingpageSections(template(sections), prospect)[0];
    expect(rendered.settings.headline).toBe("Termin erfolgreich gebucht, Max!");
  });

  it("renders legal external link and text settings", () => {
    const initial = addLandingpageSection([], "legal");
    const sections = updateLandingpageSection(initial, initial[0].id, {
      settings: {
        ...initial[0].settings,
        legalMode: "external_link",
        legalUrl: "https://example.com/impressum",
        legalText: "Datenschutz fuer {{companyName}}"
      }
    });
    const rendered = renderLandingpageSections(template(sections), prospect)[0];
    expect(rendered.settings.legalUrl).toBe("https://example.com/impressum");
    expect(rendered.settings.legalText).toBe("Datenschutz fuer Acme Logistik");
  });

  it("keeps global design defaults for missing fields", () => {
    expect(defaultGlobalDesign({ primaryColor: "#000000", accentColor: "#ffffff" }).buttonColor).toBe("#000000");
  });

  it("does not break preview rendering with missing fields", () => {
    const rendered = renderLandingpageSections(template([{ id: "broken", type: "hero", enabled: true, order: 1, settings: {} }]), prospect);
    expect(rendered[0].settings.headline).toContain("Max");
  });

  it("uses neutral fallbacks when lead data is missing outside preview", () => {
    expect(resolveTemplateVariables("Hallo {{firstName}} von {{companyName}}", null)).toBe("Hallo von Ihr Unternehmen");
    const rendered = renderLandingpageSections(template(addLandingpageSection([], "hero")), null);
    expect(rendered[0].settings.headline).not.toContain(previewLead.firstName);
  });

  it("falls back to preview lead in template preview", () => {
    expect(resolveTemplateVariables("Hallo {{firstName}} von {{companyName}}", { lead: previewLead, isPreview: true })).toBe(
      "Hallo Max von Muster Spedition GmbH"
    );
    const rendered = renderLandingpageSections(template(addLandingpageSection([], "hero")), null, { isPreview: true });
    expect(rendered[0].settings.headline).toContain(previewLead.firstName);
  });

  it("does not crash when sections json is missing or broken", () => {
    expect(renderLandingpageSections(template(null), null).length).toBeGreaterThan(0);
    expect(renderLandingpageSections(template("not-json"), null).length).toBeGreaterThan(0);
  });

  it("does not crash when list settings are malformed", () => {
    const sections = addLandingpageSection([], "faq");
    const broken = updateLandingpageSection(sections, sections[0].id, {
      settings: { ...sections[0].settings, faqItems: { question: "Kaputt" } as any }
    });
    const rendered = renderLandingpageSections(template(broken), prospect);
    expect(rendered[0].settings.faqItems).toEqual([]);
  });

  it("parses global design json strings safely", () => {
    expect(getGlobalLandingpageDesign({ ...template([]), globalDesignJson: "{\"backgroundColor\":\"#ffffff\"}" }).backgroundColor).toBe("#ffffff");
    expect(getGlobalLandingpageDesign({ ...template([]), globalDesignJson: "not-json" }).backgroundColor).toBe("#F6F8FB");
  });
});
