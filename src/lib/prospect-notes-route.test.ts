import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/prospects/[id]/notes/route";
import { prisma } from "@/lib/prisma";

describe("prospect notes API", () => {
  it("creates notes for a prospect", async () => {
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Notes Test ${Date.now()}`,
        city: "Berlin",
        country: "DE",
        businessFields: []
      }
    });

    const response = await POST(
      new Request("http://localhost/api/prospects/test/notes", {
        method: "POST",
        body: JSON.stringify({ text: "Lead wirkt interessiert." })
      }),
      { params: Promise.resolve({ id: prospect.id }) }
    );
    const body = await response.json() as { text: string; prospectId: string };

    expect(response.status).toBe(201);
    expect(body.text).toBe("Lead wirkt interessiert.");
    expect(body.prospectId).toBe(prospect.id);

    await prisma.prospect.delete({ where: { id: prospect.id } });
  });
});
