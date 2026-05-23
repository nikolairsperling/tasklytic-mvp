import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/prospects/[id]/research/route";
import { prisma } from "@/lib/prisma";
import { defaultUserId, upsertUserOffer } from "@/lib/user-offer";

const originalOpenAiKey = process.env.OPENAI_API_KEY;

beforeEach(async () => {
  await upsertUserOffer({
    businessName: "OpsPilot",
    serviceDescription: "KI Automatisierung fuer operative Prozesse",
    targetAudienceDescription: "Speditionen und Logistikunternehmen",
    coreProblems: ["manuelle Anfragebearbeitung", "lange Reaktionszeiten"],
    solutions: ["automatisierte Workflows", "personalisierte Follow-ups"],
    valueProposition: "schnell live ohne IT-Projekt",
    toneOfVoice: "direkt"
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
  await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });
  await prisma.offer.deleteMany({ where: { workspaceId: "default", campaigns: { none: {} } } });
  await prisma.userOffer.deleteMany({ where: { userId: defaultUserId } });
});

describe("lead research API", () => {
  it("sets ICP and company profile fields from heuristic website analysis", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Logistik ${Date.now()}`,
        city: "Bremen",
        country: "DE",
        websiteUrl: "https://research.example",
        companyEmail: "info@research.example",
        businessFields: []
      }
    });
    mockWebsite(`
      <html><title>Spedition</title><body>
        Spedition und Logistik fuer Fracht, LKW und Fuhrpark.
        Karriere: Wir suchen Fahrer und Berufskraftfahrer. Bewerbung per Formular.
        Leistungen: Stückgut, Lagerung, Express und Fernverkehr.
        Unser Team umfasst 42 Mitarbeiter und 18 Fahrzeuge an 2 Standorte.
      </body></html>
    `);

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", {
        method: "POST",
        body: JSON.stringify({ force: true })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as {
      icpFitScore: number;
      icpFitLabel: string;
      industry: string;
      painType: string;
      painSummary: string;
      services: string[];
      employeeCountEstimate: number | null;
      fleetSizeEstimate: number | null;
      companyDescription: string | null;
      hiringSignal: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.icpFitScore).toBeGreaterThan(0);
    expect(body.icpFitLabel).toBe("high");
    expect(body.industry).toBe("Spedition");
    expect(body.painType).toBe("Operative Belastung durch Personalbedarf");
    expect(body.painSummary).toContain("Hypothese");
    expect(body.services).toContain("stückgut");
    expect(body.employeeCountEstimate).toBe(42);
    expect(body.fleetSizeEstimate).toBe(18);
    expect(body.companyDescription).toContain("Spedition");
    expect(body.hiringSignal).toBe(true);

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("rejects cookie text as company description", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Cookie ${Date.now()}`,
        city: "Bremen",
        country: "DE",
        websiteUrl: "https://cookie.example",
        businessFields: []
      }
    });
    mockWebsite("<html><body>welche Seiten beliebt sind, um Ihr Erlebnis und unsere Dienstleistungen zu verbessern. Cookies Datenschutz Google Analytics Tracking Einwilligung Akzeptieren Ablehnen Marketing Cookies.</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", {
        method: "POST",
        body: JSON.stringify({ force: true })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { companyDescription: string | null; companyProfileSummary: string | null };

    expect(response.status).toBe(200);
    expect(body.companyDescription).toBeNull();
    expect(body.companyProfileSummary).toBe("Nicht gefunden");

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("does not store employee or location numbers without matching context", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Numbers ${Date.now()}`,
        city: "Bremen",
        country: "DE",
        websiteUrl: "https://numbers.example",
        employeeCountEstimate: 117,
        locationsCount: 750,
        businessFields: []
      }
    });
    mockWebsite("<html><body>Spedition Transport Logistik seit 117 Jahren. Telefon 0421 750123. PLZ 28195.</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", {
        method: "POST",
        body: JSON.stringify({ force: true })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { employeeCountEstimate: number | null; locationsCount: number | null };

    expect(response.status).toBe(200);
    expect(body.employeeCountEstimate).toBeNull();
    expect(body.locationsCount).toBeNull();

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("stores a real logistics description and employee number with context", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Real Profile ${Date.now()}`,
        city: "Bremen",
        country: "DE",
        websiteUrl: "https://real-profile.example",
        businessFields: []
      }
    });
    mockWebsite("<html><body>Wir sind eine Spedition fuer Transport und Logistik im Nahverkehr und Fernverkehr. Unser Team umfasst 117 Mitarbeiter und betreut Kunden aus Industrie und Handel.</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", {
        method: "POST",
        body: JSON.stringify({ force: true })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { companyDescription: string | null; employeeCountEstimate: number | null };

    expect(response.status).toBe(200);
    expect(body.companyDescription).toContain("Spedition");
    expect(body.companyDescription).toContain("Transport");
    expect(body.companyDescription).toContain("Logistik");
    expect(body.employeeCountEstimate).toBe(117);

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("keeps unknown employee estimates null and runs without OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Unknown ${Date.now()}`,
        city: "Bremen",
        country: "DE",
        websiteUrl: "https://unknown.example",
        businessFields: []
      }
    });
    mockWebsite("<html><body>Transport und Logistik. Anfrage per E-Mail.</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", {
        method: "POST",
        body: JSON.stringify({ force: true })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { employeeCountEstimate: number | null; industry: string; painScore: number };

    expect(response.status).toBe(200);
    expect(body.industry).toBe("Spedition");
    expect(body.painScore).toBeGreaterThan(0);
    expect(body.employeeCountEstimate).toBeNull();

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("uses a neutral fallback when no pain signals are found", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Neutral ${Date.now()}`,
        city: "Bremen",
        country: "DE",
        websiteUrl: "https://neutral.example",
        businessFields: []
      }
    });
    mockWebsite("<html><body>Willkommen auf unserer Website. Kontaktieren Sie uns gerne.</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", {
        method: "POST",
        body: JSON.stringify({ force: true })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { painType: string | null; painSummary: string | null; hiringSignal: boolean };

    expect(response.status).toBe(200);
    expect(body.hiringSignal).toBe(false);
    expect(body.painType).toBe("Kein klarer Schmerzpunkt erkannt");
    expect(body.painSummary).toContain("neutral");

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("fills missing phone and email from website text", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Contact ${Date.now()}`,
        city: "Hamburg",
        country: "DE",
        websiteUrl: "https://contact.example",
        businessFields: []
      }
    });
    mockWebsite("<html><body>Spedition Kontakt Telefon +49 40 123456 E-Mail kontakt@contact.example</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", { method: "POST", body: JSON.stringify({ force: true }) }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { phone: string | null; companyEmail: string | null; updatedFields: string[] };

    expect(response.status).toBe(200);
    expect(body.phone).toContain("+49 40");
    expect(body.companyEmail).toBe("kontakt@contact.example");
    expect(body.updatedFields).toContain("phone");
    expect(body.updatedFields).toContain("companyEmail");

    const saved = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(saved.phone).toContain("+49 40");
    expect(saved.companyEmail).toBe("kontakt@contact.example");
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("does not save website navigation text as a person name", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Navigation ${Date.now()}`,
        city: "Köln",
        country: "DE",
        websiteUrl: "https://navigation.example",
        businessFields: []
      }
    });
    mockWebsite("<html><body>Geschäftsführer Kundenbereich Frachtanfragen Auftragserfassung Kontakt und Anfahrt</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", { method: "POST", body: JSON.stringify({ force: true }) }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { decisionMakerName: string | null; firstName: string | null; lastName: string | null };

    expect(response.status).toBe(200);
    expect(body.decisionMakerName).toBeNull();
    expect(body.firstName).toBeNull();
    expect(body.lastName).toBeNull();

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("stores general email, phone and address as company contact data", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research General Contact ${Date.now()}`,
        city: "Köln",
        country: "DE",
        websiteUrl: "https://emons.example",
        businessFields: []
      }
    });
    mockWebsite({
      "/impressum": "<html><body>Emons Spedition GmbH Waltherstraße 49-51 51069 Köln Deutschland Telefon +49 221 98351-0 E-Mail zentrale@emons.de</body></html>",
      "/leistungen": "<html><body>Leistungen Straße Schiene Luft See Zoll Logistik Digital</body></html>",
      "*": "<html><body>Lieferbedingungen Ein Weitertransport ins Gebäude ist nicht möglich.</body></html>"
    });

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", { method: "POST", body: JSON.stringify({ force: true }) }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as {
      companyEmail: string | null;
      companyPhone: string | null;
      decisionMakerEmail: string | null;
      decisionMakerPhone: string | null;
      street: string | null;
      postalCode: string | null;
      city: string | null;
      country: string | null;
      companyDescription: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.companyEmail).toBe("zentrale@emons.de");
    expect(body.companyPhone).toContain("+49 221");
    expect(body.street).toBe("Waltherstraße 49-51");
    expect(body.postalCode).toBe("51069");
    expect(body.city).toBe("Köln");
    expect(body.country).toBe("Deutschland");
    expect(body.companyDescription).toContain("Logistik- und Speditionsunternehmen");
    expect(body.companyDescription).toContain("Zoll");
    expect(body.decisionMakerEmail).toBeNull();
    expect(body.decisionMakerPhone).toBeNull();

    const saved = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(saved.companyEmail).toBe("zentrale@emons.de");
    expect(saved.companyPhone).toContain("+49 221");
    expect(saved.street).toBe("Waltherstraße 49-51");
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("detects a Geschäftsführer name from the impressum", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Impressum ${Date.now()}`,
        city: "Bremen",
        country: "DE",
        websiteUrl: "https://impressum.example",
        businessFields: []
      }
    });
    mockWebsite({
      "/impressum": "<html><body>Impressum Angaben gemäß § 5 TMG Geschäftsführer Thomas Müller E-Mail thomas.mueller@impressum.example Telefon +49 421 12345</body></html>",
      "*": "<html><body>Kundenbereich Frachtanfragen Auftragserfassung</body></html>"
    });

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", { method: "POST", body: JSON.stringify({ force: true }) }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { decisionMakerName: string | null; firstName: string | null; lastName: string | null; decisionMakerRole: string | null; decisionMakerEmail: string | null; decisionMakerPhone: string | null };

    expect(response.status).toBe(200);
    expect(body.decisionMakerName).toBe("Thomas Müller");
    expect(body.firstName).toBe("Thomas");
    expect(body.lastName).toBe("Müller");
    expect(body.decisionMakerRole).toBe("Geschäftsführer");
    expect(body.decisionMakerEmail).toBe("thomas.mueller@impressum.example");
    expect(body.decisionMakerPhone).toContain("+49 421");

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("does not overwrite existing manual contact values", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Manual ${Date.now()}`,
        city: "Köln",
        country: "DE",
        websiteUrl: "https://manual.example",
        phone: "+49 221 111",
        decisionMakerName: "Sabine Schneider",
        firstName: "Sabine",
        lastName: "Schneider",
        decisionMakerEmail: "sabine@manual.example",
        companyEmail: "manual@example.test",
        businessFields: []
      }
    });
    mockWebsite("<html><body>Logistik Geschäftsführer Thomas Müller Telefon +49 221 999999 E-Mail info@manual.example</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", { method: "POST", body: JSON.stringify({ force: true }) }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { phone: string | null; companyEmail: string | null; decisionMakerName: string | null; decisionMakerEmail: string | null; updatedFields: string[] };

    expect(response.status).toBe(200);
    expect(body.phone).toBe("+49 221 111");
    expect(body.companyEmail).toBe("manual@example.test");
    expect(body.decisionMakerName).toBe("Sabine Schneider");
    expect(body.decisionMakerEmail).toBe("sabine@manual.example");
    expect(body.updatedFields).not.toContain("phone");
    expect(body.updatedFields).not.toContain("companyEmail");
    expect(body.updatedFields).not.toContain("decisionMakerName");
    expect(body.updatedFields).not.toContain("decisionMakerEmail");

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("cleans invalid scraped person data during renewed research", async () => {
    delete process.env.OPENAI_API_KEY;
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Research Cleanup ${Date.now()}`,
        city: "Köln",
        country: "DE",
        websiteUrl: "https://cleanup.example",
        decisionMakerName: "Kundenbereich Frachtanfragen Auftragserfassung",
        firstName: "Kundenbereich",
        lastName: "Frachtanfragen Auftragserfassung",
        businessFields: []
      }
    });
    mockWebsite("<html><body>Spedition Kontakt E-Mail zentrale@emons.de Telefon +49 221 98380</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", { method: "POST", body: JSON.stringify({ force: true }) }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { decisionMakerName: string | null; firstName: string | null; lastName: string | null; updatedFields: string[] };

    expect(response.status).toBe(200);
    expect(body.decisionMakerName).toBeNull();
    expect(body.firstName).toBeNull();
    expect(body.lastName).toBeNull();
    expect(body.updatedFields).toContain("decisionMakerName");
    expect(body.updatedFields).toContain("firstName");
    expect(body.updatedFields).toContain("lastName");

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("reacts to prospect target group keywords", async () => {
    delete process.env.OPENAI_API_KEY;
    const targetGroup = await prisma.targetGroup.create({
      data: {
        name: "Ärzte",
        description: "Arztpraxen",
        industryKeywords: ["praxis", "patienten"],
        painKeywords: ["termin", "abrechnung"],
        icpRules: {},
        emailTone: "professionell",
        landingpageStyle: "vertrauensvoll",
        videoStyle: "ruhig"
      }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Praxis Research ${Date.now()}`,
        city: "Berlin",
        country: "DE",
        websiteUrl: "https://praxis.example",
        targetGroupId: targetGroup.id,
        businessFields: []
      }
    });
    mockWebsite("<html><body>Unsere Praxis betreut Patienten. Termine und Abrechnung sind wichtig.</body></html>");

    const response = await POST(
      new Request("http://localhost/api/prospects/id/research", { method: "POST", body: JSON.stringify({ force: true }) }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { industry: string; painScore: number };

    expect(response.status).toBe(200);
    expect(body.industry).toBe("Ärzte");
    expect(body.painScore).toBeGreaterThan(0);

    await prisma.prospect.delete({ where: { id: prospect.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });
});

function mockWebsite(html: string | Record<string, string>) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const body = typeof html === "string"
      ? html
      : Object.entries(html).find(([path]) => path !== "*" && new URL(url).pathname === path)?.[1] ?? html["*"] ?? "";
    return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html" }
    });
  }));
}
