import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ProspectActivityTracker cookie consent", () => {
  it("blocks tracking unless cookie consent was accepted", () => {
    const source = readFileSync("src/components/landing/prospect-activity-tracker.tsx", "utf8");

    expect(source).toContain("tasklytic-cookie-consent");
    expect(source).toContain('=== "accepted"');
    expect(source).toContain("if (!trackingAllowed())");
  });
});
