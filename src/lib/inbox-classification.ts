export type InboxMessageCategory = "positive" | "neutral" | "negative" | "question" | "auto_reply";

export type InboxClassification = {
  category: InboxMessageCategory;
  confidence: number;
  aiSummary: string;
};

const AUTO_REPLY_PATTERNS = [
  /automatische antwort/i,
  /auto[- ]?reply/i,
  /out of office/i,
  /abwesenheitsnotiz/i,
  /vielen dank für ihre nachricht/i,
  /vielen dank fuer ihre nachricht/i,
  /\burlaub\b/i,
  /\babwesend\b/i,
  /vacation/i,
  /we are out of office/i
];

const NEGATIVE_PATTERNS = [
  /kein interesse/i,
  /not interested/i,
  /nicht interessiert/i,
  /bitte nicht mehr/i,
  /unsubscribe/i,
  /abmelden/i,
  /stop/i,
  /remove me/i,
  /do not contact/i,
  /currently not relevant/i
];

const POSITIVE_PATTERNS = [
  /gerne/i,
  /klingt gut/i,
  /passt/i,
  /interessiert/i,
  /lass uns/i,
  /vereinbaren/i,
  /sprechen/i,
  /termin/i,
  /call/i,
  /meeting/i,
  /sounds good/i,
  /let's go/i
];

const QUESTION_PATTERNS = [
  /\?/,
  /können sie/i,
  /koennen sie/i,
  /wie funktioniert/i,
  /was kostet/i,
  /what about/i,
  /could you/i,
  /would you/i,
  /more details/i
];

export function classifyEmail(messageText: string): InboxClassification {
  const text = normalize(messageText);

  if (matchesAny(text, AUTO_REPLY_PATTERNS)) {
    return {
      category: "auto_reply",
      confidence: 98,
      aiSummary: "Automatische Antwort oder Abwesenheitsnotiz erkannt."
    };
  }

  if (matchesAny(text, NEGATIVE_PATTERNS)) {
    return {
      category: "negative",
      confidence: scoreConfidence(text, NEGATIVE_PATTERNS, 85),
      aiSummary: "Ablehnung oder Bitte um keinen weiteren Kontakt erkannt."
    };
  }

  if (matchesAny(text, QUESTION_PATTERNS)) {
    return {
      category: "question",
      confidence: scoreConfidence(text, QUESTION_PATTERNS, 78),
      aiSummary: "Rückfrage oder Informationsbedarf erkannt."
    };
  }

  if (matchesAny(text, POSITIVE_PATTERNS)) {
    return {
      category: "positive",
      confidence: scoreConfidence(text, POSITIVE_PATTERNS, 82),
      aiSummary: "Positive oder interessierte Antwort erkannt."
    };
  }

  return {
    category: "neutral",
    confidence: 50,
    aiSummary: "Neutraler oder nicht eindeutiger Antworttyp."
  };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function scoreConfidence(text: string, patterns: RegExp[], base: number): number {
  const hits = patterns.filter((pattern) => pattern.test(text)).length;
  return Math.max(0, Math.min(100, base + Math.min(10, hits * 4)));
}
