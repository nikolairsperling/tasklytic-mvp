import { afterEach, describe, expect, it } from "vitest";
import { buildCampaignCopyPrompt, countWords, ensureCampaignCopyQuality, parseGeneratedCampaignVariants } from "@/lib/ai-copy";
import { POST } from "../../app/api/ai/generate-campaign-copy/route";
import { prisma } from "@/lib/prisma";
import { defaultUserId, upsertUserOffer } from "@/lib/user-offer";

afterEach(async () => {
  await prisma.offer.deleteMany({ where: { workspaceId: "default", campaigns: { none: {} } } });
  await prisma.userOffer.deleteMany({ where: { userId: defaultUserId } });
});

describe("buildCampaignCopyPrompt", () => {
  it("normalizes AI variant labels from German labels to enum values", () => {
    const result = parseGeneratedCampaignVariants({
      variants: [
        { label: "Variante A", subject: "A", body: "Text A" },
        { label: "Variante B", subject: "B", body: "Text B" }
      ]
    });

    expect(result.variants[0].label).toBe("A");
    expect(result.variants[1].label).toBe("B");
  });

  it("returns a friendly error for invalid AI variant labels", () => {
    expect(() =>
      parseGeneratedCampaignVariants({
        variants: [
          { label: "Variante C", subject: "A", body: "Text A" },
          { label: "Variante B", subject: "B", body: "Text B" }
        ]
      })
    ).toThrow("KI-Antwort konnte nicht gelesen werden");
  });

  it("uses only provided prospect data", () => {
    const prompt = buildCampaignCopyPrompt({
      prospect: {
        companyName: "Bauer Logistik",
        decisionMakerName: "Max Bauer",
        city: "Hamburg",
        painSignals: [{ type: "recruiting", label: "Fahrer gesucht", strength: 30 }],
        landingpageUrl: "/p/bauer",
        videoUrl: "https://video.example"
      },
      tone: "direkt",
      variantCount: 2,
      goal: "Termin",
      addressForm: "sie",
      offerContext: "Offer-Kontext:\nDienstleistung: KI Automatisierung\nZielgruppe: Speditionen\nTypische Probleme: manuelle Disposition\nLoesung: automatisierte Workflows"
    });

    expect(prompt.user).toContain("companyName: Bauer Logistik");
    expect(prompt.user).toContain('"recruiting"');
    expect(prompt.user).toContain("landingpageUrl: /p/bauer");
    expect(prompt.user).toContain("videoUrl: https://video.example");
    expect(prompt.user).toContain("Varianten: 2");
    expect(prompt.user).toContain("Anredeform: sie");
    expect(prompt.system).toContain("Sie-Form");
    expect(prompt.user).toContain("Dienstleistung: KI Automatisierung");
    expect(prompt.user).toContain("Loesung: automatisierte Workflows");
    expect(prompt.system).toContain("ohne Gedankenstriche");
    expect(prompt.system).toContain("genau 2 Varianten");
    expect(prompt.system).toContain("nur als vorsichtige Hypothese");
    expect(prompt.user).toContain("keine harten Behauptungen");
  });

  it("blocks API calls when OPENAI_API_KEY is missing and does not return a key", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await upsertUserOffer({
      businessName: "OpsPilot",
      serviceDescription: "KI Automatisierung fuer operative Prozesse",
      targetAudienceDescription: "Speditionen",
      coreProblems: ["manuelle Anfragebearbeitung"],
      solutions: ["automatisierte Workflows"],
      valueProposition: "schnell live",
      toneOfVoice: "direkt"
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-campaign-copy", {
        method: "POST",
        body: JSON.stringify({ prospectId: "x" })
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(data)).not.toContain("sk-");

    if (original) {
      process.env.OPENAI_API_KEY = original;
    }
  });

  it("normalizes campaign copy to include company, pain signal and landingpage and keeps it short", () => {
    const result = ensureCampaignCopyQuality(
      {
        label: "A",
        subject: "Kurze Frage",
        body: "Hallo, ich wollte mich kurz melden. Ich hoffe, es geht Ihnen gut."
      },
      {
        companyName: "Bauer Logistik",
        decisionMakerName: null,
        city: "Hamburg",
        painSignals: [{ type: "recruiting", label: "Fahrer gesucht", strength: 30 }],
        landingpageUrl: "/p/bauer",
        videoUrl: "https://video.example"
      }
    );

    expect(result.body).toContain("Bauer Logistik");
    expect(result.body).toContain("Ein möglicher Ansatzpunkt ist Fahrer gesucht");
    expect(result.body).toContain("/p/bauer");
    expect(result.body).not.toMatch(/hat probleme|leidet unter|chaos/i);
    expect(result.body).not.toMatch(/ich hoffe, es geht ihnen gut/i);
    expect(countWords(result.body)).toBeLessThanOrEqual(120);
  });
});
