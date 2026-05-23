import { describe, expect, it } from "vitest";
import { classifyEmail } from "@/lib/inbox-classification";

describe("classifyEmail", () => {
  it("recognizes positive replies", () => {
    const result = classifyEmail("Hallo, klingt gut. Gerne sprechen wir dazu.");
    expect(result.category).toBe("positive");
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it("recognizes negative replies", () => {
    const result = classifyEmail("Danke, aber kein Interesse. Bitte nicht mehr schreiben.");
    expect(result.category).toBe("negative");
    expect(result.confidence).toBeGreaterThanOrEqual(85);
  });

  it("recognizes questions", () => {
    const result = classifyEmail("Wie funktioniert das genau? Können Sie mir mehr Details schicken?");
    expect(result.category).toBe("question");
    expect(result.confidence).toBeGreaterThanOrEqual(78);
  });

  it("recognizes auto replies", () => {
    const result = classifyEmail("Vielen Dank für Ihre Nachricht. Ich bin bis Montag im Urlaub.");
    expect(result.category).toBe("auto_reply");
    expect(result.confidence).toBeGreaterThanOrEqual(95);
  });
});
