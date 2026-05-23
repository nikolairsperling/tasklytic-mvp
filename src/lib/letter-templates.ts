import { prisma } from "@/lib/prisma";

export const recipientVariables = [
  "{{Empfaenger_Anrede}}",
  "{{Empfaenger_Vorname}}",
  "{{Empfaenger_Nachname}}",
  "{{Empfaenger_Firma}}",
  "{{Empfaenger_Strasse}}",
  "{{Empfaenger_PLZ}}",
  "{{Empfaenger_Stadt}}",
  "{{Empfaenger_Email}}",
  "{{Empfaenger_Telefon}}"
] as const;

export const senderVariables = [
  "{{Absender_Vorname}}",
  "{{Absender_Nachname}}",
  "{{Absender_Firma}}",
  "{{Absender_Email}}",
  "{{Absender_Website}}"
] as const;

export const personalizationVariables = ["{{QRCode}}", "{{QR_Code}}", "{{VideoThumbnail}}", "{{PersonalVideo_URL}}", "{{LandingPage_URL}}"] as const;

export const allLetterVariables = [...recipientVariables, ...senderVariables, ...personalizationVariables] as const;

type LetterTemplateInput = {
  googleDocsText?: string | null;
  previewText?: string | null;
  googleDocsJson?: unknown;
  imageAltTexts?: string[] | null;
  pageCount?: number | null;
};

export type LetterTemplateCheckIssue = {
  field: "recipientVariables" | "variables" | "imageAltText" | "pageCount" | "leadList";
  severity: "error" | "warning";
  message: string;
};

export type LetterTemplateCheckResult = {
  status: "checked" | "failed";
  summary: string;
  issues: LetterTemplateCheckIssue[];
  detectedRecipientVariables: string[];
  detectedSenderVariables: string[];
  detectedPersonalizationVariables: string[];
};

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function stringifyGoogleDocsContent(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyGoogleDocsContent).join("\n");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(stringifyGoogleDocsContent).join("\n");
  }
  return "";
}

function extractGoogleDocsImageAltTexts(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(extractGoogleDocsImageAltTexts);

  const record = value as Record<string, unknown>;
  const embeddedObject = record.embeddedObject;
  const currentAltTexts: string[] = [];
  if (embeddedObject && typeof embeddedObject === "object") {
    const embedded = embeddedObject as Record<string, unknown>;
    for (const key of ["title", "description"]) {
      if (typeof embedded[key] === "string" && embedded[key]) currentAltTexts.push(embedded[key]);
    }
  }

  return [...currentAltTexts, ...Object.values(record).flatMap(extractGoogleDocsImageAltTexts)];
}

export function extractLetterVariables(input: LetterTemplateInput) {
  const searchableText = [input.googleDocsText, input.previewText, stringifyGoogleDocsContent(input.googleDocsJson)].filter(Boolean).join("\n");
  const textVariables = unique(searchableText.match(/{{[A-Za-z0-9_]+}}/g) ?? []);
  const imageAltTexts = [...(input.imageAltTexts ?? []), ...extractGoogleDocsImageAltTexts(input.googleDocsJson)];
  const imageAltVariables = unique(imageAltTexts.flatMap((text) => text.match(/{{[A-Za-z0-9_]+}}/g) ?? []));
  const allDetectedVariables = unique([...textVariables, ...imageAltVariables]);

  return {
    textVariables,
    imageAltVariables,
    allDetectedVariables,
    recipient: allDetectedVariables.filter((variable) => recipientVariables.includes(variable as (typeof recipientVariables)[number])),
    sender: allDetectedVariables.filter((variable) => senderVariables.includes(variable as (typeof senderVariables)[number])),
    personalization: allDetectedVariables.filter((variable) => personalizationVariables.includes(variable as (typeof personalizationVariables)[number])),
    unknown: allDetectedVariables.filter((variable) => !allLetterVariables.includes(variable as (typeof allLetterVariables)[number]))
  };
}

