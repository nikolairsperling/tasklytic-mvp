import { describe, expect, it } from "vitest";
import { calculateSavings } from "@/lib/savings";

describe("calculateSavings", () => {
  it("calculates yearly savings and fte", () => {
    const result = calculateSavings({
      dispatchers: 2,
      manualHoursPerWeek: 30,
      hourlyRate: 55
    });

    expect(result.yearlyHours).toBe(3120);
    expect(result.yearlySavings).toBe(171600);
    expect(result.fte).toBeCloseTo(1.7727, 3);
  });
});
