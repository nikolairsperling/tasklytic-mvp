import { describe, expect, it } from "vitest";
import { generateProspectSlug } from "@/lib/slug";

describe("generateProspectSlug", () => {
  it("creates a stable german prospect slug", () => {
    expect(generateProspectSlug("Friedrich Bauer Spedition", "Calw")).toBe(
      "friedrich-bauer-spedition-calw"
    );
  });

  it("normalizes umlauts and punctuation", () => {
    expect(generateProspectSlug("Müller & Söhne Logistik GmbH", "Bad Dürrheim")).toBe(
      "muller-sohne-logistik-gmbh-bad-durrheim"
    );
  });
});