export function checkLetterTemplate(input: LetterTemplateInput, leadFields: string[] = []): LetterTemplateCheckResult {
  const variables = extractLetterVariables(input);
  const issues: LetterTemplateCheckIssue[] = [];

  if (variables.recipient.length === 0) {
    issues.push({
      field: "recipientVariables",
      severity: "error",
      message: "Keine Empfänger-Variablen erkannt. Die Prüfung liest Google-Docs-Text, strukturierte Docs-Inhalte und Bild-Alt-Texte aus."
    });
  }

  if (variables.unknown.length > 0) {
    issues.push({
      field: "variables",
      severity: "error",
      message: `Unbekannte Variable(n): ${variables.unknown.join(", ")}.`
    });
  }

  for (const { display, aliases } of [
    { display: "{{QRCode}}", aliases: ["{{QRCode}}", "{{QR_Code}}"] },
    { display: "{{VideoThumbnail}}", aliases: ["{{VideoThumbnail}}"] }
  ]) {
    if (!aliases.some((variable) => variables.imageAltVariables.includes(variable))) {
      issues.push({
        field: "imageAltText",
        severity: "error",
        message: `${display} muss als Alt-Text eines Platzhalterbildes gesetzt sein.`
      });
    }
    if (aliases.some((variable) => variables.textVariables.includes(variable))) {
      issues.push({
        field: "imageAltText",
        severity: "warning",
        message: `${display} wurde im sichtbaren Text gefunden. Für Bilder zählt nur der Alt-Text des Platzhalterbildes.`
      });
    }
  }

  if (input.pageCount == null) {
    issues.push({
      field: "pageCount",
      severity: "warning",
      message: "Die Seitenzahl ist noch nicht aus Google Docs bestätigt."
    });
  } else if (input.pageCount > 1) {
    issues.push({
      field: "pageCount",
      severity: "error",
      message: `Die Vorlage hat ${input.pageCount} Seiten. Erlaubt ist maximal 1 Seite.`
    });
  }

  if (leadFields.length > 0) {
    const missingLeadFields = variables.recipient
      .map((variable) => variable.replace("{{Empfaenger_", "").replace("}}", ""))
      .filter((field) => !leadFields.includes(field));
    if (missingLeadFields.length > 0) {
      issues.push({
        field: "leadList",
        severity: "error",
        message: `Die Lead-Liste enthält diese Empfänger-Felder nicht: ${missingLeadFields.join(", ")}.`
      });
    }
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");
  return {
    status: hasErrors ? "failed" : "checked",
    summary: hasErrors ? "Vorlage benötigt Korrekturen vor dem Versand." : "Vorlage ist für personalisierte Print-Kampagnen geprüft.",
    issues,
    detectedRecipientVariables: variables.recipient,
    detectedSenderVariables: variables.sender,
    detectedPersonalizationVariables: variables.personalization
  };
}

export function extractGoogleDocId(value: string) {
  const match = value.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? "";
}

export async function ensureSystemLetterTemplate() {
  const previewText = [
    "Hallo {{Empfaenger_Vorname}} {{Empfaenger_Nachname}},",
    "",
    "wir haben für {{Empfaenger_Firma}} eine kurze persönliche Seite vorbereitet:",
    "{{LandingPage_URL}}",
    "",
    "Viele Grüße",
    "{{Absender_Vorname}} {{Absender_Nachname}}",
    "{{Absender_Firma}}",
    "",
    "{{QR_Code}}",
    "{{VideoThumbnail}}"
  ].join("\n");

  const check = checkLetterTemplate({
    previewText,
    googleDocsText: previewText,
    imageAltTexts: ["{{QRCode}}", "{{VideoThumbnail}}"],
    pageCount: 1
  });

  await prisma.letterTemplate.upsert({
    where: { systemKey: "default-print-campaign-letter" },
    update: {
      title: "Persönlicher Impuls für {{Empfaenger_Firma}}",
      body: previewText,
      footer: "{{Absender_Firma}} · {{Absender_Email}} · {{Absender_Website}}",
      previewText,
      googleDocsText: previewText,
      imageAltTexts: ["{{QR_Code}}", "{{VideoThumbnail}}"],
      pageCount: 1,
      qrCodePosition: "unten",
      landingPageUrlVariable: "{{LandingPage_URL}}",
      isDefault: true,
      isChecked: true,
      lastCheckStatus: check.status,
      lastCheckSummary: check.summary,
      lastCheckIssues: check.issues,
      detectedRecipientVariables: check.detectedRecipientVariables,
      detectedSenderVariables: check.detectedSenderVariables,
      detectedPersonalizationVariables: check.detectedPersonalizationVariables
    },
    create: {
      name: "Mustervorlage (Nur Ansicht)",
      title: "Persönlicher Impuls für {{Empfaenger_Firma}}",
      body: previewText,
      footer: "{{Absender_Firma}} · {{Absender_Email}} · {{Absender_Website}}",
      description: "Systemvorlage für personalisierte Print-Kampagnen mit Empfänger-, Absender- und Bildvariablen.",
      previewText,
      googleDocsText: previewText,
      imageAltTexts: ["{{QR_Code}}", "{{VideoThumbnail}}"],
      pageCount: 1,
      qrCodePosition: "unten",
      landingPageUrlVariable: "{{LandingPage_URL}}",
      isDefault: true,
      isSystemTemplate: true,
      isChecked: true,
      lastCheckStatus: check.status,
      lastCheckSummary: check.summary,
      lastCheckIssues: check.issues,
      detectedRecipientVariables: check.detectedRecipientVariables,
      detectedSenderVariables: check.detectedSenderVariables,
      detectedPersonalizationVariables: check.detectedPersonalizationVariables,
      systemKey: "default-print-campaign-letter"
    }
  });
}
