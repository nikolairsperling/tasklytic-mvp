import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/user-offer/route";
import { GET as listOffersApi, POST as createOfferApi } from "../../app/api/offers/route";
import { GET as getOfferApi, PATCH as patchOfferApi } from "../../app/api/offers/[id]/route";
import { POST as duplicateOfferApi } from "../../app/api/offers/[id]/duplicate/route";
import { POST as setDefaultOfferApi } from "../../app/api/offers/[id]/set-default/route";
import { GET as getOfferSettings, PATCH as patchOfferSettings } from "../../app/api/settings/offer/route";
import { POST as scoreProspect } from "../../app/api/prospects/[id]/score/route";
import { prisma } from "@/lib/prisma";
import { defaultWorkspaceId, getUserOffer, missingOfferMessage, resolveOfferForProspect, safeDatabaseUrlForLog, userOfferContextText } from "@/lib/user-offer";

afterEach(async () => {
  await prisma.campaign.deleteMany({ where: { offer: { workspaceId: defaultWorkspaceId } } });
  await prisma.offer.deleteMany({ where: { workspaceId: defaultWorkspaceId, campaigns: { none: {} } } });
  await prisma.userOffer.deleteMany({ where: { userId: defaultWorkspaceId } });
});

describe("user offer profile", () => {
  it("saves the offer profile", async () => {
    const response = await POST(new Request("http://localhost/api/user-offer", {
      method: "POST",
      body: JSON.stringify(validOfferPayload())
    }));
    const body = await response.json() as { serviceDescription: string; coreProblems: string[] };

    expect(response.status).toBe(200);
    expect(body.serviceDescription).toBe("KI Automatisierung fuer operative Prozesse");
    expect(body.coreProblems).toContain("manuelle Anfragebearbeitung");
    await expect(getUserOffer()).resolves.toMatchObject({ targetAudienceDescription: "Speditionen und Logistikunternehmen" });
  });

  it("stores and loads the offer through settings API", async () => {
    const patchResponse = await patchOfferSettings(new Request("http://localhost/api/settings/offer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validOfferPayload())
    }));
    const patchBody = await patchResponse.json() as { businessName: string; coreProblems: string[]; workspaceId: string };

    expect(patchResponse.status).toBe(200);
    expect(patchBody.workspaceId).toBe(defaultWorkspaceId);
    expect(patchBody.businessName).toBe("OpsPilot");
    expect(patchBody.coreProblems).toEqual(["manuelle Anfragebearbeitung", "lange Reaktionszeiten"]);

    const getResponse = await getOfferSettings();
    const getBody = await getResponse.json() as { targetAudienceDescription: string; solutions: string[]; workspaceId: string };

    expect(getResponse.status).toBe(200);
    expect(getBody.workspaceId).toBe(defaultWorkspaceId);
    expect(getBody.targetAudienceDescription).toBe("Speditionen und Logistikunternehmen");
    expect(getBody.solutions).toContain("automatisierte Workflows");
  });

  it("creates multiple offers and keeps one default offer", async () => {
    const first = await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Angebot für Speditionen", isDefault: true })
    }));
    const second = await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Angebot für Ärzte", targetAudienceDescription: "Arztpraxen" })
    }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const list = await listOffersApi();
    const offers = await list.json() as Array<{ name: string; isDefault: boolean }>;
    expect(offers.map((offer) => offer.name)).toEqual(expect.arrayContaining(["Angebot für Speditionen", "Angebot für Ärzte"]));
    expect(offers.filter((offer) => offer.isDefault)).toHaveLength(1);
  });

  it("set-default sets only one default offer", async () => {
    const first = await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Angebot für Speditionen", isDefault: true })
    }));
    const second = await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Angebot für Ärzte", targetAudienceDescription: "Arztpraxen" })
    }));
    await first.json();
    const offerB = await second.json() as { id: string };

    const response = await setDefaultOfferApi(new Request(`http://localhost/api/offers/${offerB.id}/set-default`, { method: "POST" }), {
      params: Promise.resolve({ id: offerB.id })
    });

    expect(response.status).toBe(200);

    const list = await listOffersApi();
    const offers = await list.json() as Array<{ id: string; isDefault: boolean }>;
    const defaults = offers.filter((offer) => offer.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(offerB.id);
  });

  it("duplicate creates a third offer", async () => {
    const first = await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Angebot für Speditionen", isDefault: true })
    }));
    await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Angebot für Ärzte", targetAudienceDescription: "Arztpraxen" })
    }));
    const offerA = await first.json() as { id: string };

    const response = await duplicateOfferApi(new Request(`http://localhost/api/offers/${offerA.id}/duplicate`, { method: "POST" }), {
      params: Promise.resolve({ id: offerA.id })
    });

    expect(response.status).toBe(201);

    const list = await listOffersApi();
    const offers = await list.json() as Array<{ name: string }>;
    expect(offers).toHaveLength(3);
    expect(offers.map((offer) => offer.name)).toContain("Angebot für Speditionen Kopie");
  });

  it("loads and updates a stored offer through /api/offers/[id]", async () => {
    const createResponse = await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Persistentes Angebot", isDefault: true })
    }));
    const created = await createResponse.json() as { id: string };

    const patchResponse = await patchOfferApi(new Request(`http://localhost/api/offers/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...validOfferPayload(), name: "Aktualisiertes Angebot", valueProposition: "messbar schneller live", isDefault: true })
    }), { params: Promise.resolve({ id: created.id }) });
    const patched = await patchResponse.json() as { id: string; name: string; valueProposition: string };

    expect(patchResponse.status).toBe(200);
    expect(patched.name).toBe("Aktualisiertes Angebot");
    expect(patched.valueProposition).toBe("messbar schneller live");

    const getResponse = await getOfferApi(new Request(`http://localhost/api/offers/${created.id}`), {
      params: Promise.resolve({ id: created.id })
    });
    const loaded = await getResponse.json() as { id: string; name: string };

    expect(getResponse.status).toBe(200);
    expect(loaded).toMatchObject({ id: created.id, name: "Aktualisiertes Angebot" });
  });

  it("uses an existing offer as fallback when no default offer is set", async () => {
    await prisma.offer.create({
      data: offerData({ name: "Fallback Angebot", isDefault: false })
    });

    await expect(getUserOffer()).resolves.toMatchObject({ name: "Fallback Angebot" });
  });

  it("resolves campaign offer, target group default offer and global default offer", async () => {
    const defaultOffer = await prisma.offer.create({
      data: offerData({ name: "Default Angebot", isDefault: true })
    });
    const targetOffer = await prisma.offer.create({
      data: offerData({ name: "Zielgruppen Angebot", isDefault: false })
    });
    const campaignOffer = await prisma.offer.create({
      data: offerData({ name: "Kampagnen Angebot", isDefault: false })
    });
    const targetGroup = await prisma.targetGroup.create({
      data: {
        name: `TG ${Date.now()}`,
        defaultOfferId: targetOffer.id,
        industryKeywords: [],
        painKeywords: [],
        icpRules: {},
        emailTone: "direkt",
        landingpageStyle: "klar",
        videoStyle: "kurz"
      }
    });
    const campaign = await prisma.campaign.create({
      data: { name: `Campaign ${Date.now()}`, offerId: campaignOffer.id, steps: { create: { position: 0, stepNumber: 1, delayDays: 0, subject: "A", bodyText: "B", body: "B" } } }
    });

    await expect(resolveOfferForProspect({ targetGroupId: targetGroup.id, suggestedOfferId: null }, { campaignId: campaign.id })).resolves.toMatchObject({ id: campaignOffer.id });
    await expect(resolveOfferForProspect({ targetGroupId: targetGroup.id, suggestedOfferId: null })).resolves.toMatchObject({ id: targetOffer.id });
    await expect(resolveOfferForProspect({ targetGroupId: null, suggestedOfferId: null })).resolves.toMatchObject({ id: defaultOffer.id });

    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });

  it("keeps offers after a new PrismaClient reconnect", async () => {
    await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Angebot für Speditionen", isDefault: true })
    }));
    await createOfferApi(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ ...validOfferPayload(), name: "Angebot für Ärzte", targetAudienceDescription: "Arztpraxen" })
    }));

    const freshPrisma = new PrismaClient();
    try {
      const offers = await freshPrisma.offer.findMany({ where: { workspaceId: defaultWorkspaceId } });
      expect(offers.map((offer) => offer.name)).toEqual(expect.arrayContaining(["Angebot für Speditionen", "Angebot für Ärzte"]));
    } finally {
      await freshPrisma.$disconnect();
    }
  });

  it("validates empty required fields through settings API", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await patchOfferSettings(new Request("http://localhost/api/settings/offer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validOfferPayload(),
        serviceDescription: "",
        coreProblems: ""
      })
    }));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Bitte beschreibe dein Angebot");
    expect(body.error).toContain("Bitte nenne mindestens ein Problem");
    consoleError.mockRestore();
  });

  it("loads and saves the setup form through the offers endpoint", () => {
    const offersPageSource = readFileSync("app/admin/setup/offers/page.tsx", "utf8");
    const pageSource = readFileSync("app/admin/setup/offer/page.tsx", "utf8");
    const panelSource = readFileSync("src/components/admin/offer-settings-panel.tsx", "utf8");

    expect(pageSource).toContain('redirect("/admin/setup/offers")');
    expect(offersPageSource).toContain('fetch("/api/offers"');
    expect(offersPageSource).toContain('method: selectedId ? "PATCH" : "POST"');
    expect(offersPageSource).toContain("Neues Angebot");
    expect(panelSource).toContain('fetch("/api/offers", { method: "GET", cache: "no-store" })');
    expect(panelSource).toContain('selectedOfferId ? `/api/offers/${selectedOfferId}` : "/api/offers"');
    expect(panelSource).toContain('"Content-Type": "application/json"');
    expect(panelSource).toContain("Angebot gespeichert");
    expect(panelSource).toContain("setForm(normalizeOffer(offer))");
    expect(`${offersPageSource}\n${panelSource}`).not.toContain("/api/settings/offer");
  });

  it("checks the offer in the lead drawer through the offers API", () => {
    const panelSource = readFileSync("src/components/admin/prospect-crm-panel.tsx", "utf8");

    expect(panelSource).toContain('fetch("/api/offers", { method: "GET", cache: "no-store" })');
    expect(panelSource).toContain("offerStatus");
    expect(panelSource).toContain("missingOfferMessage");
    expect(panelSource).not.toContain("/api/settings/offer");
  });

  it("uses a redacted database URL in offer debug logs", () => {
    expect(safeDatabaseUrlForLog("postgresql://user:secret@localhost:5432/tasklytic?schema=public")).toBe(
      "postgresql://***:***@localhost:5432/tasklytic?schema=public"
    );
  });

  it("blocks usage without offer", async () => {
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Offer Block ${Date.now()}`,
        city: "Hamburg",
        country: "DE",
        businessFields: ["Spedition"]
      }
    });

    const response = await scoreProspect(new Request("http://localhost/api/prospects/id/score", { method: "POST" }), {
      params: Promise.resolve({ id: prospect.id })
    });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain(missingOfferMessage);

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("formats offer context for AI prompts", () => {
    const context = userOfferContextText({
      businessName: "OpsPilot",
      serviceDescription: "KI Automatisierung fuer operative Prozesse",
      targetAudienceDescription: "Speditionen und Logistikunternehmen",
      coreProblems: ["manuelle Anfragebearbeitung", "lange Reaktionszeiten"],
      solutions: ["automatisierte Workflows", "personalisierte Follow-ups"],
      valueProposition: "schnell live ohne IT-Projekt",
      toneOfVoice: "direkt"
    });

    expect(context).toContain("Dienstleistung: KI Automatisierung fuer operative Prozesse");
    expect(context).toContain("Zielgruppe: Speditionen und Logistikunternehmen");
    expect(context).toContain("Typische Probleme: manuelle Anfragebearbeitung, lange Reaktionszeiten");
    expect(context).toContain("Loesung: automatisierte Workflows, personalisierte Follow-ups");
  });
});

function validOfferPayload() {
  return {
    businessName: "OpsPilot",
    serviceDescription: "KI Automatisierung fuer operative Prozesse",
    targetAudienceDescription: "Speditionen und Logistikunternehmen",
    coreProblems: "manuelle Anfragebearbeitung\nlange Reaktionszeiten",
    solutions: "automatisierte Workflows\npersonalisierte Follow-ups",
    valueProposition: "schnell live ohne IT-Projekt",
    toneOfVoice: "direkt"
  };
}

function offerData(overrides: { name: string; isDefault: boolean }) {
  return {
    workspaceId: defaultWorkspaceId,
    name: overrides.name,
    businessName: "OpsPilot",
    serviceDescription: "KI Automatisierung",
    targetAudienceDescription: "B2B",
    coreProblems: ["manuell"],
    solutions: ["automatisiert"],
    valueProposition: "schnell live",
    toneOfVoice: "direkt",
    isDefault: overrides.isDefault
  };
}
