import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GET as getAnalyticsOverviewRoute } from "../../app/api/analytics/overview/route";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { buildAnalyticsOverview, calculateCampaignRoi, rate } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

describe("calculateCampaignRoi", () => {
  it("calculates ROI with costs", () => {
    expect(
      calculateCampaignRoi({
        enrollments: 10,
        booked: 2,
        replies: 4,
        estimatedDealValue: 5000,
        estimatedCostPerLead: 100
      })
    ).toMatchObject({
      pipelineValue: 10000,
      cost: 1000,
      roiPercent: 900,
      costPerBooking: 500,
      costPerReply: 250
    });
  });

  it("returns null ROI without costs", () => {
    expect(
      calculateCampaignRoi({
        enrollments: 10,
        booked: 2,
        replies: 4
      }).roiPercent
    ).toBeNull();
  });
});

describe("analytics overview", () => {
  it("calculates percentages and protects zero denominators", () => {
    expect(rate(5, 10)).toBe(50);
    expect(rate(5, 0)).toBe(0);

    const overview = buildAnalyticsOverview({
      prospects: [],
      emailLogs: [],
      enrollments: [],
      events: [],
      campaigns: []
    });

    expect(overview.kpis.openRate).toBe(0);
    expect(overview.kpis.hotLeadRate).toBe(0);
    expect(overview.funnel.find((entry) => entry.name === "Importiert")?.rate).toBe(0);
  });

  it("builds funnel data from lead, email and appointment data", () => {
    const overview = buildAnalyticsOverview({
      prospects: [
        { id: "p1", researchStatus: "completed", landingpageUrl: "/p/a", engagementLevel: "hot", icpFitLabel: "high" },
        { id: "p2", researchStatus: "not_started", engagementLevel: "cold", icpFitLabel: "low" }
      ],
      emailLogs: [
        { campaignId: "c1", prospectId: "p1", status: "sent", openCount: 1, clickCount: 1, sentAt: "2026-05-01T08:00:00.000Z" }
      ],
      enrollments: [
        { campaignId: "c1", prospectId: "p1", repliedAt: "2026-05-01T09:00:00.000Z", bookedAt: "2026-05-01T10:00:00.000Z" }
      ],
      events: [
        { prospectId: "p1", type: "booking_opened", createdAt: "2026-05-01T09:30:00.000Z" }
      ],
      campaigns: [{ id: "c1", name: "Kampagne" }]
    });

    expect(overview.kpis.enrichmentRate).toBe(50);
    expect(overview.kpis.landingpageRate).toBe(50);
    expect(overview.kpis.openRate).toBe(100);
    expect(overview.kpis.clickRate).toBe(100);
    expect(overview.kpis.replyRate).toBe(100);
    expect(overview.kpis.hotLeadRate).toBe(50);
    expect(overview.funnel.map((entry) => [entry.name, entry.value])).toEqual([
      ["Importiert", 2],
      ["Angereichert", 1],
      ["Landingpage erstellt", 1],
      ["E-Mail gesendet", 1],
      ["Geöffnet", 1],
      ["Geklickt", 1],
      ["Geantwortet", 1],
      ["Termin", 1]
    ]);
  });

  it("respects filters in the overview API", async () => {
    const suffix = Date.now();
    const targetGroup = await prisma.targetGroup.create({
      data: { name: `Analytics TG ${suffix}`, industryKeywords: [], painKeywords: [], icpRules: {}, emailTone: "direkt", landingpageStyle: "klar", videoStyle: "kurz" }
    });
    const prospect = await prisma.prospect.create({
      data: {
        companyName: `Analytics Lead ${suffix}`,
        city: "Berlin",
        country: "DE",
        businessFields: [],
        targetGroupId: targetGroup.id,
        researchStatus: "completed",
        researchedAt: new Date(),
        slug: `analytics-${suffix}`,
        landingpageUrl: `/p/analytics-${suffix}`
      }
    });

    const response = await getAnalyticsOverviewRoute(new Request(`http://localhost/api/analytics/overview?targetGroupId=${targetGroup.id}&dateRange=all`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kpis.totalLeads).toBeGreaterThanOrEqual(1);
    expect(body.kpis.enriched).toBeGreaterThanOrEqual(1);

    await prisma.prospect.delete({ where: { id: prospect.id } });
    await prisma.targetGroup.delete({ where: { id: targetGroup.id } });
  });
});

describe("AnalyticsDashboard", () => {
  const emptyOptions = { campaigns: [], targetGroups: [], offers: [], leadLists: [] };
  const filters = { dateRange: "30d" as const, campaignId: "", targetGroupId: "", offerId: "", leadListId: "" };

  it("renders without data", () => {
    const overview = buildAnalyticsOverview({ prospects: [], emailLogs: [], enrollments: [], events: [], campaigns: [] });
    const html = renderToStaticMarkup(React.createElement(AnalyticsDashboard, { overview, filters, options: emptyOptions }));

    expect(html).toContain("Leads gesamt");
    expect(html).toContain("Keine Analytics-Daten");
    expect(html).toContain("Keine Daten vorhanden");
  });

  it("renders chart sections with data", () => {
    const overview = buildAnalyticsOverview({
      prospects: [{ id: "p1", researchStatus: "completed", landingpageUrl: "/p/a", engagementLevel: "warm", icpFitLabel: "medium" }],
      emailLogs: [{ campaignId: "c1", prospectId: "p1", status: "sent", openCount: 1, clickCount: 0, sentAt: "2026-05-01T08:00:00.000Z" }],
      enrollments: [],
      events: [],
      campaigns: [{ id: "c1", name: "Testkampagne" }]
    });
    const html = renderToStaticMarkup(React.createElement(AnalyticsDashboard, { overview, filters, options: emptyOptions }));

    expect(html).toContain("Lead Funnel");
    expect(html).toContain("Kampagnen Performance");
    expect(html).toContain("Aktivitäten über Zeit");
    expect(html).toContain("Hot/Warm/Cold");
    expect(html).toContain("ICP High/Medium/Low");
  });
});
