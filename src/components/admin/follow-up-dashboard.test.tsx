import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FollowUpDashboard, type FollowUpDashboardData } from "@/components/admin/follow-up-dashboard";

const baseData: FollowUpDashboardData = {
  summary: { today: 1, overdue: 1, week: 2, done: 3, dueCount: 2, totalOpen: 4 },
  lists: {
    due: [
      {
        id: "due",
        companyName: "Acme Logistik",
        city: "Berlin",
        decisionMakerName: "Anna Beispiel",
        firstName: null,
        lastName: null,
        phone: "+49 30 123456",
        companyPhone: null,
        decisionMakerPhone: null,
        decisionMakerEmail: "anna@example.com",
        lastEmailSentAt: "2026-04-28T10:00:00.000Z",
        followUpReason: "Nach E-Mail-Versand",
        followUpAt: "2026-04-30T10:00:00.000Z",
        followUpStatus: "open",
        status: "contacted",
        leadStatus: "open",
        slug: "acme-logistik",
        landingpageUrl: "/p/acme-logistik",
        companyEmail: "info@example.com"
      }
    ],
    overdue: [
      {
        id: "overdue",
        companyName: "Schnell GmbH",
        city: "Hamburg",
        decisionMakerName: "Max Schnell",
        firstName: null,
        lastName: null,
        phone: null,
        companyPhone: null,
        decisionMakerPhone: null,
        decisionMakerEmail: "max@example.com",
        lastEmailSentAt: "2026-04-24T10:00:00.000Z",
        followUpReason: "Rückruf",
        followUpAt: "2026-04-25T10:00:00.000Z",
        followUpStatus: "open",
        status: "contacted",
        leadStatus: "open",
        slug: null,
        landingpageUrl: null,
        companyEmail: "info@schnell.example"
      }
    ],
    week: [],
    done: []
  }
};

describe("FollowUpDashboard", () => {
  it("renders the follow-up summary and action controls", () => {
    const html = renderToStaticMarkup(React.createElement(FollowUpDashboard, baseData));

    expect(html).toContain("Heute fällig");
    expect(html).toContain("Überfällig");
    expect(html).toContain("Diese Woche");
    expect(html).toContain("Erledigt");
    expect(html).toContain("Wiedervorlagen");
    expect(html).toContain("tel:");
    expect(html).toContain("Anrufen");
    expect(html).toContain("Erledigt");
    expect(html).toContain("Später erinnern");
  });

  it("disables the call action when no number exists", () => {
    const html = renderToStaticMarkup(React.createElement(FollowUpDashboard, {
      ...baseData,
      lists: {
        ...baseData.lists,
        due: [{ ...baseData.lists.due[0], phone: null, companyPhone: null, decisionMakerPhone: null }]
      }
    }));

    expect(html).toContain("Keine Telefonnummer vorhanden");
    expect(html).toContain("disabled");
  });
});
