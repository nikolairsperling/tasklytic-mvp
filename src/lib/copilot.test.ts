import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCopilotMessages,
  copilotRequestSchema,
  copilotSystemPrompt,
  formatCopilotContext,
  requestCopilotCompletion,
  type CopilotContext
} from "@/lib/copilot";

const baseContext: CopilotContext = {
  metrics: {
    prospects: 42,
    campaignReady: 12,
    activeCampaigns: 3,
    plannedCampaigns: 1,
    sent: 120,
    opens: 80,
    clicks: 25,
    replies: 9,
    booked: 4,
    notInterested: 6,
    pipelineValue: 20000,
    roi: 150,
    importedLeads: 50,
    enrichedLeads: 40,
    validLeads: 38,
    invalidCompanies: 4,
    generatedLandingpages: 10,
    generatedEmails: 8,
    clickUpSyncedTotal: 5,
    clickUpSyncedToday: 1,
    clickUpUpdates: 2,
    clickUpOpenErrors: 0
  },
  topProspects: [
    { companyName: "Muster GmbH", city: "Berlin", industry: "Logistik", score: 88, leadStatus: "open", engagementLevel: "hot" }
  ]
};

describe("copilotRequestSchema", () => {
  it("rejects empty message lists", () => {
    expect(() => copilotRequestSchema.parse({ messages: [] })).toThrow();
  });

  it("rejects blank message content", () => {
    expect(() => copilotRequestSchema.parse({ messages: [{ role: "user", content: "   " }] })).toThrow();
  });

  it("accepts a valid user message", () => {
    const parsed = copilotRequestSchema.parse({ messages: [{ role: "user", content: "Hallo" }] });
    expect(parsed.messages).toHaveLength(1);
  });
});

describe("formatCopilotContext", () => {
  it("includes key metrics and top leads", () => {
    const text = formatCopilotContext(baseContext);
    expect(text).toContain("Prospects gesamt: 42");
    expect(text).toContain("Pipeline-Wert: 20000 EUR");
    expect(text).toContain("ROI: 150%");
    expect(text).toContain("Muster GmbH (Berlin, Logistik)");
  });

  it("notes when no leads exist", () => {
    const text = formatCopilotContext({ ...baseContext, topProspects: [] });
    expect(text).toContain("Noch keine Leads vorhanden.");
  });

  it("renders non-calculable ROI", () => {
    const text = formatCopilotContext({ ...baseContext, metrics: { ...baseContext.metrics, roi: null } });
    expect(text).toContain("ROI: nicht berechenbar");
  });
});

describe("buildCopilotMessages", () => {
  it("prepends a developer message with the system prompt and context", () => {
    const messages = buildCopilotMessages("DATEN", [{ role: "user", content: "Frage" }]);
    expect(messages[0].role).toBe("developer");
    expect(messages[0].content).toContain(copilotSystemPrompt);
    expect(messages[0].content).toContain("DATEN");
    expect(messages[1]).toEqual({ role: "user", content: "Frage" });
  });
});

describe("requestCopilotCompletion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the conversation to OpenAI and returns the trimmed reply", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "  Antwort  " } }] }), { status: 200 })
    );

    const reply = await requestCopilotCompletion(
      { apiKey: "test-key", messages: [{ role: "user", content: "Wie laeuft meine Pipeline?" }], context: baseContext },
      fetcher as unknown as typeof fetch
    );

    expect(reply).toBe("Antwort");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer test-key" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].role).toBe("developer");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "Wie laeuft meine Pipeline?" });
  });

  it("throws when OpenAI responds with an error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(
      requestCopilotCompletion(
        { apiKey: "test-key", messages: [{ role: "user", content: "Hi" }], context: baseContext },
        fetcher as unknown as typeof fetch
      )
    ).rejects.toThrow();
  });
});
