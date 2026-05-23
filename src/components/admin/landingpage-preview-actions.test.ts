import { describe, expect, it } from "vitest";
import { canPreviewLandingpage } from "@/components/admin/landingpage-preview-actions";

describe("landingpage preview actions", () => {
  it("blocks preview when slug is missing", () => {
    expect(canPreviewLandingpage(null)).toEqual({
      ok: false,
      message: "Bitte zuerst Landingpage generieren"
    });
  });
});
