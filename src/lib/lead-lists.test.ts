import { describe, expect, it } from "vitest";
import { POST as bulkGenerateLandingpages } from "../../app/api/prospects/bulk-generate-landingpages/route";
import { POST as createLeadList } from "../../app/api/lead-lists/route";
import { GET as getLeadList } from "../../app/api/lead-lists/[id]/route";
import { DELETE as removeMembers, POST as addMembers } from "../../app/api/lead-lists/[id]/members/route";
import { POST as createFromLeads } from "../../app/api/campaigns/create-from-leads/route";
import { GET as getProspects } from "../../app/api/prospects/route";
import { prisma } from "@/lib/prisma";

describe("lead lists and bulk lead actions", () => {
  it("creates a lead list and assigns leads without duplicates", async () => {
    const suffix = Date.now();
    const prospect = await prisma.prospect.create({
      data: { companyName: `List Lead ${suffix}`, city: "Berlin", country: "DE", businessFields: [] }
    });

    const createResponse = await createLeadList(new Request("http://localhost/api/lead-lists", {
      method: "POST",
      body: JSON.stringify({ name: `Liste ${suffix}`, description: "Segment" })
    }));
    const list = await createResponse.json() as { id: string; name: string };

    const membersResponse = await addMembers(new Request(`http://localhost/api/lead-lists/${list.id}/members`, {
      method: "POST",
      body: JSON.stringify({ prospectIds: [prospect.id, prospect.id] })
    }), { params: Promise.resolve({ id: list.id }) });
    const membersBody = await membersResponse.json() as { added: number; skipped: number };
    const detailResponse = await getLeadList(new Request(`http://localhost/api/lead-lists/${list.id}`), { params: Promise.resolve({ id: list.id }) });
    const detail = await detailResponse.json() as { members: unknown[] };

    expect(createResponse.status).toBe(201);
    expect(membersBody.added).toBe(1);
    expect(membersBody.skipped).toBe(1);
    expect(detail.members).toHaveLength(1);

    await prisma.leadList.delete({ where: { id: list.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("removes leads from a lead list", async () => {
    const suffix = Date.now();
    const prospect = await prisma.prospect.create({
      data: { companyName: `Remove List Lead ${suffix}`, city: "Berlin", country: "DE", businessFields: [] }
    });
    const list = await prisma.leadList.create({ data: { name: `Remove List ${suffix}`, members: { create: { prospectId: prospect.id } } } });

    const response = await removeMembers(new Request(`http://localhost/api/lead-lists/${list.id}/members`, {
      method: "DELETE",
      body: JSON.stringify({ prospectIds: [prospect.id] })
    }), { params: Promise.resolve({ id: list.id }) });
    const body = await response.json() as { removed: number; skipped: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ removed: 1, skipped: 0 });
    await expect(prisma.leadListMember.count({ where: { leadListId: list.id } })).resolves.toBe(0);

    await prisma.leadList.delete({ where: { id: list.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("filters prospects by lead list membership", async () => {
    const suffix = Date.now();
    const [included, excluded] = await Promise.all([
      prisma.prospect.create({ data: { companyName: `Filtered List Lead ${suffix}`, city: "Berlin", country: "DE", businessFields: [] } }),
      prisma.prospect.create({ data: { companyName: `Filtered Other Lead ${suffix}`, city: "Berlin", country: "DE", businessFields: [] } })
    ]);
    const list = await prisma.leadList.create({ data: { name: `Filter List ${suffix}`, members: { create: { prospectId: included.id } } } });

    const response = await getProspects(new Request(`http://localhost/api/prospects?leadListId=${list.id}&q=Filtered`));
    const body = await response.json() as { data: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.data.map((item) => item.id)).toContain(included.id);
    expect(body.data.map((item) => item.id)).not.toContain(excluded.id);

    await prisma.leadList.delete({ where: { id: list.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: [included.id, excluded.id] } } });
  });

  it("bulk-generates landingpages and skips existing landingpages", async () => {
    const suffix = Date.now();
    const [fresh, existing] = await Promise.all([
      prisma.prospect.create({ data: { companyName: `Landing Fresh ${suffix}`, city: "Berlin", country: "DE", businessFields: [] } }),
      prisma.prospect.create({ data: { companyName: `Landing Existing ${suffix}`, city: "Berlin", country: "DE", businessFields: [], slug: `existing-${suffix}`, landingpageUrl: `/p/existing-${suffix}` } })
    ]);

    const response = await bulkGenerateLandingpages(new Request("http://localhost/api/prospects/bulk-generate-landingpages", {
      method: "POST",
      body: JSON.stringify({ ids: [fresh.id, existing.id] })
    }));
    const body = await response.json() as { generated: number; skipped: number; failed: number };
    const updated = await prisma.prospect.findUniqueOrThrow({ where: { id: fresh.id } });

    expect(body).toEqual({ generated: 1, skipped: 1, failed: 0 });
    expect(updated.slug).toBeTruthy();
    expect(updated.landingpageUrl).toContain("/p/");

    await prisma.prospect.deleteMany({ where: { id: { in: [fresh.id, existing.id] } } });
  });

  it("creates a campaign from a lead list and skips duplicate recipients", async () => {
    const suffix = Date.now();
    const targetGroup = await prisma.targetGroup.create({
      data: { name: `List Campaign TG ${suffix}`, industryKeywords: [], painKeywords: [], icpRules: {}, emailTone: "direkt", landingpageStyle: "klar", videoStyle: "kurz" }
    });
    const offer = await prisma.offer.create({
      data: { workspaceId: "default", name: `List Campaign Offer ${suffix}`, serviceDescription: "Service", coreProblems: ["Problem"], solutions: ["Solution"] }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `List Campaign Lead ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        companyStatus: "active",
        decisionMakerEmail: `list-campaign-${suffix}@example.com`,
        slug: `list-campaign-${suffix}`,
        landingpageUrl: `/p/list-campaign-${suffix}`
      }
    });
    const list = await prisma.leadList.create({ data: { name: `Campaign List ${suffix}`, members: { create: { prospectId: prospect.id } } } });

    const response = await createFromLeads(new Request("http://localhost/api/campaigns/create-from-leads", {
      method: "POST",
      body: JSON.stringify({
        prospectIds: [prospect.id],
        leadListId: list.id,
        targetGroupId: targetGroup.id,
        offerId: offer.id,
        name: `List Campaign ${suffix}`
      })
    }));
    const body = await response.json() as { campaignId: string; added: number; skipped: number };

    expect(response.status).toBe(201);
    expect(body.added).toBe(1);
    expect(body.skipped).toBe(1);
    await expect(prisma.campaignEnrollment.count({ where: { campaignId: body.campaignId, prospectId: prospect.id } })).resolves.toBe(1);

    await prisma.campaign.delete({ where: { id: body.campaignId } });
    await prisma.leadList.delete({ where: { id: list.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });
});
