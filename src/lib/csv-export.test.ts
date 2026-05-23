import type { Prospect } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseProspectsCsv, prospectsToCsv } from "@/lib/csv";
import { type ProspectStatus } from "@/lib/prospect-status";

describe("prospectsToCsv", () => {
  it("exports the required csv fields including the landingpage url", () => {
    const prospect = {
      id: "abc",
      slug: "bauer-stuttgart",
      companyName: "Bauer Transporte",
      legalName: null,
      websiteUrl: "https://bauer.example",
      city: "Stuttgart",
      state: null,
      country: "DE",
      employeeRange: null,
      vehicleCount: null,
      trailerCount: null,
      locationsCount: null,
      businessFields: [],
      isFamilyOwned: null,
      decisionMakerName: "Max Bauer",
      decisionMakerRole: null,
      decisionMakerEmail: "max@bauer.example",
      linkedinUrl: null,
      openDispatcherJob: false,
      jobUrl: null,
      jobSignalText: null,
      fleetSignalText: null,
      locationSignalText: null,
      contactStructureSignalText: null,
      websiteMaturitySignal: null,
      icpFitScore: 0,
      timingScore: 0,
      painScore: 0,
      contactQualityScore: 0,
      totalScore: 88,
      status: "qualified" as ProspectStatus,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    } satisfies Prospect;

    const csv = prospectsToCsv([prospect], "https://app.tasklytic.de");

    expect(csv).toContain("companyName,city,websiteUrl,decisionMakerName,decisionMakerEmail,totalScore,status,landingpageUrl");
    expect(csv).toContain("Bauer Transporte,Stuttgart,https://bauer.example,Max Bauer,max@bauer.example,88,qualified,https://app.tasklytic.de/p/bauer-stuttgart");
  });

  it("preserves umlauts and empty values in export output", () => {
    const prospect = {
      id: "def",
      slug: null,
      companyName: "Müller Spedition",
      legalName: null,
      websiteUrl: null,
      city: "Köln",
      state: null,
      country: "DE",
      employeeRange: null,
      vehicleCount: null,
      trailerCount: null,
      locationsCount: null,
      businessFields: [],
      isFamilyOwned: null,
      decisionMakerName: null,
      decisionMakerRole: null,
      decisionMakerEmail: null,
      linkedinUrl: null,
      openDispatcherJob: false,
      jobUrl: null,
      jobSignalText: null,
      fleetSignalText: null,
      locationSignalText: null,
      contactStructureSignalText: null,
      websiteMaturitySignal: null,
      icpFitScore: 0,
      timingScore: 0,
      painScore: 0,
      contactQualityScore: 0,
      totalScore: 0,
      status: "draft" as ProspectStatus,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    } satisfies Prospect;

    const csv = prospectsToCsv([prospect], "https://app.tasklytic.de");

    expect(csv).toContain("Müller Spedition,Köln,,,");
  });

  it("reports the csv row number for invalid rows", () => {
    expect(() =>
      parseProspectsCsv(
        [
          "companyName,city,country,businessFields,websiteUrl",
          "Bauer Transporte,Stuttgart,DE,Spedition,https://bauer.example",
          "Kaputt,Calw,DE,Spedition,not-a-url"
        ].join("\n")
      )
    ).toThrow(/CSV-Zeile 3/);
  });
});
