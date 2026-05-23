import { describe, expect, it } from "vitest";
import { buildWorkflowSteps } from "../../app/admin/workflows/lead-to-outreach/page";

describe("workflow page defaults", () => {
  it("builds defensive empty steps without campaign data", () => {
    const steps = buildWorkflowSteps();

    expect(steps).toHaveLength(7);
    expect(steps.every((step) => step.count === 0)).toBe(true);
    expect(steps[0]).toMatchObject({
      action: "import",
      description: "Noch kein Import-Batch vorhanden.",
      status: "offen"
    });
  });

  it("builds steps with empty campaign and missing configuration lists", () => {
    const steps = buildWorkflowSteps({
      latest: { id: "batch-1", createdCount: 0, updatedCount: 0 },
      smtp: { configured: false },
      hasSignature: false
    });

    expect(steps[0].description).toBe("0 neu, 0 aktualisiert");
    expect(steps[5].description).toContain("SMTP fehlt");
    expect(steps[5].description).toContain("Signatur fehlt");
  });
});
