import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  engagementLevelForScore,
  getProspectEventScoreDelta,
  trackProspectEvent
} from "@/lib/prospect-events";

const mockPrisma = vi.hoisted(() => ({
  prospect: {
    findUnique: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() })
}));

type FakeProspect = {
  id: string;
  slug: string;
  engagementScore: number;
  engagementLevel: string;
};

function createFakeStore(initialProspects: FakeProspect[]) {
  const prospects = new Map(initialProspects.map((prospect) => [prospect.id, { ...prospect }]));
  const events: Array<{ prospectId: string; type: string; scoreDelta: number; meta?: unknown }> = [];

  const store = {
    prospect: {
      async findUnique({ where }: { where: { id?: string; slug?: string } }) {
        if (where.id) return prospects.get(where.id) ?? null;
        return Array.from(prospects.values()).find((prospect) => prospect.slug === where.slug) ?? null;
      },
      async update({ where, data }: { where: { id: string }; data: { engagementScore: number; engagementLevel: string } }) {
        const prospect = prospects.get(where.id);
        if (!prospect) throw new Error("missing prospect");
        Object.assign(prospect, data);
        return prospect;
      }
    },
    prospectEvent: {
      async create({ data }: { data: { prospectId: string; type: string; scoreDelta: number; meta?: unknown } }) {
        events.push(data);
        return data;
      }
    },
    async $transaction<T>(callback: (tx: typeof store) => Promise<T>) {
      return callback(store);
    },
    events,
    prospects
  };

  return store;
}

describe("prospect event tracking", () => {
  it("stores an event with slug", async () => {
    const store = createFakeStore([{ id: "prospect-1", slug: "acme", engagementScore: 0, engagementLevel: "cold" }]);

    const result = await trackProspectEvent({ slug: "acme", type: "page_view" }, store);

    expect(result).toMatchObject({ prospectId: "prospect-1", scoreDelta: 5, engagementScore: 5, engagementLevel: "cold" });
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({ prospectId: "prospect-1", type: "page_view", scoreDelta: 5 });
  });

  it("stores an event with prospectId", async () => {
    const store = createFakeStore([{ id: "prospect-2", slug: "bauer", engagementScore: 20, engagementLevel: "cold" }]);

    const result = await trackProspectEvent({ prospectId: "prospect-2", type: "cta_clicked" }, store);

    expect(result).toMatchObject({ prospectId: "prospect-2", scoreDelta: 25, engagementScore: 45, engagementLevel: "warm" });
    expect(store.events[0]).toMatchObject({ prospectId: "prospect-2", type: "cta_clicked", scoreDelta: 25 });
  });

  it("does not store anything for an invalid slug", async () => {
    const store = createFakeStore([{ id: "prospect-3", slug: "known", engagementScore: 0, engagementLevel: "cold" }]);

    const result = await trackProspectEvent({ slug: "missing", type: "page_view" }, store);

    expect(result).toBeNull();
    expect(store.events).toHaveLength(0);
  });

  it("calculates score deltas and updates engagement score", async () => {
    const store = createFakeStore([{ id: "prospect-4", slug: "video", engagementScore: 10, engagementLevel: "cold" }]);

    await trackProspectEvent({ prospectId: "prospect-4", type: "video_watched" }, store);

    expect(getProspectEventScoreDelta("video_watched")).toBe(20);
    expect(store.prospects.get("prospect-4")).toMatchObject({ engagementScore: 30, engagementLevel: "warm" });
  });

  it("scores report engagement events", async () => {
    const store = createFakeStore([{ id: "prospect-report", slug: "report", engagementScore: 0, engagementLevel: "cold" }]);

    await trackProspectEvent({ slug: "report", type: "report_generated" }, store);
    await trackProspectEvent({ slug: "report", type: "report_downloaded" }, store);

    expect(getProspectEventScoreDelta("report_generated")).toBe(10);
    expect(getProspectEventScoreDelta("report_downloaded")).toBe(20);
    expect(store.prospects.get("prospect-report")).toMatchObject({ engagementScore: 30, engagementLevel: "warm" });
  });

  it("maps engagement levels", () => {
    expect(engagementLevelForScore(0)).toBe("cold");
    expect(engagementLevelForScore(20)).toBe("cold");
    expect(engagementLevelForScore(21)).toBe("warm");
    expect(engagementLevelForScore(50)).toBe("warm");
    expect(engagementLevelForScore(51)).toBe("hot");
  });
});

describe("prospect detail page", () => {
  beforeEach(() => {
    mockPrisma.prospect.findUnique.mockReset();
  });

  it("renders the activity feed", async () => {
    mockPrisma.prospect.findUnique.mockResolvedValue({
      id: "prospect-1",
      slug: "acme",
      companyName: "Acme Logistik",
      street: null,
      postalCode: null,
      city: "Hamburg",
      country: "DE",
      status: "contacted",
      decisionMakerName: "Anna Beispiel",
      decisionMakerEmail: "anna@example.com",
      companyEmail: null,
      phone: null,
      websiteUrl: "https://example.com",
      businessFields: ["Logistik"],
      engagementScore: 55,
      engagementLevel: "hot",
      fitScore: 72,
      icpCategory: "hot",
      painScore: 60,
      contactQualityScore: 50,
      personalVideoUrl: null,
      videoUrl: null,
      personalVideoThumbnailUrl: null,
      bookingUrl: null,
      calendarUrl: null,
      events: [
        {
          id: "event-1",
          type: "cta_clicked",
          scoreDelta: 25,
          createdAt: new Date("2026-04-27T10:00:00.000Z")
        }
      ],
      enrichmentRuns: []
    });

    const { default: ProspectDetailPage } = await import("../../app/admin/prospects/[id]/page");
    const element = await ProspectDetailPage({ params: Promise.resolve({ id: "prospect-1" }) });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain("Activity Feed");
    expect(html).toContain("CTA geklickt");
    expect(html).toContain("+25");
  });
});
