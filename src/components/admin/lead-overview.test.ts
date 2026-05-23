import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeadOverview } from "@/components/admin/lead-overview";

const leads = [
  {
    id: "lead-1",
    name: "Max Mustermann",
    company: "Acme GmbH",
    status: "qualified",
    leadStatus: "open",
    icpFitScore: 82,
    icpFitLabel: "high",
    industry: "Logistik",
    painType: "hiring",
    warmth: "warm",
    score: 72,
    lastEvent: { id: "event-1", type: "page_view" as const, createdAt: "2026-05-01T08:00:00.000Z" },
    landingpageUrl: "/p/acme",
    slug: "acme",
    decisionMakerEmail: "max@example.com",
    companyEmail: null,
    landingpageReviewStatus: "approved"
  },
  {
    id: "lead-2",
    name: "Erika Beispiel",
    company: "Beta KG",
    status: "contacted",
    leadStatus: "in_progress",
    icpFitScore: 64,
    icpFitLabel: "medium",
    industry: null,
    painType: null,
    warmth: "cold",
    score: 45,
    lastEvent: null,
    landingpageUrl: null,
    slug: null,
    decisionMakerEmail: "erika@example.com",
    companyEmail: null,
    landingpageReviewStatus: "draft"
  }
];

describe("LeadOverview bulk selection", () => {
  it("renders multiple selectable leads with visible selection controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(LeadOverview, {
        initialLeads: leads,
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        campaigns: [{ id: "campaign-1", name: "April Outreach", status: "active" }]
      })
    );

    expect(html).toContain("Alle sichtbaren auswählen");
    expect(html).not.toContain("Daten anreichern");
    expect(html).toContain("Max Mustermann auswählen");
    expect(html).toContain("Erika Beispiel auswählen");
    expect(html).toContain("role=\"button\"");
  });

  it("renders the sticky bulk action buttons once selection exists", () => {
    const html = renderToStaticMarkup(
      React.createElement(LeadOverview, {
        initialLeads: leads,
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        campaigns: [{ id: "campaign-1", name: "April Outreach", status: "active" }]
      })
    );

    expect(html).not.toContain("Zur Kampagne hinzufügen");
    expect(html).not.toContain("Neue Kampagne erstellen");
    expect(html).not.toContain("Ausgewählte löschen");
  });
});
