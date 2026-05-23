import { describe, expect, it, vi } from "vitest";
import * as route from "../../app/api/workflows/lead-to-outreach/run/route";
import * as leadWorkflow from "@/lib/lead-workflow";
import { prisma } from "@/lib/prisma";

describe("lead-to-outreach workflow route", () => {
  it("starts only through POST", () => {
    expect("POST" in route).toBe(true);
    expect("GET" in route).toBe(false);
  });

  it("defaults sendNow to false", async () => {
    const batch = await prisma.leadImportBatch.create({ data: { filename: "route-auto.csv", totalRows: 0 } });
    const response = await route.POST(new Request("http://localhost/api/workflows/lead-to-outreach/run", {
      method: "POST",
      body: JSON.stringify({ batchId: batch.id })
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sent).toBe(0);
    expect(data.failed).toBe(0);

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
  });

  it("returns the workflow fallback error instead of throwing raw exceptions", async () => {
    const spy = vi.spyOn(leadWorkflow, "runLeadToOutreachWorkflow").mockRejectedValueOnce(new Error("database relation missing"));
    const response = await route.POST(new Request("http://localhost/api/workflows/lead-to-outreach/run", {
      method: "POST",
      body: JSON.stringify({ batchId: "batch-1" })
    }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Workflow konnte nicht geladen werden." });
    spy.mockRestore();
  });
});
