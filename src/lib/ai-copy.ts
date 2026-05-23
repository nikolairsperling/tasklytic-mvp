import { z } from "zod";
import { buildLandingpageUrl } from "@/lib/campaigns";
import { getEffectiveOpenAiApiKey } from "@/lib/integrations";
import { normalizeAddressForm, type AddressForm } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";
import { getTargetGroupOrDefault, targetGroupContextText, type TargetGroupLike } from "@/lib/target-groups";
import { userOfferContextText } from "@/lib/user-offer";

const aiPayloadSchema = z.object({
  prospectId: z.string().min(1),
  campaignId: z.string().optional(),
  offerId: z.string().trim().min(1, "Bitte Angebot auswählen").optional(),
  tone: z.enum(["direkt", "freundlich", "sehr kurz", "beratend"]).optional().default("direkt"),
  numberOfSteps: z.coerce.number().int().min(1).max(5).optional().default(3),
  variantCount: z.coerce.number().int().min(2).max(2).optional().default(2),
  goal: z.string().optional().default("einen kurzen Austausch anstoßen"),
  addressForm: z.enum(["du", "sie"]).optional().default("du")
});

export type AiCampaignCopyPayload = z.input<typeof aiPayloadSchema>;
type ParsedAiCampaignCopyPayload = z.output<typeof aiPayloadSchema>;

export type GeneratedCampaignStep = {
  subject: string;
  body: string;
  delayDays: number;
};

export type GeneratedCampaignVariant = {
  label: "A" | "B";
  subject: string;
  body: string;
};

export function normalizeVariantLabel(value: unknown): "A" | "B" | unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "a" || normalized === "variante a" || normalized === "variant a") return "A";
  if (normalized === "b" || normalized === "variante b" || normalized === "variant b") return "B";
  return value;
}

export function parseAiCampaignCopyPayload(payload: unknown): ParsedAiCampaignCopyPayload {
  return aiPayloadSchema.parse(payload);
}

export async function generateCampaignCopy(payload: AiCampaignCopyPayload) {
  const input = parseAiCampaignCopyPayload(payload);
  const apiKey = await getEffectiveOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY fehlt.");
  }

  const prospect = await prisma.prospect.findUnique({ where: { id: input.prospectId } });
  if (!prospect) {
    throw new Error("Prospect nicht gefunden.");
  }

  const campaign = input.campaignId ? await prisma.campaign.findUnique({ where: { id: input.campaignId }, select: { targetGroupId: true, offerId: true } }) : null;
  const offerId = input.offerId ?? campaign?.offerId;
  if (!offerId) {
    throw new Error("Bitte Angebot auswählen");
  }
  const offer = await prisma.offer.findFirst({ where: { id: offerId, workspaceId: "default" } });
  if (!offer) {
    throw new Error("Bitte Angebot auswählen");
  }
  const targetGroup = await getTargetGroupOrDefault(prospect.targetGroupId ?? campaign?.targetGroupId);
  const prompt = buildCampaignCopyPrompt({
    prospect: {
      companyName: prospect.companyName,
      decisionMakerName: prospect.decisionMakerName,
      city: prospect.city,
      painSignals: normalizePainSignals(prospect.painSignals),
      landingpageUrl: prospect.slug ? buildLandingpageUrl(prospect.slug) : undefined,
      videoUrl: prospect.videoUrl ?? prospect.personalVideoUrl ?? prospect.explainerVideoUrl ?? undefined,
      icpCategory: prospect.icpCategory,
      fitScore: prospect.fitScore
    },
    tone: input.tone,
    variantCount: input.variantCount,
    goal: input.goal,
    addressForm: normalizeAddressForm(input.addressForm),
    targetGroup,
    offerContext: userOfferContextText(offer)
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "developer", content: prompt.system },
        { role: "user", content: prompt.user }
      ]
    })
  });

  if (!response.ok) {
    throw new Error("KI-Texterstellung fehlgeschlagen.");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("KI-Antwort war leer.");
  }

  const parsed = parseGeneratedCampaignVariants(JSON.parse(content));
  const variants = parsed.variants.map((variant) =>
      ensureCampaignCopyQuality(
        normalizeVariant(variant),
        {
          companyName: prospect.companyName,
          decisionMakerName: prospect.decisionMakerName,
          city: prospect.city,
          painSignals: normalizePainSignals(prospect.painSignals),
          landingpageUrl: prospect.slug ? buildLandingpageUrl(prospect.slug) : undefined,
        videoUrl: prospect.videoUrl ?? prospect.personalVideoUrl ?? prospect.explainerVideoUrl ?? undefined
        },
        normalizeAddressForm(input.addressForm)
    )
  );
  return {
    variants,
    steps: variants.map((variant, index) => ({
      subject: variant.subject,
      body: variant.body,
      delayDays: index === 0 ? 0 : 3
    }))
  };
}

