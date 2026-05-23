import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAssetUrl,
  enrichProspectFromApi,
  getExternalOrPublicLandingpageUrl,
  ProspectCrmPanel,
  type ProspectCrmPanelData
} from "@/components/admin/prospect-crm-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

const prospect: ProspectCrmPanelData = {
  id: "prospect-1",
  companyName: "Acme Logistik",
  legalName: "Acme Logistik GmbH",
  salutation: "Herr",
  firstName: "Max",
  lastName: "Muster",
  decisionMakerName: "Max Muster",
  decisionMakerRole: "Geschäftsführer",
  decisionMakerEmail: "max@example.com",
  decisionMakerPhone: "+49 30 456",
  companyEmail: "info@example.com",
  companyPhone: "+49 30 123",
  contactPageUrl: "https://acme.example/kontakt",
  generalContactLabel: "Allgemeiner Firmenkontakt",
  phone: "+49 30 123",
  linkedinUrl: "https://linkedin.com/in/max",
  websiteUrl: "https://acme.example",
  city: "Berlin",
  postalCode: "10115",
  street: "Hauptstraße 1",
  state: "Berlin",
  country: "DE",
  employeeRange: "20-50",
  employeeCount: null,
  vehicleCount: 12,
  trailerCount: 5,
  locationsCount: 2,
  businessFields: ["Logistik"],
  companyStatus: "active",
  icpScore: 77,
  icpFitScore: 82,
  icpFitLabel: "high",
  industry: "Logistik/Spedition",
  painScore: 30,
  painType: "Operative Belastung durch Personalbedarf",
  painSummary: "Die Website zeigt Hinweise auf Personalbedarf. Das ist eine Hypothese.",
  painEvidence: [{ keyword: "fahrer", source: "https://acme.example/jobs", excerpt: "Wir suchen Fahrer" }],
  hiringSignal: true,
  growthSignal: false,
  manualProcessSignal: true,
  digitalWeaknessSignal: false,
  personalizationAngle: "Recruiting entlasten",
  researchStatus: "completed",
  researchSources: [{ url: "https://acme.example", ok: true }],
  researchedAt: "2026-04-27T10:00:00.000Z",
  companyDescription: "Acme transportiert Stückgut.",
  services: ["Stückgut", "Lagerung"],
  companySizeLabel: "medium",
  employeeCountEstimate: null,
  fleetSizeEstimate: 12,
  specialization: "Stückgut",
  targetCustomers: "Industriekunden",
  companyProfileSummary: "Logistikdienstleister mit Stückgut-Fokus.",
  painSignals: [{ type: "recruiting", label: "Fahrer gesucht", strength: 30 }],
  customPainPoint: "Recruiting Engpass",
  engagementScore: 42,
  engagementLevel: "warm",
  status: "qualified",
  leadStatus: "interested",
  targetGroupId: null,
  targetGroup: null,
  targetGroups: [{ id: "tg-1", name: "Ärzte" }],
  followUpAt: null,
  followUpReason: null,
  followUpStatus: "open",
  lastContactedAt: null,
  lastEmailSentAt: null,
  assignedTo: "Anna",
  showInCrm: true,
  source: "Import",
  slug: "acme-logistik",
  landingpageUrl: "https://example.com/p/acme-logistik",
  landingpageReviewStatus: "approved",
  personalVideoStatus: "none",
  personalVideoUrl: null,
  videoUrl: null,
  notes: [{ id: "note-1", text: "Erster Kontakt gut.", createdAt: "2026-04-27T10:00:00.000Z" }],
  events: [],
  activeCampaign: {
    id: "campaign-1",
    enrollmentId: "enrollment-1",
    name: "April Outreach",
    status: "active",
    enrollmentStatus: "active"
  }
};

