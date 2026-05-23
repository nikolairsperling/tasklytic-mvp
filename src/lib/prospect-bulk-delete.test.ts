import { describe, expect, it } from "vitest";
import { POST as bulkDeleteProspects } from "../../app/api/prospects/bulk-delete/route";
import { bulkDeleteSchema, bulkDeleteTypedConfirmation, normalizeBulkDeleteInput } from "@/lib/bulk-delete";
import { prisma } from "@/lib/prisma";

describe("prospect bulk delete", () => {
  it("rejects empty ids before any delete can run", async () => {
    const response = await bulkDeleteProspects(new Request("http://localhost/api/prospects/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids: [] })
    }));

    expect(response.status).toBe(400);
  });

  it("requires hard confirmation for more than 50 leads", () => {
    const ids = Array.from({ length: 51 }, (_, index) => `lead-${index}`);

    expect(() => normalizeBulkDeleteInput(bulkDeleteSchema.parse({ ids }))).toThrow("harter Bestätigung");
    expect(normalizeBulkDeleteInput(bulkDeleteSchema.parse({
      ids,
      confirmBulkDelete: true,
      typedConfirmation: bulkDeleteTypedConfirmation
    })).ids).toHaveLength(51);
  });

  it("deduplicates ids so deleteMany is only called with explicit unique ids", () => {
    const input = normalizeBulkDeleteInput(bulkDeleteSchema.parse({ ids: ["lead-1", "lead-1", "lead-2"] }));

    expect(input.ids).toEqual(["lead-1", "lead-2"]);
  });

  it("deletes multiple prospects and reports failures", async () => {
    const suffix = Date.now();
    const [first, second] = await Promise.all([
      prisma.prospect.create({
        data: {
          companyName: `Bulk Delete ${suffix} A`,
          city: "Berlin",
          country: "DE",
          businessFields: []
        }
      }),
      prisma.prospect.create({
        data: {
          companyName: `Bulk Delete ${suffix} B`,
          city: "Hamburg",
          country: "DE",
          businessFields: []
        }
      })
    ]);

    const response = await bulkDeleteProspects(new Request("http://localhost/api/prospects/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids: [first.id, second.id, "missing-id"] })
    }));
    const body = await response.json() as { deleted: number; failed: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: 2, failed: 1 });
    await expect(prisma.prospect.count({ where: { id: { in: [first.id, second.id] } } })).resolves.toBe(0);
  });
});
