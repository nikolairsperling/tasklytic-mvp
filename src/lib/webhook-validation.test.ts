import { describe, expect, it } from "vitest";
import { parseProspectPayload } from "@/lib/prospects";

describe("parseProspectPayload", () => {
  it("accepts a valid webhook payload", () => {
    const payload = parseProspectPayload({
      companyName: "Bauer Transporte",
      city: "Stuttgart",
      country: "DE",
      businessFields: "Spedition, Stückgut",
      openDispatcherJob: true
    });

    expect(payload.companyName).toBe("Bauer Transporte");
    expect(payload.businessFields).toEqual(["Spedition", "Stückgut"]);
    expect(payload.openDispatcherJob).toBe(true);
  });

  it("defaults optional collections when they are omitted", () => {
    const payload = parseProspectPayload({
      companyName: "Meyer Logistik",
      city: "Bremen",
      country: "DE"
    });

    expect(payload.businessFields).toEqual([]);
  });

  it("rejects invalid payloads", () => {
    expect(() =>
      parseProspectPayload({
        companyName: "",
        city: ""
      })
    ).toThrow();
  });
});
