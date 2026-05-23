import { describe, expect, it } from "vitest";
import { checkLetterTemplate, extractLetterVariables } from "@/lib/letter-templates";

describe("letter template checks", () => {
  it("detects recipient variables from structured Google Docs content", () => {
    const variables = extractLetterVariables({
      googleDocsJson: {
        body: {
          content: [
            { paragraph: { elements: [{ textRun: { content: "Hallo {{Empfaenger_Vorname}}" } }] } }
          ]
        }
      },
      imageAltTexts: ["{{QRCode}}", "{{VideoThumbnail}}"],
      pageCount: 1
    });

    expect(variables.recipient).toContain("{{Empfaenger_Vorname}}");
  });

  it("detects image variables from Google Docs embedded object alt text", () => {
    const variables = extractLetterVariables({
      googleDocsJson: {
        inlineObjects: {
          image1: { inlineObjectProperties: { embeddedObject: { title: "{{QRCode}}", description: "{{VideoThumbnail}}" } } }
        }
      }
    });

    expect(variables.imageAltVariables).toEqual(["{{QRCode}}", "{{VideoThumbnail}}"]);
  });

  it("does not report missing recipients when Google Docs text contains variables", () => {
    const check = checkLetterTemplate({
      googleDocsText: "Hallo {{Empfaenger_Anrede}} {{Empfaenger_Nachname}}, besuchen Sie {{LandingPage_URL}}.",
      imageAltTexts: ["{{QRCode}}", "{{VideoThumbnail}}"],
      pageCount: 1
    });

    expect(check.status).toBe("checked");
    expect(check.detectedRecipientVariables).toEqual(["{{Empfaenger_Anrede}}", "{{Empfaenger_Nachname}}"]);
    expect(check.issues.some((issue) => issue.message.includes("Keine Empfänger-Variablen"))).toBe(false);
  });

  it("requires QR code and video thumbnail as image alt text", () => {
    const check = checkLetterTemplate({
      googleDocsText: "Hallo {{Empfaenger_Vorname}} {{QRCode}}",
      imageAltTexts: ["{{VideoThumbnail}}"],
      pageCount: 1
    });

    expect(check.status).toBe("failed");
    expect(check.issues.map((issue) => issue.message)).toContain("{{QRCode}} muss als Alt-Text eines Platzhalterbildes gesetzt sein.");
  });
});
