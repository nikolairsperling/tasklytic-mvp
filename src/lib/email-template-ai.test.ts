import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POST as generateEmailTemplateAi } from "../../app/api/assets/email-templates/ai/route";
import { buildEmailTemplateAiPrompt, parseGeneratedEmailTemplateVariants } from "@/lib/email-template-ai";
import { getEffectiveOpenAiApiKey } from "@/lib/integrations";

vi.mock("@/lib/integrations", () => ({
  getEffectiveOpenAiApiKey: vi.fn()
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(getEffectiveOpenAiApiKey).mockReset();
});

describe("email template AI generation", () => {
  it("builds a logistics fallback prompt and strict template rules", () => {
    const prompt = buildEmailTemplateAiPrompt({
      targetAudience: "",
      offer: "Automatisierte Outreach-Prozesse",
      tone: "direkt",
      addressForm: "sie",
      goal: "Ersttermin anstoßen",
      length: "kurz",
      variantCount: 2
    });

    expect(prompt.user).toContain("Speditionen und Logistikunternehmen");
    expect(prompt.system).toContain("Generiere keine generischen Floskeln");
    expect(prompt.system).toContain("konkreten Schmerzpunkten");
    expect(prompt.system).toContain("keine uebertriebenen Versprechen");
    expect(prompt.system).toContain("Die E-Mail darf nie direkt senden");
    expect(prompt.system).toContain("genau 2 Varianten");
  });

  it("parses generated subject and body variants", () => {
    const result = parseGeneratedEmailTemplateVariants({
      variants: [
        { label: "A", subject: "Kurzer Gedanke zur Dispo", body: "Hallo, falls Abstimmung aktuell Zeit kostet: kurzer Austausch?" },
        { label: "B", subject: "Weniger Nachfassen", bodyText: "Hallo, viele Statusfragen laufen noch manuell. Wäre ein kurzer Blick sinnvoll?" }
      ]
    }, 2);

    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].subject).toBe("Kurzer Gedanke zur Dispo");
    expect(result.variants[0].bodyText).toContain("Abstimmung");
    expect(result.variants[1].bodyText).toContain("Statusfragen");
  });

  it("returns generated variants from the API route", async () => {
    vi.mocked(getEffectiveOpenAiApiKey).mockResolvedValue("sk-test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            variants: [{ label: "A", subject: "Dispo entlasten", bodyText: "Hallo, falls Rückfragen viel Zeit kosten, lohnt ein kurzer Blick." }]
          })
        }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const response = await generateEmailTemplateAi(new Request("http://localhost/api/assets/email-templates/ai", {
      method: "POST",
      body: JSON.stringify({ goal: "Termin", variantCount: 1 })
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.variants[0].subject).toBe("Dispo entlasten");
  });

  it("shows a clear error when the OpenAI key is missing", async () => {
    vi.mocked(getEffectiveOpenAiApiKey).mockResolvedValue(null);

    const response = await generateEmailTemplateAi(new Request("http://localhost/api/assets/email-templates/ai", {
      method: "POST",
      body: JSON.stringify({ goal: "Termin", variantCount: 1 })
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("OpenAI API-Key fehlt. Bitte unter Einstellungen > OpenAI hinterlegen.");
  });
});

describe("email template AI UI", () => {
  it("contains the modal trigger, result actions and form takeover wiring", () => {
    const source = readFileSync(join(process.cwd(), "src/components/admin/asset-list-manager.tsx"), "utf8");
    const page = readFileSync(join(process.cwd(), "app/admin/assets/email-templates/page.tsx"), "utf8");

    expect(page).toContain("enableEmailTemplateAi");
    expect(source).toContain("Mit KI generieren");
    expect(source).toContain("E-Mail-Vorlage mit KI generieren");
    expect(source).toContain("/api/assets/email-templates/ai");
    expect(source).toContain("Als Vorlage speichern");
    expect(source).toContain("Ins Formular übernehmen");
    expect(source).toContain("saveAiVariant");
    expect(source).toContain("applyAiVariant");
    expect(source).toContain("setFormValuesState");
    expect(source).toContain("Es wird keine E-Mail gesendet.");
  });
});
