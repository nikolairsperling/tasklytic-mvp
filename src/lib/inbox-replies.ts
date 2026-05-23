import { z } from "zod";
import type { InboxMessageCategory } from "@/lib/inbox-classification";

const inboxReplyPayloadSchema = z.object({
  messageText: z.string().min(1),
  category: z.enum(["positive", "neutral", "negative", "question", "auto_reply"]),
  prospectData: z
    .object({
      companyName: z.string().optional(),
      decisionMakerName: z.string().optional(),
      landingpageUrl: z.string().optional(),
      videoUrl: z.string().optional(),
      city: z.string().optional()
    })
    .passthrough()
});

export type InboxReplyPayload = z.infer<typeof inboxReplyPayloadSchema>;

export function parseInboxReplyPayload(payload: unknown): InboxReplyPayload {
  return inboxReplyPayloadSchema.parse(payload);
}

export function generateInboxReply({
  category,
  prospectData
}: {
  category: InboxMessageCategory;
  prospectData: {
    companyName?: string;
    decisionMakerName?: string;
    landingpageUrl?: string;
    videoUrl?: string;
    city?: string;
  };
}): { replyText: string } {
  const name = normalizeName(prospectData.decisionMakerName);
  const greeting = name ? `Hallo ${name}` : "Hallo";
  const company = normalizeText(prospectData.companyName);
  const landingpageUrl = normalizeText(prospectData.landingpageUrl);
  const videoUrl = normalizeText(prospectData.videoUrl);
  const city = normalizeText(prospectData.city);

  const replyText = (() => {
    switch (category) {
      case "positive":
        return [
          `${greeting},`,
          "danke fuer die Rueckmeldung.",
          "Lassen Sie uns gern einen kurzen Termin finden.",
          city ? `Wenn es fuer ${company || "Sie"} passt, gerne auch mit Blick auf ${city}.` : "",
          landingpageUrl ? `Die Seite dazu ist hier: ${landingpageUrl}.` : ""
        ]
          .filter(Boolean)
          .join(" ");
      case "question":
        return [
          `${greeting},`,
          "gerne kurz zur Einordnung.",
          "Die Seite zeigt die wichtigsten Punkte kompakt und soll den ersten Ueberblick geben.",
          landingpageUrl ? `Hier ist der Link: ${landingpageUrl}.` : "",
          videoUrl ? `Optional gibt es auch ein Video: ${videoUrl}.` : ""
        ]
          .filter(Boolean)
          .join(" ");
      case "negative":
        return [
          `${greeting},`,
          "danke fuer die ehrliche Rueckmeldung.",
          "Ich melde mich nicht weiter dazu.",
          "Alles Gute."
        ].join(" ");
      case "auto_reply":
        return [
          `${greeting},`,
          "vielen Dank.",
          "Ich melde mich nach Ihrer Rueckkehr noch einmal."
        ].join(" ");
      case "neutral":
      default:
        return [
          `${greeting},`,
          "ich wollte kurz nachhaken.",
          "Falls das Thema gerade passt, schicke ich Ihnen gern die kurze Seite dazu.",
          landingpageUrl ? `Hier ist der Link: ${landingpageUrl}.` : "",
          "Melden Sie sich einfach kurz."
        ]
          .filter(Boolean)
          .join(" ");
    }
  })();

  return {
    replyText: enforceWordLimit(cleanReplyText(replyText), 80)
  };
}

function cleanReplyText(value: string): string {
  return normalizeWhitespace(removeDashes(value))
    .replace(/\bHey\s*,/gi, "Hallo,")
    .replace(/\bHey\s+,\s*/gi, "Hallo, ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeText(value?: string) {
  return value ? value.trim() : "";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeName(value?: string) {
  return value ? value.trim().replace(/\s+/g, " ") : "";
}

function removeDashes(value: string) {
  return value.replace(/[–—]/g, "-");
}

function enforceWordLimit(text: string, maxWords: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text;
  }

  return `${words.slice(0, maxWords).join(" ")}.`;
}
