import { getEffectiveOpenAiApiKey } from "@/lib/integrations";
import { channelLabels, messageVariables, normalizeChannel } from "@/lib/message-templates";

export type MessageAiAction =
  | "rewrite"
  | "shorten"
  | "more_personal"
  | "more_b2b"
  | "linkedin"
  | "whatsapp"
  | "email_subject"
  | "follow_up"
  | "objection"
  | "abc_variants"
  | "new_template";

function fallbackAiText(action: MessageAiAction, input: Record<string, string>) {
  const channel = normalizeChannel(input.channel);
  const targetAudience = input.targetAudience || "B2B-Entscheider";
  const offer = input.offer || "ein relevantes Angebot";
  const goal = input.goal || "einen kurzen Austausch anstoßen";
  const cta = input.cta || "Interesse an einem kurzen Austausch?";
  const base = input.bodyText || `Hallo {{Empfaenger_Vorname}},\n\nich habe mir {{Empfaenger_Firma}} kurz angesehen. Für ${targetAudience} ist ${offer} oft dann spannend, wenn man ohne großes Projekt manuelle Arbeit reduzieren möchte.\n\nIch habe eine kurze Seite vorbereitet: {{LandingPage_URL}}\n\n${cta}\n\nViele Grüße\n{{Absender_Vorname}}`;

  if (action === "email_subject") return { subject: `Kurzer Gedanke zu {{Empfaenger_Firma}}`, bodyText: base };
  if (action === "shorten") return { bodyText: base.split(/\n+/).filter(Boolean).slice(0, 4).join("\n\n") };
  if (action === "linkedin") return { bodyText: `Hallo {{Empfaenger_Vorname}}, kurzer Gedanke zu {{Empfaenger_Firma}}: ${offer} könnte relevant sein, wenn aktuell viel manuell läuft. ${cta}` };
  if (action === "whatsapp") return { bodyText: `Hallo {{Empfaenger_Vorname}}, ich habe eine kurze Idee für {{Empfaenger_Firma}} vorbereitet: {{LandingPage_URL}}. ${cta}` };
  if (action === "follow_up") return { bodyText: `Hallo {{Empfaenger_Vorname}},\n\nich wollte meine Nachricht kurz nachfassen. Der Ansatz für {{Empfaenger_Firma}} ist hier zusammengefasst: {{LandingPage_URL}}\n\nWäre ein kurzer Austausch dazu sinnvoll?\n\nViele Grüße\n{{Absender_Vorname}}` };
  if (action === "objection") return { bodyText: `Verstehe ich gut. Mir geht es nicht darum, direkt ein Projekt anzustoßen. Sinnvoll wäre erst ein kurzer Blick darauf, ob bei {{Empfaenger_Firma}} überhaupt Potenzial besteht. Wenn nicht, ist das auch ein klares Ergebnis.` };
  if (action === "abc_variants") {
    return {
      variants: [
        { label: "A", bodyText: base },
        { label: "B", bodyText: `Hallo {{Empfaenger_Vorname}},\n\nfalls bei {{Empfaenger_Firma}} aktuell manuelle Abstimmung Zeit kostet: Ich habe einen kurzen Ansatz vorbereitet.\n\n{{LandingPage_URL}}\n\n${cta}` },
        { label: "C", bodyText: `Hallo {{Empfaenger_Vorname}}, ich melde mich mit einem konkreten Gedanken für {{Empfaenger_Firma}}. ${offer}. Passt ein kurzer Austausch?` }
      ]
    };
  }
  if (action === "new_template") {
    return {
      name: `${channelLabels[channel]} Vorlage ${goal}`,
      subject: channel === "email" ? `Idee für {{Empfaenger_Firma}}` : "",
      bodyText: base
    };
  }
  return { bodyText: `${base}\n\nIch würde es bewusst kurz halten: ${cta}` };
}

export async function generateMessageTemplateAi(action: MessageAiAction, input: Record<string, string>) {
  const apiKey = await getEffectiveOpenAiApiKey();
  if (!apiKey) return fallbackAiText(action, input);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "developer",
          content: "Du bist ein deutscher B2B-Outreach-Copywriter. Schreibe direkt, menschlich, professionell, ohne Marketing-Floskeln. Nutze nur die erlaubten Variablen. Antworte ausschliesslich als JSON."
        },
        {
          role: "user",
          content: JSON.stringify({ action, allowedVariables: messageVariables, input })
        }
      ]
    })
  });

  if (!response.ok) return fallbackAiText(action, input);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return fallbackAiText(action, input);
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return fallbackAiText(action, input);
  }
}
