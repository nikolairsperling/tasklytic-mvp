import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockVideo,
  enforceVideoBatchLimit,
  fallbackVideoScript,
  generateAndApplyMockVideo,
  sanitizeVideoJob
} from "@/lib/video";
import { prisma } from "@/lib/prisma";
import { defaultUserId, upsertUserOffer } from "@/lib/user-offer";

const prospect = {
  id: "p1",
  slug: "acme-berlin",
  companyName: "Acme Logistik",
  city: "Berlin",
  decisionMakerName: "Max Bauer",
  decisionMakerRole: "Geschäftsführer",
  customPainPoint: "manuelle Übergaben",
  businessFields: ["Spedition"],
  vehicleCount: 20,
  locationsCount: 2
};

describe("personalized video v1", () => {
  beforeEach(async () => {
    await upsertUserOffer({
      businessName: "OpsPilot",
      serviceDescription: "KI Automatisierung fuer operative Prozesse",
      targetAudienceDescription: "Speditionen und Logistikunternehmen",
      coreProblems: ["manuelle Uebergaben"],
      solutions: ["automatisierte Workflows"],
      valueProposition: "schnell live ohne IT-Projekt",
      toneOfVoice: "freundlich"
    });
  });

  afterEach(async () => {
    await prisma.offer.deleteMany({ where: { workspaceId: "default", campaigns: { none: {} } } });
    await prisma.userOffer.deleteMany({ where: { userId: defaultUserId } });
  });

  it("creates a fallback script without OPENAI_API_KEY", () => {
    const script = fallbackVideoScript(prospect as never, { tone: "freundlich" });
    expect(script).toContain("Acme Logistik");
    expect(script).toContain("kurz austauschen");
    expect(script).not.toContain("Ich hoffe");
  });

  it("mock provider returns a ready-testable video url", () => {
    const result = createMockVideo("Hallo", prospect);
    expect(result.videoUrl).toBe("/mock-videos/acme-berlin");
    expect(result.videoUrl).not.toMatch(/^\/api\//);
    expect(result.providerJobId).toBe("mock_acme-berlin");
  });

  it("enforces the batch limit of 20 prospects", () => {
    expect(enforceVideoBatchLimit(Array.from({ length: 20 }, (_, index) => `p${index}`))).toHaveLength(20);
    expect(() => enforceVideoBatchLimit(Array.from({ length: 21 }, (_, index) => `p${index}`))).toThrow("Maximal 20");
  });

  it("creates a job, marks it ready and updates the prospect", async () => {
    const job = { id: "j1", prospectId: "p1", provider: "mock", status: "script_ready", scriptText: "Script", thumbnailUrl: null };
    const ready = { ...job, status: "ready", videoUrl: "/mock-videos/acme-berlin", providerJobId: "mock_acme-berlin" };
    const db = {
      prospect: {
        findUnique: vi.fn().mockResolvedValue(prospect),
        update: vi.fn().mockResolvedValue({ ...prospect, personalVideoUrl: ready.videoUrl })
      },
      videoTemplate: {
        findUnique: vi.fn()
      },
      videoGenerationJob: {
        create: vi.fn().mockResolvedValue(job),
        findUnique: vi.fn()
          .mockResolvedValueOnce({ ...job, prospect })
          .mockResolvedValueOnce(ready),
        update: vi.fn().mockResolvedValue(ready)
      }
    };

    const result = await generateAndApplyMockVideo({ prospectId: "p1" }, db as never);
    expect(result.status).toBe("ready");
    expect(db.videoGenerationJob.create).toHaveBeenCalled();
    expect(db.prospect.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ personalVideoUrl: ready.videoUrl, personalVideoStatus: "ready" })
    }));
  });

  it("does not expose provider secrets in serialized jobs", () => {
    const job = sanitizeVideoJob({ id: "j1", provider: "mock", status: "ready", videoUrl: "/video" });
    expect(JSON.stringify(job)).not.toMatch(/secret|apiKey|token/i);
  });
});
