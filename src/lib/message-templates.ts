export const messageChannels = ["email", "linkedin", "whatsapp", "phone_note"] as const;
export const messageCategories = ["first_contact", "follow_up", "reactivation", "appointment_confirmation", "after_video", "objection_handling"] as const;
export const messageStatuses = ["active", "draft", "archived"] as const;

export const messageVariables = [
  "{{Empfaenger_Vorname}}",
  "{{Empfaenger_Nachname}}",
  "{{Empfaenger_Firma}}",
  "{{Empfaenger_Position}}",
  "{{Empfaenger_Website}}",
  "{{Absender_Vorname}}",
  "{{Absender_Nachname}}",
  "{{Absender_Firma}}",
  "{{LandingPage_URL}}",
  "{{Video_URL}}",
  "{{Terminlink}}",
  "{{Calendly_Link}}",
  "{{Booking_URL}}"
] as const;

export const channelLabels: Record<(typeof messageChannels)[number], string> = {
  email: "E-Mail",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  phone_note: "Telefonnotiz"
};

export const categoryLabels: Record<(typeof messageCategories)[number], string> = {
  first_contact: "Erstkontakt",
  follow_up: "Follow-up",
  reactivation: "Reaktivierung",
  appointment_confirmation: "Terminbestätigung",
  after_video: "Nachfassen nach Video",
  objection_handling: "Einwandbehandlung"
};

export const statusLabels: Record<(typeof messageStatuses)[number], string> = {
  active: "Aktiv",
  draft: "Entwurf",
  archived: "Archiviert"
};

export const sampleLead = {
  Empfaenger_Vorname: "Anna",
  Empfaenger_Nachname: "Keller",
  Empfaenger_Firma: "Keller Logistik GmbH",
  Empfaenger_Position: "Geschäftsführerin",
  Empfaenger_Website: "https://keller-logistik.example",
  Absender_Vorname: "Max",
  Absender_Nachname: "Schneider",
  Absender_Firma: "Tasklytic",
  LandingPage_URL: "https://app.dealsky.io/p/keller-logistik",
  Video_URL: "https://app.dealsky.io/mock-videos/keller-logistik",
  Terminlink: "https://cal.com/tasklytic/15min",
  Calendly_Link: "https://cal.com/tasklytic/15min",
  Booking_URL: "https://cal.com/tasklytic/15min"
} satisfies Record<string, string>;

export type MessageRenderResult = {
  rendered: string;
  missingVariables: string[];
  detectedVariables: string[];
};

export type MessageQuality = {
  total: number;
  clarity: number;
  relevance: number;
  personalization: number;
  length: number;
  cta: number;
  spamRisk: number;
  notes: string[];
};

export function normalizeChannel(value: unknown): (typeof messageChannels)[number] {
  return messageChannels.includes(value as (typeof messageChannels)[number]) ? value as (typeof messageChannels)[number] : "email";
}

export function normalizeCategory(value: unknown): (typeof messageCategories)[number] {
  return messageCategories.includes(value as (typeof messageCategories)[number]) ? value as (typeof messageCategories)[number] : "first_contact";
}

export function normalizeStatus(value: unknown): (typeof messageStatuses)[number] {
  return messageStatuses.includes(value as (typeof messageStatuses)[number]) ? value as (typeof messageStatuses)[number] : "draft";
}

export function extractMessageVariables(text: string) {
  return Array.from(new Set(text.match(/{{[A-Za-z0-9_]+}}/g) ?? []));
}

export function renderMessageTemplate(text: string, values: Record<string, string> = sampleLead): MessageRenderResult {
  const detectedVariables = extractMessageVariables(text);
  const missingVariables: string[] = [];
  const rendered = text.replace(/{{([A-Za-z0-9_]+)}}/g, (match, key: string) => {
    const value = values[key];
    if (!value) {
      missingVariables.push(match);
      return match;
    }
    return value;
  });
  return { rendered, missingVariables: Array.from(new Set(missingVariables)), detectedVariables };
}

export function scoreMessageTemplate({
  bodyText,
  targetAudience,
  category
}: {
  bodyText: string;
  targetAudience?: string | null;
  category?: string | null;
}): MessageQuality {
  const words = bodyText.trim().split(/\s+/).filter(Boolean);
  const variables = extractMessageVariables(bodyText);
  const ctaSignals = ["antwort", "austausch", "termin", "interesse", "kurz", "sprechen", "passt"];
  const spamSignals = ["kostenlos", "garantiert", "revolutionär", "einmalig", "risikofrei", "!!!"];
  const hasCta = ctaSignals.some((signal) => bodyText.toLowerCase().includes(signal));
  const spamHits = spamSignals.filter((signal) => bodyText.toLowerCase().includes(signal.toLowerCase())).length;

  const clarity = Math.min(100, Math.max(35, 100 - Math.max(0, words.length - 140)));
  const relevance = targetAudience || category ? 82 : 60;
  const personalization = Math.min(100, 45 + variables.length * 9);
  const length = words.length < 8 ? 35 : words.length <= 140 ? 92 : Math.max(45, 100 - (words.length - 140));
  const cta = hasCta ? 90 : 45;
  const spamRisk = Math.max(10, 90 - spamHits * 20 - (bodyText.includes("!!!") ? 20 : 0));
  const total = Math.round((clarity + relevance + personalization + length + cta + spamRisk) / 6);
  const notes = [
    variables.length === 0 ? "Mehr Personalisierung durch Variablen möglich." : "Personalisierungsvariablen erkannt.",
    hasCta ? "CTA vorhanden." : "CTA ist noch zu schwach oder fehlt.",
    spamHits > 0 ? "Einige werbliche Begriffe erhöhen das Spam-Risiko." : "Keine starken Spam-Signale erkannt."
  ];

  return { total, clarity, relevance, personalization, length, cta, spamRisk, notes };
}
