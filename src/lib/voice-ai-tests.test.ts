import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVoiceAiTestCall,
  getVoiceAiTestModeState,
  requiredSuccessfulVoiceAiTestCalls,
  voiceAiTestScript
} from "@/lib/voice-ai-tests";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prospect: { findUnique: vi.fn() },
    voiceAiTestCall: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe("voice ai test mode", () => {
  beforeEach(() => {
    vi.mocked(prisma.prospect.findUnique).mockReset();
    vi.mocked(prisma.voiceAiTestCall.create).mockReset();
    vi.mocked(prisma.voiceAiTestCall.count).mockReset();
    vi.mocked(prisma.voiceAiTestCall.findMany).mockReset();
  });

  it("stores test calls without mutating real lead state", async () => {
    vi.mocked(prisma.prospect.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.voiceAiTestCall.create).mockImplementation(async (args) => ({ id: "test-1", ...args.data }) as never);

    const call = await createVoiceAiTestCall({
      testPhoneNumber: "+49 30 123456",
      voice: "neutral",
      scenario: "kein_interesse",
      prospectId: null
    });

    expect(call.summary).toContain("Ablehnung");
    expect(call.detectedObjections).toEqual(["Kein Interesse"]);
    expect(prisma.voiceAiTestCall.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({
        leadStatus: expect.anything(),
        followUpStatus: expect.anything()
      })
    }));
  });

  it("requires five successful calls before activation", async () => {
    vi.mocked(prisma.voiceAiTestCall.count).mockResolvedValue(requiredSuccessfulVoiceAiTestCalls);
    vi.mocked(prisma.voiceAiTestCall.findMany).mockResolvedValue([]);

    await expect(getVoiceAiTestModeState()).resolves.toMatchObject({
      successfulCount: 5,
      canActivate: true
    });
  });

  it("builds a visible script for test review", () => {
    expect(voiceAiTestScript("terminwunsch").join(" ")).toContain("Termin");
    expect(voiceAiTestScript("terminwunsch").join(" ")).toContain("nie behaupten");
  });
});
