import { describe, expect, it } from "vitest";
import { getDashboardMetrics } from "@/lib/dashboard";

describe("dashboard metrics", () => {
  it("returns KPI values for the admin overview", async () => {
    const metrics = await getDashboardMetrics();
    expect(metrics).toHaveProperty("prospects");
    expect(metrics).toHaveProperty("pipelineValue");
    expect(typeof metrics.sent).toBe("number");
  });
});
