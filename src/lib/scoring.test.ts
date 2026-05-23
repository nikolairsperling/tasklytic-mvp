import { describe, expect, it } from "vitest";
import { calculateProspectScore } from "@/lib/scoring";

describe("calculateProspectScore", () => {
  it("scores a strong logistics fit high and marks it as hot", () => {
    const result = calculateProspectScore({
      employeeRange: "20-80",
      vehicleCount: 32,
      locationsCount: 3,
      openDispatcherJob: true,
      decisionMakerEmail: "ops@spedition.de",
      decisionMakerName: "Max Beispiel",
      linkedinUrl: "https://linkedin.com/in/max",
      businessFields: ["Spedition"],
      websiteUrl: "https://spedition.example",
      companyStatus: "active",
      websiteMaturitySignal: "veraltet",
      fleetSignalText: "viele Fahrzeuge",
      contactStructureSignalText: "nur telefonisch erreichbar"
    });

    expect(result.icpScore).toBeGreaterThanOrEqual(70);
    expect(result.painScore).toBeGreaterThanOrEqual(60);
    expect(result.fitScore).toBeGreaterThan(70);
    expect(result.totalScore).toBe(result.fitScore);
    expect(result.icpCategory).toBe("hot");
    expect(result.isHotLead).toBe(true);
  });

  it("keeps info contacts below direct decision-maker contacts", () => {
    const generic = calculateProspectScore({
      decisionMakerEmail: "info@firma.de"
    });
    const direct = calculateProspectScore({
      decisionMakerEmail: "dispo@firma.de"
    });

    expect(direct.contactQualityScore).toBeGreaterThan(generic.contactQualityScore);
  });

  it("returns bounded fallback scores for sparse prospect data", () => {
    const result = calculateProspectScore({});

    expect(result.icpFitScore).toBeGreaterThanOrEqual(0);
    expect(result.timingScore).toBeGreaterThanOrEqual(0);
    expect(result.painScore).toBeGreaterThanOrEqual(0);
    expect(result.contactQualityScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
  });

  it("classifies medium and low leads by fit score thresholds", () => {
    const medium = calculateProspectScore({
      websiteUrl: "https://spedition.example",
      companyName: "Spedition Beispiel",
      businessFields: ["Logistik"],
      employeeRange: "10-100",
      decisionMakerName: "Max Beispiel",
      decisionMakerEmail: "max@example.com"
    });
    const low = calculateProspectScore({
      companyName: "Kaffee GmbH",
      websiteUrl: "https://kaffee.example"
    });

    expect(medium.icpCategory).toBe("medium");
    expect(medium.isHotLead).toBe(false);
    expect(low.icpCategory).toBe("low");
  });

  it("sets pain signals for recruiting, fleet size, missing online request and outdated website", () => {
    const result = calculateProspectScore({
      businessFields: ["Logistik"],
      employeeRange: "10-100",
      websiteUrl: "https://spedition.example",
      decisionMakerName: "Mia Muster",
      decisionMakerEmail: "mia@example.com",
      openDispatcherJob: true,
      vehicleCount: 45,
      websiteMaturitySignal: "Veraltete Website, kein Formular, nur telefonisch erreichbar",
      contactStructureSignalText: "Keine Online-Anfrage"
    });

    expect(result.painSignals.map((signal) => signal.type)).toEqual(
      expect.arrayContaining(["recruiting", "fleet_size", "online_request", "outdated_website", "contact_visibility"])
    );
    expect(result.painScore).toBeGreaterThanOrEqual(60);
    expect(result.isHotLead).toBe(true);
  });
});
