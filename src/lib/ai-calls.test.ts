import { describe, expect, it } from "vitest";
import { evaluateAiCallReadiness } from "@/lib/ai-calls";

const sentAt = new Date("2026-05-20T10:00:00.000Z");
const now = new Date("2026-05-22T10:00:00.000Z");

function prospect(overrides: Partial<Parameters<typeof evaluateAiCallReadiness>[0]> = {}): Parameters<typeof evaluateAiCallReadiness>[0] {
  return {
    id: "prospect-1",
    icpScore: 0,
    icpFitScore: 75,
    fitScore: 0,
    leadStatus: "open",
    status: "contacted",
    phone: null,
    companyPhone: "+49 421 123456",
    decisionMakerPhone: null,
    campaignEnrollments: [],
    emailSendLogs: [{ status: "sent", sentAt, repliedAt: null, step: { stepNumber: 1 } }],
    inboundEmails: [],
    events: [],
    aiCalls: [],
    ...overrides
  };
}

describe("ai call readiness", () => {
  it("recommends calls only after 24 hours, sufficient ICP and a phone number", () => {
    const readiness = evaluateAiCallReadiness(prospect(), now);

    expect(readiness.status).toBe("call_eligible");
    expect(readiness.recommended).toBe(true);
    expect(readiness.phone).toBe("+49 421 123456");
  });

  it("blocks calls before the 24 hour mail delay has passed", () => {
    const readiness = evaluateAiCallReadiness(prospect(), new Date("2026-05-20T20:00:00.000Z"));

    expect(readiness.status).toBe("not_eligible");
    expect(readiness.blockers).toContain("Call ist frühestens 24 Stunden nach Versand erlaubt.");
  });

  it("raises priority after landingpage or video engagement", () => {
    const readiness = evaluateAiCallReadiness(prospect({
      events: [{ type: "video_started", createdAt: new Date("2026-05-21T12:00:00.000Z") }]
    }), now);

    expect(readiness.priority).toBe("high");
    expect(readiness.preferredWindowStart?.toISOString()).toBe("2026-05-22T12:00:00.000Z");
  });

  it("blocks replies and no-interest leads", () => {
    expect(evaluateAiCallReadiness(prospect({ leadStatus: "not_interested" }), now).blockers[0]).toContain("Opt-out");
    expect(evaluateAiCallReadiness(prospect({ campaignEnrollments: [{ repliedAt: now, notInterestedAt: null }] }), now).blockers[0]).toContain("Lead hat bereits geantwortet");
  });
});
