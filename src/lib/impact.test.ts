import { describe, expect, it, vi } from "vitest";
import { formatImpactProgress, impactProgress, isImpactJobStatus, runLandingpageImpactJob } from "@/lib/impact";

describe("impact studio jobs", () => {
  it("calculates progress and validates statuses", () => {
    expect(impactProgress({ processedItems: 87, totalItems: 87 })).toBe(100);
    expect(formatImpactProgress({ processedItems: 12, totalItems: 20 })).toBe("12/20 Leads");
    expect(isImpactJobStatus("running")).toBe(true);
    expect(isImpactJobStatus("queued")).toBe(false);
  });

  it("landingpage job creates slugs for prospects without slug", async () => {
    const prospects = [{ id: "p1", companyName: "Acme Logistik", city: "Berlin", slug: null }];
    const db = {
      prospect: {
        findMany: vi.fn().mockResolvedValue(prospects),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({ ...prospects[0], slug: "acme-logistik-berlin" })
      },
      campaignEnrollment: { findMany: vi.fn() },
      impactJob: {
        create: vi.fn().mockResolvedValue({ id: "j1" }),
        update: vi.fn().mockResolvedValue({ id: "j1", status: "completed", processedItems: 1, totalItems: 1 })
      }
    };

    const job = await runLandingpageImpactJob({ prospectIds: ["p1"] }, db as never);
    expect(job.status).toBe("completed");
    expect(db.prospect.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slug: "acme-logistik-berlin", status: "landingpage_ready" })
    }));
    expect(db.impactJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ processedItems: 1, status: "completed" })
    }));
  });
});
