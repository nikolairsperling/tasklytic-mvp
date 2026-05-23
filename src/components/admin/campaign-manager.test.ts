import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CampaignManager,
  deleteCampaign,
  filterLeadPickerProspects,
  getCampaignListHref,
  getCampaignPaginationPages,
  getDefaultLeadPickerFilters,
  removeCampaignFromList,
  type CampaignAdminData
} from "@/components/admin/campaign-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

const data: CampaignAdminData = {
  campaigns: [
    {
      id: "campaign-1",
      name: "April Outreach",
      status: "active",
      createdAt: "2026-04-27T10:00:00.000Z",
      stepsCount: 3,
      enrollmentsCount: 12,
      sentCount: 8,
      failedCount: 1
    }
  ],
  pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
  selectedCampaign: null,
  eligibleProspects: []
};

describe("CampaignManager deletion", () => {
  it("renders a delete button for each campaign", () => {
    const html = renderToStaticMarkup(React.createElement(CampaignManager, data));

    expect(html).toContain("April Outreach löschen");
    expect(html).toContain("/admin/campaigns?campaignId=campaign-1");
  });

  it("keeps destructive campaign delete behind the confirmation state", () => {
    const html = renderToStaticMarkup(React.createElement(CampaignManager, data));

    expect(html).not.toContain("Endgültig löschen");
    expect(html).not.toContain("Kampagne löschen?");
  });

  it("renders campaign pagination pages", () => {
    const html = renderToStaticMarkup(
      React.createElement(CampaignManager, {
        ...data,
        pagination: { page: 2, limit: 10, total: 38, totalPages: 4 }
      })
    );

    expect(getCampaignPaginationPages(4)).toEqual([1, 2, 3, 4]);
    expect(getCampaignListHref("campaign-1", 2)).toBe("/admin/campaigns?campaignId=campaign-1&page=2");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain(">4</button>");
  });

  it("calls DELETE for the selected campaign", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await deleteCampaign("campaign-1", fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith("/api/campaigns/campaign-1", { method: "DELETE" });
  });

  it("removes the deleted campaign from local UI data", () => {
    const remaining = removeCampaignFromList(
      [
        data.campaigns[0],
        { ...data.campaigns[0], id: "campaign-2", name: "Mai Outreach" }
      ],
      "campaign-1"
    );

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("campaign-2");
  });
});

describe("Lead picker filters", () => {
  const leads = [
    {
      id: "lead-1",
      companyName: "Alpha GmbH",
      city: "Berlin",
      companyEmail: "info@alpha.example",
      decisionMakerEmail: "max@alpha.example",
      decisionMakerName: "Max Alpha",
      slug: "alpha",
      landingpageUrl: "/p/alpha",
      landingpageReviewStatus: "approved",
      totalScore: 82,
      status: "qualified",
      fitScore: 82,
      icpFitScore: 82,
      icpCategory: "high",
      engagementLevel: "hot",
      targetGroupId: "tg-a",
      targetGroupName: "A",
      painType: "Kosten",
      painSignals: [],
      videoUrl: null
    },
    {
      id: "lead-2",
      companyName: "Beta GmbH",
      city: "Hamburg",
      companyEmail: null,
      decisionMakerEmail: "mara@beta.example",
      decisionMakerName: "Mara Beta",
      slug: "beta",
      landingpageUrl: "/p/beta",
      landingpageReviewStatus: "approved",
      totalScore: 55,
      status: "draft",
      fitScore: 55,
      icpFitScore: 55,
      icpCategory: "medium",
      engagementLevel: "warm",
      targetGroupId: "tg-b",
      targetGroupName: "B",
      painType: "Zeit",
      painSignals: [],
      videoUrl: null
    },
    {
      id: "lead-3",
      companyName: "Gamma GmbH",
      city: "Köln",
      companyEmail: null,
      decisionMakerEmail: null,
      decisionMakerName: null,
      slug: null,
      landingpageUrl: null,
      landingpageReviewStatus: "draft",
      totalScore: 20,
      status: "open",
      fitScore: 20,
      icpFitScore: 20,
      icpCategory: "low",
      engagementLevel: "cold",
      targetGroupId: null,
      targetGroupName: null,
      painType: null,
      painSignals: [],
      videoUrl: null
    }
  ];

  it("shows leads without filters", () => {
    expect(filterLeadPickerProspects(leads, getDefaultLeadPickerFilters()).map((lead) => lead.id)).toEqual(["lead-1", "lead-2", "lead-3"]);
  });

  it("keeps target group Alle as all leads", () => {
    expect(filterLeadPickerProspects(leads, { ...getDefaultLeadPickerFilters(), targetGroupId: "" })).toHaveLength(3);
  });

  it("filters to the selected target group and can include untargeted leads", () => {
    expect(filterLeadPickerProspects(leads, { ...getDefaultLeadPickerFilters(), targetGroupId: "tg-a" }).map((lead) => lead.id)).toEqual(["lead-1"]);
    expect(
      filterLeadPickerProspects(leads, {
        ...getDefaultLeadPickerFilters(),
        targetGroupId: "tg-a",
        includeUntargetedWithTargetGroup: true
      }).map((lead) => lead.id)
    ).toEqual(["lead-1", "lead-3"]);
  });

  it("resetting filters shows leads again", () => {
    expect(filterLeadPickerProspects(leads, { ...getDefaultLeadPickerFilters(), painType: "Nicht vorhanden" })).toHaveLength(0);
    expect(filterLeadPickerProspects(leads, getDefaultLeadPickerFilters())).toHaveLength(3);
  });
});
