import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import {
  BulkActionBar,
  BulkResearchLimitModal,
  deleteProspect,
  exceedsBulkResearchLimit,
  getBulkResearchBatchIds,
  getBulkSelectionLabel,
  getProspectListHref,
  getPaginationPages,
  LandingpageActions,
  normalizeBulkApiError,
  ProspectList,
  requiresBulkDeleteTypedConfirmation,
  removeProspectFromList,
  ScoreSummary,
  toggleVisibleSelection,
  type ProspectListItem
} from "@/components/admin/prospect-list";
import { getErrorMessage } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

const prospect: ProspectListItem = {
  id: "prospect-1",
  companyName: "Acme Logistik",
  city: "Berlin",
  country: "Deutschland",
  totalScore: 82,
  engagementScore: 42,
  engagementLevel: "warm",
  isHotLead: true,
  icpCategory: "high",
  icpFitScore: 82,
  icpFitLabel: "high",
  industry: "Logistik/Spedition",
  painType: "hiring",
  painSignals: [{ label: "Viele offene Stellen", type: "jobs" }],
  status: "qualified",
  slug: "acme-logistik",
  targetGroup: { id: "tg-1", name: "Speditionen" },
  updatedAt: "2026-05-01T08:00:00.000Z"
};

describe("ProspectList CRM table", () => {
  it("renders the cleaned prospect table", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProspectList, {
        prospects: [prospect],
        activeStatus: "all",
        scoreFilter: "all",
        pagination: { page: 1, limit: 10, total: 25, totalPages: 3 }
      })
    );

    expect(html).toContain("Löschen");
    expect(html).toContain("Prospect öffnen");
    expect(html).toContain("Lead / Firma");
    expect(html).toContain("Zielgruppe");
    expect(html).toContain("Letzte Aktivität");
    expect(html).toContain("Speditionen");
  });

  it("renders ScoreSummary with ICP and Engagement", () => {
    const html = renderToStaticMarkup(
      React.createElement(ScoreSummary, {
        score: 44,
        icpLabel: "high",
        icpScore: 88,
        engagementLevel: "hot",
        engagementScore: 100
      })
    );

    expect(html).toContain("Score");
    expect(html).toContain("44");
    expect(html).toContain("ICP");
    expect(html).toContain("High");
    expect(html).toContain("88");
    expect(html).toContain("Engagement");
    expect(html).toContain("Hot");
    expect(html).toContain("100");
  });

  it("renders compact landingpage actions", () => {
    const html = renderToStaticMarkup(React.createElement(LandingpageActions, { slug: "acme-logistik" }));

    expect(html).toContain("Landingpage Vorschau");
    expect(html).toContain("Landingpage öffnen");
    expect(html).toContain("Landingpage Link kopieren");
    expect(html).toContain("/p/acme-logistik");
  });

  it("keeps row click and bulk selection controls available", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProspectList, {
        prospects: [prospect],
        activeStatus: "all",
        scoreFilter: "all",
        pagination: { page: 1, limit: 10, total: 25, totalPages: 3 }
      })
    );

    expect(html).toContain("role=\"button\"");
    expect(html).toContain("Alle sichtbaren auswählen");
    expect(html).toContain("Acme Logistik auswählen");
    expect(html).not.toContain("Daten anreichern");
  });

  it("renders bulk action buttons when prospects are selected", () => {
    const html = renderToStaticMarkup(
      React.createElement(BulkActionBar, {
        selectedCount: 2,
        bulkDeleting: false,
        onResearch: vi.fn(),
        onGenerateLandingpages: vi.fn(),
        onAddToCampaign: vi.fn(),
        onAssignLeadList: vi.fn(),
        onDelete: vi.fn()
      })
    );

    expect(html).toContain("Daten anreichern");
    expect(html).toContain("Landingpages generieren");
    expect(html).toContain("Zur Kampagne hinzufügen");
    expect(html).toContain("Leadliste zuweisen");
    expect(html).toContain("Auswahl löschen");
  });

  it("renders page-scoped and global selection labels", () => {
    expect(getBulkSelectionLabel({ selectedCount: 10, selectedMode: "page" })).toBe("10 Leads auf dieser Seite ausgewählt");
    expect(getBulkSelectionLabel({ selectedCount: 501, selectedMode: "allFiltered" })).toBe("Alle 501 gefilterten Leads ausgewählt");

    const html = renderToStaticMarkup(
      React.createElement(BulkActionBar, {
        selectedCount: 10,
        selectionLabel: getBulkSelectionLabel({ selectedCount: 10, selectedMode: "page" }),
        canSelectAllFiltered: true,
        totalFiltered: 501,
        bulkDeleting: false,
        onResearch: vi.fn(),
        onGenerateLandingpages: vi.fn(),
        onAddToCampaign: vi.fn(),
        onAssignLeadList: vi.fn(),
        onSelectAllFiltered: vi.fn(),
        onDelete: vi.fn()
      })
    );

    expect(html).toContain("10 Leads auf dieser Seite ausgewählt");
    expect(html).toContain("Alle 501 Leads auswählen");
  });

  it("keeps header selection scoped to visible leads", () => {
    expect(toggleVisibleSelection(["lead-99"], ["lead-1", "lead-2"], true).sort()).toEqual(["lead-1", "lead-2", "lead-99"]);
    expect(toggleVisibleSelection(["lead-1", "lead-2", "lead-99"], ["lead-1", "lead-2"], false)).toEqual(["lead-99"]);
  });

  it("requires typed confirmation only for destructive large bulk deletes", () => {
    expect(requiresBulkDeleteTypedConfirmation(50)).toBe(false);
    expect(requiresBulkDeleteTypedConfirmation(51)).toBe(true);
  });

  it("normalizes raw Zod bulk errors and limits research batches", () => {
    const rawZod = '[{"code":"too_big","maximum":20,"path":["ids"],"message":"Array must contain at most 20 element(s)"}]';

    expect(normalizeBulkApiError(rawZod)).toBe("Maximal 20 Leads pro Lauf erlaubt. Bitte wähle höchstens 20 Leads aus oder starte mehrere Läufe.");
    expect(normalizeBulkApiError({ error: rawZod })).not.toContain("too_big");
    expect(exceedsBulkResearchLimit(21)).toBe(true);
    expect(getBulkResearchBatchIds(Array.from({ length: 25 }, (_, index) => `lead-${index}`))).toHaveLength(20);
  });

  it("returns a clean backend message for Zod bulk research limits", () => {
    const schema = z.object({
      ids: z.array(z.string()).max(20, "Maximal 20 Leads pro Lauf erlaubt.")
    });
    const result = schema.safeParse({ ids: Array.from({ length: 21 }, (_, index) => `lead-${index}`) });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getErrorMessage(result.error, "Fallback")).toBe("Maximal 20 Leads pro Lauf erlaubt.");
    }
  });

  it("renders the research limit modal with the first-batch action", () => {
    const html = renderToStaticMarkup(
      React.createElement(BulkResearchLimitModal, {
        selectedCount: 501,
        onCancel: vi.fn(),
        onRunFirstBatch: vi.fn()
      })
    );

    expect(html).toContain("Zu viele Leads ausgewählt");
    expect(html).toContain("Aktuell sind 501 Leads ausgewählt");
    expect(html).toContain("Erste 20 Leads anreichern");
  });

  it("shows the research limit hint in the bulk bar", () => {
    const html = renderToStaticMarkup(
      React.createElement(BulkActionBar, {
        selectedCount: 21,
        bulkDeleting: false,
        researchLimited: true,
        onResearch: vi.fn(),
        onGenerateLandingpages: vi.fn(),
        onAddToCampaign: vi.fn(),
        onAssignLeadList: vi.fn(),
        onDelete: vi.fn()
      })
    );

    expect(html).toContain("Datenanreicherung: max. 20 pro Lauf");
  });

  it("keeps destructive delete behind the confirmation state", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProspectList, {
        prospects: [prospect],
        activeStatus: "all",
        scoreFilter: "all",
        pagination: { page: 1, limit: 10, total: 25, totalPages: 3 }
      })
    );

    expect(html).not.toContain("Endgültig löschen");
    expect(getProspectListHref({ activeStatus: "qualified", scoreFilter: "hot" })).toBe(
      "/admin/prospects?status=qualified&score=hot"
    );
    expect(getProspectListHref({ activeStatus: "qualified", scoreFilter: "hot", page: 2 })).toBe(
      "/admin/prospects?status=qualified&score=hot&page=2"
    );
    expect(getProspectListHref({ activeStatus: "qualified", scoreFilter: "hot", searchQuery: "Acme", page: 2 })).toBe(
      "/admin/prospects?status=qualified&score=hot&q=Acme&page=2"
    );
  });

  it("renders pagination pages from totalPages", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProspectList, {
        prospects: [prospect],
        activeStatus: "all",
        scoreFilter: "all",
        pagination: { page: 2, limit: 10, total: 35, totalPages: 4 }
      })
    );

    expect(getPaginationPages(4)).toEqual([1, 2, 3, 4]);
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain(">4</button>");
  });

  it("renders page size controls and keeps limit changes on page 1", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProspectList, {
        prospects: [prospect],
        activeStatus: "all",
        scoreFilter: "all",
        pagination: { page: 1, limit: 50, total: 503, totalPages: 11 }
      })
    );

    expect(html).toContain("503 Einträge · Seite 1 von 11 · 50 pro Seite");
    expect(html).toContain("Leads pro Seite");
    expect(html).toContain("<option value=\"100\">100</option>");
    expect(getProspectListHref({ page: 1, limit: 100 })).toBe("/admin/prospects?limit=100");
  });

  it("calls DELETE for the selected prospect", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await deleteProspect("prospect-1", fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith("/api/prospects/prospect-1", { method: "DELETE" });
  });

  it("removes the prospect from local UI data after success", () => {
    const remaining = removeProspectFromList([
      prospect,
      { ...prospect, id: "prospect-2", companyName: "Beta Spedition" }
    ], "prospect-1");

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("prospect-2");
  });
});
