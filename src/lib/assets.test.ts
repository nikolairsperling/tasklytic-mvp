import { describe, expect, it } from "vitest";
import { assetCards, getAssetCounts } from "@/lib/assets";

describe("asset library", () => {
  it("defines the required asset cards", () => {
    expect(assetCards.map((card) => card.href)).toEqual([
      "/admin/assets/accounts",
      "/admin/assets/sequences",
      "/admin/assets/briefvorlagen",
      "/admin/assets/email-templates",
      "/admin/assets/videos",
      "/admin/assets/logos",
      "/admin/assets/messages",
      "/admin/landingpages/templates",
      "/admin/assets/images",
      "/admin/assets/booking"
    ]);
  });

  it("returns numeric asset counts", async () => {
    const counts = await getAssetCounts();
    expect(typeof counts.letterTemplates).toBe("number");
    expect(typeof counts.emailTemplates).toBe("number");
    expect(typeof counts.videos).toBe("number");
    expect(typeof counts.logos).toBe("number");
    expect(typeof counts.landingpages).toBe("number");
    expect(typeof counts.booking).toBe("number");
  });
});
