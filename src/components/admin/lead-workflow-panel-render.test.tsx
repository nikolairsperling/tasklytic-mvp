import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeadWorkflowPanel, type WorkflowStep } from "@/components/admin/lead-workflow-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn()
  })
}));

const emptySteps: WorkflowStep[] = [
  { action: "import", title: "Import abgeschlossen", description: "Noch kein Import-Batch vorhanden.", status: "offen", count: 0 },
  { action: "enrich", title: "Daten anreichern", description: "Manuell, max. 20 Leads pro Lauf.", status: "offen", count: 0 },
  { action: "landingpages", title: "Landingpage-Vorschauen generieren", description: "Erstellt Entwürfe.", status: "offen", count: 0 },
  { action: "emails", title: "E-Mails generieren", description: "Erstellt Entwürfe.", status: "offen", count: 0 },
  { action: "prepare", title: "Versand vorbereiten", description: "Prüfen: Signatur fehlt", status: "offen", count: 0 },
  { action: "send", title: "Versand starten", description: "Versand prüfen.", status: "offen", count: 0 }
];

describe("lead workflow panel rendering", () => {
  it("renders the empty state without workflow data", () => {
    const html = renderToStaticMarkup(<LeadWorkflowPanel steps={emptySteps} />);

    expect(html).toContain("Noch keine Daten vorhanden");
    expect(html).toContain("Leads importieren");
    expect(html).toContain("Kampagne erstellen");
  });

  it("renders with undefined arrays", () => {
    const html = renderToStaticMarkup(
      <LeadWorkflowPanel
        batchId="batch-1"
        steps={emptySteps}
        landingpages={undefined}
        previews={undefined}
        summary={null}
      />
    );

    expect(html).toContain("Versandvorschau");
    expect(html).toContain("Noch keine qualifizierten Leads für die Vorschau.");
    expect(html).toContain("Noch keine Landingpage-Vorschauen erstellt.");
  });

  it("renders with missing offer preview data", () => {
    const html = renderToStaticMarkup(
      <LeadWorkflowPanel
        batchId="batch-1"
        steps={emptySteps}
        previews={[{
          prospectId: "prospect-1",
          companyName: "Firma ohne Offer",
          slug: "firma-ohne-offer",
          landingpageUrl: "/p/firma-ohne-offer",
          companyStatus: "active",
          email: "kontakt@example.com",
          sendable: true,
          generatedEmails: []
        }]}
        landingpages={[{
          prospectId: "prospect-1",
          companyName: "Firma ohne Offer",
          slug: "firma-ohne-offer",
          reviewStatus: "draft",
          blocking: true
        }]}
      />
    );

    expect(html).toContain("Firma ohne Offer");
    expect(html).toContain("Status: Entwurf");
  });

  it("renders partial enrichment without raw load failure text", () => {
    const html = renderToStaticMarkup(
      <LeadWorkflowPanel
        batchId="batch-1"
        steps={emptySteps}
        latestEnrichmentJob={{
          jobId: "job-1",
          status: "partial",
          total: 8,
          processed: 8,
          successful: 2,
          invalid: 0,
          failed: 1,
          skipped: 2,
          currentLeadName: null,
          errors: [{ leadImportRowId: "row-1", companyName: "Fehler GmbH", error: "Quelle nicht erreichbar", source: "Datenanreicherung" }],
          items: [
            { id: "item-1", leadImportRowId: "row-1", prospectId: "prospect-1", companyName: "Fehler GmbH", status: "failed", error: "Quelle nicht erreichbar", source: "Datenanreicherung" },
            { id: "item-2", leadImportRowId: "row-2", prospectId: "prospect-2", companyName: "Erfolg GmbH", status: "success", error: null, source: "Datenanreicherung" },
            { id: "item-3", leadImportRowId: "row-3", prospectId: null, companyName: "Wartet GmbH", status: "queued", error: null, source: "Datenanreicherung" }
          ]
        }}
      />
    );

    expect(html).toContain("Teilweise abgeschlossen");
    expect(html).toContain("Erfolgreich: 2");
    expect(html).toContain("Fehlgeschlagen: 1");
    expect(html).toContain("Leadstatus anzeigen");
    expect(html).not.toContain("Load failed");
  });
});
