import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { getEffectiveOpenAiApiKey } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { getTargetGroupOrDefault, targetGroupContextText } from "@/lib/target-groups";
import { requireOfferForProspect, userOfferContextText } from "@/lib/user-offer";
import { normalizeAddressForm } from "@/lib/landingpage-templates";

const payloadSchema = z.object({
  prospectId: z.string().min(1),
  addressForm: z.enum(["du", "sie"]).optional().default("du")
});

export async function POST(request: Request) {
  try {
    const apiKey = await getEffectiveOpenAiApiKey();
    if (!apiKey) throw new Error("OPENAI_API_KEY fehlt.");
    const { prospectId, addressForm: rawAddressForm } = payloadSchema.parse(await request.json());
    const addressForm = normalizeAddressForm(rawAddressForm);
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) throw new Error("Prospect nicht gefunden.");
    const offer = await requireOfferForProspect(prospect);
    const targetGroup = await getTargetGroupOrDefault(prospect.targetGroupId);

    const prompt = {
      system:
        `Du schreibst deutsche Landingpage-Hero-Texte. Du schreibst fuer die Zielgruppe ${targetGroup.name}. Schreibe persoenlich, direkt, nicht generisch, ohne Gedankenstriche, ohne Floskeln, ohne Marketing-Sprech und ohne erfundene Fakten. Nutze den Offer-Kontext verbindlich. Prospect-Probleme sind nur Hypothesen, sofern sie nicht als klare Fakten belegt sind. Anredeform: ${addressForm === "sie" ? "Sie-Form mit Ihnen/Ihre und Hallo {{salutation}} {{lastName}}" : "Du-Form mit du/dein/euch und Hey {{firstName}}"}. Formuliere vorsichtig mit "${addressForm === "sie" ? "Falls bei Ihnen aktuell" : "Falls bei euch aktuell"}", "${addressForm === "sie" ? "Wenn bei Ihnen viel ueber Telefon, Mail und Dispo laeuft" : "Wenn bei euch viel ueber Telefon, Mail und Dispo laeuft"}" oder "Ein moeglicher Ansatzpunkt ist". Behaupte nicht, dass die Firma Probleme hat oder unter etwas leidet. Gib ausschliesslich JSON mit heroHeadline, heroSubheadline, heroBodyText und heroCtaText aus.`,
      user: `Ziel: Landingpage Hero und CTA Text personalisieren
Tonalitaet: beratend
Anredeform: ${addressForm}
${userOfferContextText(offer)}
${targetGroupContextText(targetGroup)}
Prospect-Daten:
companyName: ${prospect.companyName}
city: ${prospect.city}
decisionMakerName: ${prospect.decisionMakerName ?? ""}
decisionMakerRole: ${prospect.decisionMakerRole ?? ""}
vehicleCount: ${prospect.vehicleCount ?? ""}
locationsCount: ${prospect.locationsCount ?? ""}
businessFields: ${JSON.stringify(prospect.businessFields ?? [])}
landingpageUrl: ${prospect.slug ? `/p/${prospect.slug}` : ""}
calendarUrl: ${prospect.calendarUrl ?? ""}
painPoint: ${prospect.customPainPoint ?? ""}`
    };

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
          { role: "developer", content: `${prompt.system} Liefere JSON mit heroHeadline, heroSubheadline, heroBodyText, heroCtaText.` },
          { role: "user", content: prompt.user }
        ]
      })
    });
    if (!response.ok) throw new Error("KI-Texte konnten nicht erzeugt werden.");
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return NextResponse.json(content ? JSON.parse(content) : {});
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Landingpage-Texte konnten nicht erzeugt werden.") }, { status: 400 });
  }
}
