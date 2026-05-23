import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HotLeadDashboard } from "@/components/admin/hot-lead-dashboard";
import {
  buildHotLeadKpis,
  sortHotLeads,
  type HotLeadItem
} from "@/lib/hot-leads";

const mockPrisma = vi.hoisted(() => ({
  prospect: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/components/admin/prospect-crm-panel", () => ({
  ProspectCrmPanel: () => React.createElement("div", null, "Drawer")
}));
vi.mock("@/components/admin/prospect-list", () => ({
  prospectDetailFromApi: (prospect: unknown) => prospect
}));

const baseDate = new Date("2026-04-28T10:00:00.000Z");

function hotLead(overrides: Partial<HotLeadItem> = {}): HotLeadItem {
  return {
    prospectId: "prospect-1",
    name: "Anna Beispiel",
    companyName: "Acme Logistik",
    city: "Berlin",
    status: "qualified",
    engagementScore: 70,
    engagementLevel: "hot",
    icpFitScore: 80,
    painType: "jobs",
    painSummary: "Viele offene Stellen im Dispo-Team",
    lastEvent: {
      id: "event-1",
      type: "cta_clicked",
      createdAt: baseDate.toISOString()
    },
    lastActivityAt: baseDate.toISOString(),
    landingpageUrl: "/p/acme",
    decisionMakerEmail: "anna@example.com",
    phone: "+491234567",
    companyPhone: "+4930123456",
    linkedinUrl: "https://linkedin.example/anna",
    ...overrides
  };
}

function prospect(overrides: Record<string, unknown> = {}) {
  return {
    id: "prospect-1",
    companyName: "Acme Logistik",
    city: "Berlin",
    status: "qualified",
    decisionMakerName: "Anna Beispiel",
    firstName: null,
    lastName: null,
    engagementScore: 0,
    engagementLevel: "cold",
    fitScore: 0,
    icpFitScore: 0,
    painSignals: [],
    customPainPoint: null,
    landingpageUrl: null,
    slug: "acme",
    decisionMakerEmail: null,
    phone: null,
    companyPhone: null,
    linkedinUrl: null,
    updatedAt: baseDate,
    events: [],
    ...overrides
  };
}

describe("hot lead API", () => {
  beforeEach(() => {
    mockPrisma.prospect.findMany.mockReset();
  });

  it("returns only hot leads", async () => {
    mockPrisma.prospect.findMany.mockResolvedValue([
      prospect({ id: "cold", companyName: "Cold GmbH" }),
      prospect({ id: "score", companyName: "Score GmbH", engagementScore: 55 }),
      prospect({
        id: "event",
        companyName: "Event GmbH",
        events: [{ id: "event-1", type: "video_watched", createdAt: baseDate }]
      })
    ]);
    const { GET } = await import("../../app/api/hot-leads/route");

    const response = await GET();
    const body = await response.json() as { data: HotLeadItem[] };

    expect(body.data.map((lead) => lead.prospectId)).toEqual(["event", "score"]);
    expect(body.data.every((lead) => lead.companyName !== "Cold GmbH")).toBe(true);
  });

  it("requests hot lead source criteria from prisma", async () => {
    mockPrisma.prospect.findMany.mockResolvedValue([]);
    const { GET } = await import("../../app/api/hot-leads/route");

    await GET();

    expect(mockPrisma.prospect.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { engagementLevel: "hot" },
          { engagementScore: { gte: 50 } },
          { fitScore: { gte: 70 } },
          { icpFitScore: { gte: 70 } },
          { events: { some: { type: { in: ["booking_opened", "cta_clicked", "email_replied", "video_watched"] } } } }
        ])
      })
    }));
  });
});

describe("hot lead priority", () => {
  it("sorts strongest purchase intent before score and activity", () => {
    const leads = sortHotLeads([
      hotLead({ prospectId: "video", engagementScore: 99, lastEvent: { id: "v", type: "video_watched", createdAt: "2026-04-28T12:00:00.000Z" }, lastActivityAt: "2026-04-28T12:00:00.000Z" }),
      hotLead({ prospectId: "reply", engagementScore: 10, lastEvent: { id: "r", type: "email_replied", createdAt: "2026-04-27T12:00:00.000Z" }, lastActivityAt: "2026-04-27T12:00:00.000Z" }),
      hotLead({ prospectId: "booking", engagementScore: 20, lastEvent: { id: "b", type: "booking_opened", createdAt: "2026-04-27T11:00:00.000Z" }, lastActivityAt: "2026-04-27T11:00:00.000Z" }),
      hotLead({ prospectId: "cta", engagementScore: 30, lastEvent: { id: "c", type: "cta_clicked", createdAt: "2026-04-27T10:00:00.000Z" }, lastActivityAt: "2026-04-27T10:00:00.000Z" })
    ]);

    expect(leads.map((lead) => lead.prospectId)).toEqual(["reply", "booking", "cta", "video"]);
  });
});

describe("HotLeadDashboard", () => {
  it("renders KPIs", () => {
    const leads = [
      hotLead({ prospectId: "cta", lastEvent: { id: "c", type: "cta_clicked", createdAt: baseDate.toISOString() } }),
      hotLead({ prospectId: "booking", lastEvent: { id: "b", type: "booking_opened", createdAt: baseDate.toISOString() } }),
      hotLead({ prospectId: "reply", lastEvent: { id: "r", type: "email_replied", createdAt: "2026-04-27T10:00:00.000Z" }, lastActivityAt: "2026-04-27T10:00:00.000Z" })
    ];

    const html = renderToStaticMarkup(
      React.createElement(HotLeadDashboard, {
        leads,
        kpis: buildHotLeadKpis(leads, baseDate)
      })
    );

    expect(html).toContain("Hot Leads gesamt");
    expect(html).toContain("Heute aktiv");
    expect(html).toContain("CTA geklickt");
    expect(html).toContain("Buchungsseite geöffnet");
    expect(html).toContain("Antworten erhalten");
  });

  it("renders the empty state", () => {
    const html = renderToStaticMarkup(
      React.createElement(HotLeadDashboard, {
        leads: [],
        kpis: buildHotLeadKpis([], baseDate)
      })
    );

    expect(html).toContain("Noch keine Hot Leads. Starte eine Kampagne oder prüfe deine Tracking- und Research-Daten.");
  });

  it("renders clickable rows and drawer actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(HotLeadDashboard, {
        leads: [hotLead()],
        kpis: buildHotLeadKpis([hotLead()], baseDate)
      })
    );

    expect(html).toContain("role=\"button\"");
    expect(html).toContain("Drawer öffnen");
    expect(html).toContain("Landingpage öffnen");
    expect(html).toContain("E-Mail schreiben");
    expect(html).toContain("Anrufen");
    expect(html).toContain("Wiedervorlage setzen");
  });
});
