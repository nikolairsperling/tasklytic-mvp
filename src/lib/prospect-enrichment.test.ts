import { describe, expect, it } from "vitest";
import {
  basicExtract,
  applyEnrichmentSuggestions,
  buildStructuredSuggestions,
  buildCandidateUrls,
  extractEmail,
  extractContactCandidates,
  extractVisibleText,
  normalizeWebsiteUrl,
  rejectEnrichmentSuggestions,
  sameDomainOnly,
  suggestionsForEmptyFields
} from "@/lib/prospect-enrichment";
import { prisma } from "@/lib/prisma";

const prospect = {
  id: "p1",
  companyName: "Acme Logistik",
  legalName: null,
  websiteUrl: "https://acme.example",
  city: "Berlin",
  businessFields: [],
  employeeRange: null,
  vehicleCount: null,
  trailerCount: null,
  locationsCount: null,
  isFamilyOwned: null,
  decisionMakerName: null,
  decisionMakerRole: null,
  decisionMakerEmail: null,
  linkedinUrl: null,
  fleetSignalText: null,
  locationSignalText: null,
  contactStructureSignalText: null,
  websiteMaturitySignal: null,
  customPainPoint: null,
  firstName: null,
  lastName: null
} as any;

describe("prospect enrichment", () => {
  it("validates website URLs", () => {
    expect(normalizeWebsiteUrl("example.com").toString()).toBe("https://example.com/");
    expect(() => normalizeWebsiteUrl("ftp://example.com")).toThrow();
  });

  it("limits URLs to the same domain and at most 12 pages", () => {
    const base = new URL("https://www.example.com");
    expect(sameDomainOnly(base, [new URL("https://example.com/kontakt"), new URL("https://other.test")])).toHaveLength(1);
    expect(buildCandidateUrls("https://example.com")).toHaveLength(12);
  });

  it("extracts public email addresses with regex", () => {
    expect(extractEmail("Kontakt: info@example.com")).toBe("info@example.com");
  });

  it("creates suggestions for empty fields only", () => {
    const suggestions = suggestionsForEmptyFields({ ...prospect, decisionMakerEmail: "existing@example.com" }, {
      decisionMakerEmail: "new@example.com",
      legalName: "Acme Logistik GmbH",
      confidence: 45,
      sources: []
    });

    expect(suggestions.legalName).toBe("Acme Logistik GmbH");
    expect(suggestions.decisionMakerEmail).toBeUndefined();
  });

  it("uses basis extraction when OPENAI_API_KEY is absent", () => {
    const result = basicExtract([
      {
        url: "https://example.com",
        text: "Acme Logistik GmbH ist eine Spedition mit 42 Fahrzeugen. Kontakt info@example.com"
      }
    ], "Acme Logistik");

    expect(result.message).toContain("KI-Analyse nicht verfügbar");
    expect(result.businessFields).toContain("Logistik");
    expect(result.decisionMakerEmail).toBeUndefined();
  });

  it("rejects legal and navigation text as contact candidates", () => {
    const candidates = extractContactCandidates([
      {
        url: "https://acme.example/datenschutz",
        text: "Geschäftsführer Ihrer Datenschutzerklärung Telefon +49 30 123 E-Mail info@acme.example"
      },
      {
        url: "https://acme.example/impressum",
        text: "Impressum Zum Inhalt Amtsgericht Gütersloh Handelsregister Umsatzsteuer"
      }
    ], prospect);

    expect(candidates).toHaveLength(0);
  });

  it("keeps plausible real contact candidates and prioritizes business roles", () => {
    const candidates = extractContactCandidates([
      {
        url: "https://acme.example/impressum",
        text: "Geschäftsführer Uwe Merschbrock E-Mail uwe.merschbrock@acme.example Telefon +49 30 123"
      },
      {
        url: "https://acme.example/kontakt",
        text: "Alexander Frik Vertrieb E-Mail alexander.frik@acme.example Telefon +49 30 456"
      }
    ], prospect);

    expect(candidates.map((candidate) => candidate.fullName)).toContain("Uwe Merschbrock");
    expect(candidates.map((candidate) => candidate.fullName)).toContain("Alexander Frik");
    expect(candidates[0]?.fullName).toBe("Uwe Merschbrock");
  });

  it("does not extract person names from headings", () => {
    const text = extractVisibleText("<html><body><h1>Geschäftsführer Polina Gross</h1><p>Kontakt info@acme.example</p></body></html>");

    expect(text).not.toContain("Polina Gross");
  });

  it("removes cookie consent text before extracting visible content", () => {
    const text = extractVisibleText(`
      <html><body>
        <div id="BorlabsCookieBox">
          Cookies Alle akzeptieren Ablehnen Speichern Individuelle Datenschutzeinstellungen
        </div>
        <main><h1>SLH Logistik</h1><p>Spedition und Transport mit Kontakt info@s-l-h.de.</p></main>
      </body></html>
    `);

    expect(text).toContain("SLH Logistik");
    expect(text).toContain("info@s-l-h.de");
    expect(text).not.toContain("Alle akzeptieren");
    expect(text).not.toContain("Datenschutzeinstellungen");
  });

  it("stores structured suggestions without overwriting existing values", () => {
    const result = buildStructuredSuggestions({ ...prospect, decisionMakerName: "Michael Schneider" }, {
      decisionMakerName: "Max Mustermann",
      phone: "05251 12345",
      confidence: 90,
      sources: [{ url: "https://example.com/impressum", reason: "Impressum" }]
    });

    expect(result.decisionMakerName?.value).toBe("Max Mustermann");
    expect(result.phone).toMatchObject({ value: "05251 12345", source: "impressum", confidence: 90 });
  });

  it("applies and rejects saved suggestions explicitly", async () => {
    const created = await prisma.prospect.create({
      data: {
        companyName: `Suggestion ${Date.now()}`,
        websiteUrl: "https://example.com",
        city: "Berlin",
        country: "DE",
        phone: "030 111",
        businessFields: [],
        enrichmentSuggestions: {
          phone: { value: "030 222", source: "website", confidence: 60 },
          companyEmail: { value: "info@example.com", source: "website", confidence: 90 }
        }
      }
    });

    await applyEnrichmentSuggestions(created.id, ["companyEmail"]);
    const afterApply = await prisma.prospect.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterApply.companyEmail).toBe("info@example.com");
    expect(afterApply.phone).toBe("030 111");
    expect(afterApply.enrichmentSuggestions).toHaveProperty("phone");

    await rejectEnrichmentSuggestions(created.id, ["phone"]);
    const afterReject = await prisma.prospect.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterReject.enrichmentSuggestions).toEqual({});

    await prisma.prospect.delete({ where: { id: created.id } });
  });

  it("stores enrichment runs in the database", async () => {
    const created = await prisma.prospect.create({
      data: {
        companyName: `Acme ${Date.now()}`,
        websiteUrl: "https://example.com",
        city: "Berlin",
        country: "DE",
        businessFields: []
      }
    });
    const result = basicExtract([{ url: "https://example.com", text: "Kontakt info@example.com" }], "Acme");
    const run = await prisma.prospectEnrichmentRun.create({
      data: {
        prospectId: created.id,
        status: "completed",
        sourceUrl: "https://example.com",
        pagesScanned: 1,
        confidence: result.confidence,
        suggestionsJson: suggestionsForEmptyFields(prospect, result),
        sourcesJson: result.sources
      }
    });

    expect(run.pagesScanned).toBe(1);
    expect(run.suggestionsJson).toHaveProperty("companyEmail");

    await prisma.prospect.delete({ where: { id: created.id } });
  });
});
