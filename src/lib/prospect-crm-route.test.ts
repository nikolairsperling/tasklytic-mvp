import { describe, expect, it } from "vitest";
import { PATCH } from "../../app/api/prospects/[id]/route";
import { prisma } from "@/lib/prisma";

describe("prospect CRM API", () => {
  it("updates lead status without requiring a full prospect payload", async () => {
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `CRM Test ${Date.now()}`,
        city: "Berlin",
        country: "DE",
        businessFields: []
      }
    });

    const response = await PATCH(
      new Request("http://localhost/api/prospects/test", {
        method: "PATCH",
        body: JSON.stringify({ leadStatus: "interested" })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { leadStatus: string };

    expect(response.status).toBe(200);
    expect(body.leadStatus).toBe("interested");

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("updates allowed lead edit fields and normalizes empty strings and URLs", async () => {
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Edit Test ${Date.now()}`,
        city: "Berlin",
        country: "DE",
        businessFields: []
      }
    });

    const response = await PATCH(
      new Request("http://localhost/api/prospects/test", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: "Mara",
          lastName: "",
          websiteUrl: "example.com",
          linkedinUrl: "",
          employeeCount: "42",
          businessFields: "Transport, Lager",
          painType: "recruiting",
          painSummary: "Fahrer fehlen",
          notes: "Manuell korrigiert"
        })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as {
      firstName: string;
      lastName: string | null;
      websiteUrl: string;
      linkedinUrl: string | null;
      employeeCount: number;
      businessFields: string[];
      customPainPoint: string;
      notes: Array<{ text: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.firstName).toBe("Mara");
    expect(body.lastName).toBeNull();
    expect(body.websiteUrl).toBe("https://example.com/");
    expect(body.linkedinUrl).toBeNull();
    expect(body.employeeCount).toBe(42);
    expect(body.businessFields).toEqual(["Transport", "Lager"]);
    expect(body.customPainPoint).toBe("Fahrer fehlen");
    expect(body.notes[0].text).toBe("Manuell korrigiert");

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("rejects invalid email addresses", async () => {
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Email Test ${Date.now()}`,
        city: "Berlin",
        country: "DE",
        businessFields: []
      }
    });

    const response = await PATCH(
      new Request("http://localhost/api/prospects/test", {
        method: "PATCH",
        body: JSON.stringify({ decisionMakerEmail: "keine-email" })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );

    expect(response.status).toBe(400);
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("rejects invalid URLs and foreign fields", async () => {
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `URL Test ${Date.now()}`,
        city: "Berlin",
        country: "DE",
        businessFields: []
      }
    });

    const invalidUrl = await PATCH(
      new Request("http://localhost/api/prospects/test", {
        method: "PATCH",
        body: JSON.stringify({ websiteUrl: "http:// " })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const foreignField = await PATCH(
      new Request("http://localhost/api/prospects/test", {
        method: "PATCH",
        body: JSON.stringify({ totalScore: 100 })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );

    expect(invalidUrl.status).toBe(400);
    expect(foreignField.status).toBe(400);
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });
});