describe("ProspectCrmPanel", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the prospect drawer shell with tabs and status control", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, { prospect, mode: "drawer" }));

    expect(html).toContain("Acme Logistik");
    expect(html).toContain("Engagement 42");
    expect(html).toContain("Infos");
    expect(html).toContain("Journey");
    expect(html).toContain("Links");
    expect(html).toContain("Interessiert");
    expect(html).toContain("April Outreach");
    expect(html).toContain("Bearbeiten");
    expect(html).toContain("ICP &amp; Schmerzpunkt");
    expect(html).toContain("Firmenprofil");
    expect(html).toContain("Signal erkannt");
    expect(html).toContain("Personalbedarf erkannt");
    expect(html).toContain("Schmerzpunkt-Hypothese");
    expect(html).toContain("Operative Belastung durch Personalbedarf");
    expect(html).toContain("Acme transportiert Stückgut.");
    expect(html).not.toContain("Endgültig löschen");
  });

  it("disables ICP analysis when no website exists", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, {
      prospect: { ...prospect, websiteUrl: null },
      mode: "drawer"
    }));

    expect(html).toContain("Daten anreichern");
    expect(html).toContain("Keine Website vorhanden");
    expect(html).toContain("disabled");
  });

  it("keeps enrichment debug and contact candidates hidden by default", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, {
      prospect: {
        ...prospect,
        researchSources: {
          enrichmentDebug: {
            steps: {
              crawl: { urls: ["https://acme.example/kontakt"] },
              rawExtraction: { emails: ["info@acme.example"], phones: ["+49 30 123"] },
              persistence: { savedFields: { manualProcessSignal: true, digitalWeaknessSignal: true } }
            }
          }
        },
        contactCandidates: [{ fullName: "Alexander Frik", role: "Vertrieb", email: "alexander.frik@acme.example", phone: "+49 30 456", sourceUrl: "https://acme.example/kontakt" }]
      },
      mode: "drawer"
    }));

    expect(html).toContain("Debug anzeigen");
    expect(html).toContain("Kontaktkandidaten prüfen");
    expect(html).not.toContain("Gecrawlte URLs");
    expect(html).not.toContain("Gefundene E-Mails");
    expect(html).not.toContain("manualProcessSignal");
    expect(html).not.toContain("Alexander Frik");
  });

  it("does not render legal text as a contact person", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, {
      prospect: {
        ...prospect,
        firstName: "Ihrer",
        lastName: "Datenschutzerklärung",
        decisionMakerName: "Ihrer Datenschutzerklärung",
        decisionMakerRole: "Geschäftsführer",
        decisionMakerEmail: null,
        decisionMakerPhone: null,
        contactCandidates: []
      },
      mode: "drawer"
    }));

    expect(html).toContain("Keine verlässliche Kontaktperson gefunden");
    expect(html).not.toContain("Ihrer Datenschutzerklärung");
  });

  it("calls the enrichment API and reloads the drawer prospect", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/prospects/prospect-1/enrich") {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ suggestions: { phone: { value: "+49 30 999", source: "website", confidence: 90 }, companyEmail: { value: "kontakt@acme.example", source: "website", confidence: 90 } } }), { status: 200 });
      }
      if (url === "/api/prospects/prospect-1") {
        return new Response(JSON.stringify({ ...prospect, phone: "+49 30 999", companyEmail: "kontakt@acme.example" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });

    const result = await enrichProspectFromApi(prospect, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.updatedFieldCount).toBe(2);
    expect(result.prospect.phone).toBe("+49 30 999");
    expect(result.prospect.companyEmail).toBe("kontakt@acme.example");
  });

  it("surfaces research errors", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "Website konnte nicht analysiert werden." }), { status: 500 }));

    await expect(enrichProspectFromApi(prospect, fetchMock as unknown as typeof fetch)).rejects.toThrow("Website konnte nicht analysiert werden.");
  });

  it("shows an empty journey state when no events exist", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, { prospect, mode: "drawer", initialTab: "journey" }));

    expect(html).toContain("Noch keine Activity Events vorhanden.");
  });

  it("shows the landingpage URL in the links tab", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, { prospect, mode: "drawer", initialTab: "links" }));

    expect(html).toContain("Personalisierte Landingpage");
    expect(html).toContain("/p/acme-logistik");
    expect(html).toContain("Kopieren");
    expect(html).toContain("Vorschau");
    expect(html).not.toContain("/admin/prospects/prospect-1/landingpage");
    expect(html).not.toContain("/admin/preview/");
  });

  it("uses /p/[slug] for landingpage preview and copy targets", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, {
      prospect: { ...prospect, landingpageUrl: "/admin/preview/acme-logistik" },
      mode: "drawer",
      initialTab: "links"
    }));

    expect(html).toContain('href="/p/acme-logistik"');
    expect(html).not.toContain("/admin/preview/acme-logistik");
  });

  it("disables landingpage preview when the slug is missing", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, {
      prospect: { ...prospect, slug: null, landingpageUrl: null },
      mode: "drawer",
      initialTab: "links"
    }));

    expect(html).toContain("Landingpage noch nicht generiert");
    expect(html).toContain("disabled");
    expect(html).not.toContain('href="/p/');
  });

  it("disables video actions when no video URL exists", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, {
      prospect: { ...prospect, personalVideoUrl: null, videoUrl: null },
      mode: "drawer",
      initialTab: "links"
    }));

    expect(html).toContain("Video noch nicht erstellt");
    expect(html).toContain("disabled");
  });

  it("links mock video assets to the reachable mock video route", () => {
    const html = renderToStaticMarkup(React.createElement(ProspectCrmPanel, {
      prospect: { ...prospect, personalVideoUrl: "/mock-videos/acme-logistik" },
      mode: "drawer",
      initialTab: "links"
    }));

    expect(html).toContain("/mock-videos/acme-logistik");
    expect(html).toContain('href="/mock-videos/acme-logistik"');
  });

  it("builds absolute asset URLs from APP_URL and rejects admin preview landingpage URLs", () => {
    expect(buildAssetUrl("/p/acme-logistik", "https://app.example/")).toBe("https://app.example/p/acme-logistik");
    expect(buildAssetUrl("https://cdn.example/video.mp4", "https://app.example")).toBe("https://cdn.example/video.mp4");
    expect(getExternalOrPublicLandingpageUrl("https://app.example/admin/preview/acme-logistik", "/p/acme-logistik")).toBe("/p/acme-logistik");
    expect(getExternalOrPublicLandingpageUrl("https://landing.example/acme", "/p/acme-logistik")).toBe("https://landing.example/acme");
  });
});