const generatedVariantsSchema = z.object({
  variants: z.array(
    z.object({
      label: z.preprocess(normalizeVariantLabel, z.enum(["A", "B"])),
      subject: z.string().min(1),
      body: z.string().min(1)
    })
  ).length(2)
});

export function parseGeneratedCampaignVariants(payload: unknown) {
  const result = generatedVariantsSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("KI-Antwort konnte nicht gelesen werden. Bitte Texte erneut erzeugen.");
  }
  return result.data;
}

export function buildCampaignCopyPrompt({
  prospect,
  tone,
  variantCount,
  goal,
  addressForm,
  targetGroup,
  offerContext = ""
}: {
  prospect: Record<string, unknown>;
  tone: string;
  variantCount: number;
  goal: string;
  addressForm?: AddressForm;
  targetGroup?: TargetGroupLike;
  offerContext?: string;
}) {
  const normalizedAddressForm = normalizeAddressForm(addressForm);
  const facts = Object.entries(prospect)
    .filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== null && value !== undefined && value !== "" && value !== false;
    })
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? JSON.stringify(value) : String(value)}`)
    .join("\n");

  return {
    system:
      `Du schreibst deutsche B2B-Outreach-E-Mails. ${targetGroup ? `Du schreibst fuer die Zielgruppe ${targetGroup.name}.` : ""} Schreibe persoenlich, direkt, nicht generisch, ohne Gedankenstriche, ohne Floskeln, ohne Marketing-Sprech, ohne erfundene Fakten und ohne Uebertreibung. Nutze nur die bereitgestellten Prospect-Daten und den Offer-Kontext. Erzeuge genau 2 Varianten fuer die erste Mail. Jede Variante muss maximal 120 Woerter haben, kurze Saetze nutzen und natuerliche Sprache verwenden. Anredeform: ${normalizedAddressForm === "sie" ? "Sie-Form mit Ihnen/Ihre und Hallo {{salutation}} {{lastName}}" : "Du-Form mit du/dein/euch und Hey {{firstName}}"}. Verwende wenn vorhanden den Namen, sonst die Anrede Hallo,. Greife painSignals nur als vorsichtige Hypothese auf. Nutze Formulierungen wie "${normalizedAddressForm === "sie" ? "Falls bei Ihnen aktuell" : "Falls bei euch aktuell"}", "${normalizedAddressForm === "sie" ? "Wenn bei Ihnen viel ueber Telefon, Mail und Dispo laeuft" : "Wenn bei euch viel ueber Telefon, Mail und Dispo laeuft"}" oder "Ein moeglicher Ansatzpunkt ist". Behaupte nicht, dass die Firma ein Problem hat. Erwähne landingpageUrl oder videoUrl. Antworte ausschliesslich als JSON mit variants: [{label, subject, body}].`,
    user: `Ziel: ${goal}
Tonalitaet: ${tone}
Varianten: ${variantCount}
Anredeform: ${normalizedAddressForm}
${offerContext ? `${offerContext}\n` : ""}
${targetGroup ? `${targetGroupContextText(targetGroup)}\n` : ""}
Prospect-Daten:
${facts}

Pflichtstruktur fuer jede Variante:
1. persoenlicher Einstieg
2. konkreter Bezug zum Unternehmen
3. vorsichtige Hypothese aus painSignals
4. kurze Einordnung warum relevant
5. Hinweis auf Landingpage oder Video
6. einfacher CTA

