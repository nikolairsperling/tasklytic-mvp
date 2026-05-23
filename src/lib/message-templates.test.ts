import { describe, expect, it } from "vitest";
import { renderMessageTemplate, sampleLead, scoreMessageTemplate } from "@/lib/message-templates";

describe("message templates", () => {
  it("renders supported variables with sample lead data", () => {
    const result = renderMessageTemplate("Hallo {{Empfaenger_Vorname}}, hier ist {{LandingPage_URL}}.");

    expect(result.rendered).toContain(sampleLead.Empfaenger_Vorname);
    expect(result.rendered).toContain(sampleLead.LandingPage_URL);
    expect(result.missingVariables).toEqual([]);
  });

  it("reports missing variables clearly", () => {
    const result = renderMessageTemplate("Hallo {{Nicht_Vorhanden}}.");

    expect(result.missingVariables).toEqual(["{{Nicht_Vorhanden}}"]);
  });

  it("scores personalized messages higher than empty templates", () => {
    const personalized = scoreMessageTemplate({
      bodyText: "Hallo {{Empfaenger_Vorname}}, ich habe eine Idee für {{Empfaenger_Firma}}. Passt ein kurzer Austausch?",
      targetAudience: "Geschäftsführer von Speditionen",
      category: "first_contact"
    });
    const empty = scoreMessageTemplate({ bodyText: "" });

    expect(personalized.total).toBeGreaterThan(empty.total);
  });
});
