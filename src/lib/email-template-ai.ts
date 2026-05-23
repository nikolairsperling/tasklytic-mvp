import { z } from "zod";
import { getEffectiveOpenAiApiKey } from "@/lib/integrations";

export type EmailTemplateAiVariant = {
  label: string;
  subject: string;
  bodyText: string;
};

const missingOpenAiKeyMessage = "OpenAI API-Key fehlt. Bitte unter Einstellungen > OpenAI hinterlegen.";

const payloadSchema = z.object({
  targetAudience: z.string().trim().max(300).optional().default(""),
  offer: z.string().trim().max(500).optional().default(""),
  tone: z.string().trim().max(160).optional().default(""),
  addressForm: z.enum(["du", "sie"]).default("sie"),
  goal: z.string().trim().min(1, "Ziel der E-Mail ist erforderlich.").max(300),
  length: z.enum(["kurz", "mittel", "ausführlich", "ausfuehrlich"]).default("kurz"),
  variantCount: z.coerce.number().int().min(1).max(5).default(1)
});

export type EmailTemplateAiPayload = z.infer<typeof payloadSchema>;

export function parseEmailTemplateAiPayload(payload: unknown) {
  return payloadSchema.parse(payload);
}

export function buildEmailTemplateAiPrompt(input: EmailTemplateAiPayload) {
  const targetAudience = input.targetAudience || "Speditionen und Logistikunternehmen";
  const lengthRule = input.length === "ausführlich" || input.length === "ausfuehrlich"
    ? "maximal 140 Woerter"
    : input.length === "mittel"
      ? "maximal 100 Woerter"
      : "maximal 70 Woerter";

  return {
    system: [
      "Du schreibst deutsche B2B-Outreach-E-Mail-Vorlagen.",
      "Generiere keine generischen Floskeln.",
      "Schreibe kurze B2B-Mails mit konkreten Schmerzpunkten.",
      "Mache keine uebertriebenen Versprechen und erfinde keine Fakten.",
      "Wenn die Zielgruppe leer ist, schreibe passend fuer Spedition/Logistik.",
      "Die E-Mail darf nie direkt senden oder Versand suggerieren, sondern nur als Vorlage dienen.",
      `Anredeform: ${input.addressForm === "du" ? "Du-Form" : "Sie-Form"}.`,
      `Laenge je Variante: ${lengthRule}.`,
      `Erzeuge genau ${input.variantCount} Varianten.`,
      "Antworte ausschliesslich als JSON mit variants: [{label, subject, bodyText}]."
    ].join(" "),
    user: JSON.stringify({
      zielgruppe: targetAudience,
      angebot: input.offer || "relevantes B2B-Angebot fuer operative Entlastung",
      tonalitaet: input.tone || "direkt, sachlich, nicht werblich",
      zielDerEmail: input.goal,
      laenge: input.length,
      anzahlVarianten: input.variantCount
    })
  };
}

export function parseGeneratedEmailTemplateVariants(payload: unknown, expectedCount: number): { variants: EmailTemplateAiVariant[] } {
  const parsed = z.object({
    variants: z.array(z.object({
      label: z.string().trim().optional(),
      subject: z.string().trim().min(1),
      bodyText: z.string().trim().min(1).optional(),
      body: z.string().trim().min(1).optional()
    })).min(1).max(5)
  }).parse(payload);

  return {
    variants: parsed.variants.slice(0, expectedCount).map((variant, index) => ({
      label: variant.label || `Variante ${index + 1}`,
      subject: variant.subject,
      bodyText: variant.bodyText || variant.body || ""
    })).filter((variant) => variant.bodyText.length > 0)
  };
}

export async function generateEmailTemplateVariants(input: EmailTemplateAiPayload) {
  const apiKey = await getEffectiveOpenAiApiKey();
  if (!apiKey) throw new Error(missingOpenAiKeyMessage);

  const prompt = buildEmailTemplateAiPrompt(input);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "developer", content: prompt.system },
        { role: "user", content: prompt.user }
      ]
    })
  });

  if (!response.ok) throw new Error("KI-Vorlagen konnten nicht erzeugt werden.");
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("KI-Antwort konnte nicht gelesen werden.");

  try {
    const parsed = parseGeneratedEmailTemplateVariants(JSON.parse(content), input.variantCount);
    if (parsed.variants.length === 0) throw new Error("KI-Antwort enthielt keine verwertbare Variante.");
    return parsed;
  } catch (error) {
    if (error instanceof Error) throw new Error("KI-Antwort konnte nicht gelesen werden.");
    throw error;
  }
}
