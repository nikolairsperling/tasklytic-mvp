import { describe, expect, it } from "vitest";
import { generateInboxReply } from "@/lib/inbox-replies";

describe("generateInboxReply", () => {
  it("suggests a meeting for positive replies", () => {
    const result = generateInboxReply({
      category: "positive",
      prospectData: { companyName: "Bauer Logistik", decisionMakerName: "Thomas Bauer", city: "Hamburg", landingpageUrl: "https://example.com/p/bauer" }
    });

    expect(result.replyText).toContain("Termin");
    expect(result.replyText.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(80);
  });

  it("explains and links the landingpage for questions", () => {
    const result = generateInboxReply({
      category: "question",
      prospectData: { companyName: "Bauer Logistik", landingpageUrl: "https://example.com/p/bauer" }
    });

    expect(result.replyText).toContain("Link");
    expect(result.replyText).toContain("https://example.com/p/bauer");
  });

  it("ends politely for negative replies", () => {
    const result = generateInboxReply({
      category: "negative",
      prospectData: { decisionMakerName: "Thomas Bauer" }
    });

    expect(result.replyText.toLowerCase()).toContain("melde mich nicht weiter");
    expect(result.replyText.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(80);
  });

  it("asks a brief follow-up for neutral replies", () => {
    const result = generateInboxReply({
      category: "neutral",
      prospectData: { landingpageUrl: "https://example.com/p/bauer" }
    });

    expect(result.replyText).toContain("nachhaken");
    expect(result.replyText).toContain("https://example.com/p/bauer");
  });
});
