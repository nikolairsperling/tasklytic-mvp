import { describe, expect, it } from "vitest";
import { formatAutoFlowResult, formatWorkflowResult } from "@/components/admin/lead-workflow-panel";

describe("lead workflow result messages", () => {
  it("maps action results to readable toast messages", () => {
    expect(formatWorkflowResult("enrich", { processed: 20, enriched: 17, invalid: 3 })).toBe("20 Leads verarbeitet. 17 angereichert. 3 ungültig.");
    expect(formatWorkflowResult("landingpages", { generated: 12, skipped: 2 })).toBe("12 Landingpages generiert. 2 übersprungen.");
    expect(formatWorkflowResult("emails", { generated: 10, failed: 0 })).toBe("10 E-Mails generiert. 0 Fehler.");
    expect(formatWorkflowResult("send", { sent: 5, failed: 1, skipped: 0 })).toBe("5 E-Mails versendet. 1 fehlgeschlagen. 0 übersprungen.");
  });

  it("formats auto-flow result summaries", () => {
    expect(formatAutoFlowResult({
      total: 20,
      processed: 20,
      enriched: 17,
      invalid: 3,
      landingpagesGenerated: 17,
      emailsGenerated: 17,
      prepared: 17,
      sent: 0,
      blocked: 2,
      breakdown: "20 Leads -> 17 gültig -> 17 mit E-Mail -> 17 versendbar"
    })).toEqual([
      "20 Leads -> 17 gültig -> 17 mit E-Mail -> 17 versendbar",
      "20 Leads verarbeitet",
      "17 angereichert",
      "3 ungültig",
      "17 Landingpages generiert",
      "17 E-Mail-Entwürfe erstellt",
      "17 für den Versand vorbereitet",
      "0 E-Mails versendet",
      "2 geblockt"
    ]);
  });
});
