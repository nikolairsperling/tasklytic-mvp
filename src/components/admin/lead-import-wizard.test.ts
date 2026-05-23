import { describe, expect, it, vi } from "vitest";
import { formatImportSuccessMessage, isImportFailure } from "@/components/admin/lead-import-wizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn()
  })
}));

describe("LeadImportWizard import result handling", () => {
  it("does not fail a successful import with warnings", () => {
    const summary = {
      success: true,
      created: 17,
      updated: 0,
      skippedDuplicates: 483,
      failed: 0,
      warnings: [{ row: 3, field: "decisionMakerEmail", message: "Ungültige E-Mail wurde ignoriert." }],
      errors: []
    };

    expect(isImportFailure({ ok: true, status: 200 }, summary)).toBe(false);
    expect(formatImportSuccessMessage(summary)).toBe("Import abgeschlossen. 17 neue Leads erstellt. 483 Duplikate übersprungen. 0 aktualisiert. Hinweise: 1");
  });

  it("does not treat skipped duplicates as failed rows", () => {
    expect(isImportFailure({ ok: true, status: 200 }, {
      success: true,
      created: 0,
      updated: 0,
      skippedDuplicates: 483,
      failed: 0,
      warnings: [],
      errors: []
    })).toBe(false);
  });

  it("fails HTTP errors and fatal-only imports without created, updated or skipped duplicate rows", () => {
    expect(isImportFailure({ ok: false, status: 500 }, { success: false, created: 17 })).toBe(true);
    expect(isImportFailure({ ok: true, status: 200 }, {
      success: true,
      created: 0,
      updated: 0,
      skippedDuplicates: 0,
      fatalErrors: [{ row: 2, field: "companyName", message: "Firma fehlt." }]
    })).toBe(true);
  });

  it("keeps partial imports successful when one row has a fatal error", () => {
    expect(isImportFailure({ ok: true, status: 200 }, {
      success: true,
      created: 1,
      updated: 0,
      skippedDuplicates: 0,
      failed: 1,
      fatalErrors: [{ row: 2, field: "companyName", message: "Firma fehlt." }]
    })).toBe(false);
  });
});
