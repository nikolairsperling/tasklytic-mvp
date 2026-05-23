import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public landingpage performance rules", () => {
  it("keeps the mobile landingpage free of horizontal overflow utility masking", () => {
    const source = readFileSync("app/p/[slug]/page.tsx", "utf8");
    expect(source).not.toContain("overflow-x-hidden");
  });

  it("uses lazy loading for video or booking iframes", () => {
    const source = readFileSync("app/p/[slug]/booking/page.tsx", "utf8");
    expect(source).toContain('loading="lazy"');
    expect(source).toContain("<iframe");
  });
});