Regeln:
- keine Gedankenstriche
- keine Floskeln
- kein Marketing-Sprech
- maximal 120 Woerter pro Variante
- kurze Saetze
- natuerliche Sprache
- keine leeren Anreden wie Hey ,
- keine harten Behauptungen wie "Das Unternehmen hat Probleme", "leidet unter" oder "Chaos"

Erstelle Variante A direkt und Variante B softer.`
  };
}

function normalizeVariant(variant: { label: "A" | "B"; subject: string; body: string }) {
  return {
    label: variant.label,
    subject: normalizeText(variant.subject),
    body: normalizeText(variant.body)
  };
}

function normalizeText(value: string) {
  return removeDashes(value)
    .replace(/\bHey\s*,/gi, "Hallo,")
    .replace(/\bHey\s+,\s*/gi, "Hallo, ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function ensureCampaignCopyQuality(
  variant: GeneratedCampaignVariant,
  prospect: {
    companyName: string;
    decisionMakerName: string | null;
    city: string;
    painSignals: Array<{ type?: string; label?: string; strength?: number }>;
    landingpageUrl?: string;
    videoUrl?: string;
  },
  addressForm: AddressForm = "du"
): GeneratedCampaignVariant {
  const painSignalText = prospect.painSignals.find((signal) => signal.label)?.label
    ?? prospect.painSignals[0]?.type
    ?? "ein konkretes Problem";
  const hasName = Boolean(prospect.decisionMakerName?.trim());
  const normalizedAddressForm = normalizeAddressForm(addressForm);
  const greeting = hasName ? `Hallo ${prospect.decisionMakerName!.trim()}` : "Hallo";
  const bodyWithoutGreeting = normalizeText(variant.body)
    .replace(/^hey\s*,?\s*/i, "")
    .replace(/^hallo\s*,?\s*/i, "")
    .trim();
  const requiredSentences = [
    `${greeting},`,
    bodyWithoutGreeting,
    variant.body.toLowerCase().includes(prospect.companyName.toLowerCase()) ? "" : `Es geht um ${prospect.companyName}.`,
    includesPainReference(bodyWithoutGreeting, prospect.painSignals) ? "" : `Ein möglicher Ansatzpunkt ist ${painSignalText}.`,
    prospect.landingpageUrl && !bodyWithoutGreeting.includes(prospect.landingpageUrl) ? `Die Seite dazu ist hier: ${prospect.landingpageUrl}.` : "",
    prospect.videoUrl && !bodyWithoutGreeting.includes(prospect.videoUrl) ? `Oder das Video: ${prospect.videoUrl}.` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const cleanedBody = enforceWordLimit(
    normalizeText(requiredSentences)
      .replace(/ich hoffe,? es geht ihnen gut\.?/gi, "")
      .replace(/ich hoffe,? es geht dir gut\.?/gi, "")
      .replace(/\bFalls bei euch aktuell\b/gi, normalizedAddressForm === "sie" ? "Falls bei Ihnen aktuell" : "Falls bei euch aktuell")
      .replace(/\bWenn bei euch viel\b/gi, normalizedAddressForm === "sie" ? "Wenn bei Ihnen viel" : "Wenn bei euch viel")
      .replace(/das unternehmen hat probleme/gi, "ein möglicher Ansatzpunkt ist")
      .replace(/die firma leidet unter/gi, "falls bei euch aktuell")
      .replace(/es gibt chaos/gi, "wenn bei euch viel Abstimmung anfällt")
      .replace(/\b(mail|newsletter|marketing)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );

  return {
    ...variant,
    body: cleanedBody
  };
}

function includesPainReference(body: string, painSignals: Array<{ label?: string; type?: string }>) {
  const lower = body.toLowerCase();
  return painSignals.some((signal) => {
    const label = (signal.label ?? signal.type ?? "").toLowerCase();
    return label && lower.includes(label);
  });
}

export function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizePainSignals(value: unknown): Array<{ type?: string; label?: string; strength?: number }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { type?: string; label?: string; strength?: number } => Boolean(item && typeof item === "object"));
}

function enforceWordLimit(value: string, limit = 120) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return value.trim();
  return words.slice(0, limit).join(" ").trim();
}

function removeDashes(value: string): string {
  return value.replace(/[—–]/g, ",");
}
