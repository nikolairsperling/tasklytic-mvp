import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const prospectEventTypes = [
  "page_view",
  "video_started",
  "video_watched",
  "cta_clicked",
  "booking_opened",
  "booking_completed",
  "email_opened",
  "email_clicked",
  "email_replied",
  "report_generated",
  "report_downloaded",
  "report_opened",
  "campaign_enrolled",
  "campaign_unenrolled"
] as const;

export type ProspectEventType = (typeof prospectEventTypes)[number];

export const prospectEventInputSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  prospectId: z.string().trim().min(1).optional(),
  type: z.enum(prospectEventTypes),
  meta: z.unknown().optional()
}).refine((value) => Boolean(value.slug || value.prospectId), {
  message: "slug oder prospectId erforderlich"
});

export type ProspectEventInput = z.infer<typeof prospectEventInputSchema>;

export type ProspectEventForScore = {
  type: string;
};

type ProspectEventTxStore = {
  prospect: {
    findUnique(args: {
      where: { id: string } | { slug: string | undefined };
      select: { id: true; engagementScore?: true };
    }): Promise<{ id: string; engagementScore?: number } | null>;
    update(args: {
      where: { id: string };
      data: { engagementScore: number; engagementLevel: EngagementLevel };
      select: { id: true; engagementScore: true; engagementLevel: true };
    }): Promise<{ id: string; engagementScore: number; engagementLevel: string }>;
  };
  prospectEvent: {
    create(args: {
      data: {
        prospectId: string;
        type: string;
        meta?: Prisma.InputJsonValue;
        scoreDelta: number;
      };
    }): Promise<unknown>;
  };
};

type ProspectEventStore = ProspectEventTxStore & {
  $transaction<T>(callback: (tx: ProspectEventTxStore) => Promise<T>): Promise<T>;
};

export const prospectEventScoreWeights: Record<ProspectEventType, number> = {
  page_view: 5,
  video_started: 10,
  video_watched: 20,
  cta_clicked: 25,
  booking_opened: 30,
  booking_completed: 50,
  email_opened: 5,
  email_clicked: 15,
  email_replied: 40,
  report_generated: 10,
  report_downloaded: 20,
  report_opened: 15,
  campaign_enrolled: 0,
  campaign_unenrolled: 0
};

export type EngagementLevel = "cold" | "warm" | "hot";

export function getProspectEventScoreDelta(type: string): number {
  return prospectEventScoreWeights[type as ProspectEventType] ?? 0;
}

export function calculateProspectActivityScore(events: ProspectEventForScore[]): number {
  const score = events.reduce((sum, event) => sum + getProspectEventScoreDelta(event.type), 0);
  return Math.min(100, score);
}

export function engagementLevelForScore(score: number): EngagementLevel {
  if (score >= 51) {
    return "hot";
  }
  if (score >= 21) {
    return "warm";
  }
  return "cold";
}

export function prospectEventLabel(type: string): string {
  const labels: Record<ProspectEventType, string> = {
    page_view: "Landingpage besucht",
    video_started: "Video gestartet",
    video_watched: "Video angesehen",
    cta_clicked: "CTA geklickt",
    booking_opened: "Buchungsseite geöffnet",
    booking_completed: "Termin gebucht",
    email_opened: "E-Mail geöffnet",
    email_clicked: "E-Mail Link geklickt",
    email_replied: "Antwort erhalten",
    report_generated: "Kurzreport generiert",
    report_downloaded: "Kurzreport heruntergeladen",
    report_opened: "Kurzreport geöffnet",
    campaign_enrolled: "In Kampagne aufgenommen",
    campaign_unenrolled: "Aus Kampagne ausgetragen"
  };

  return labels[type as ProspectEventType] ?? type;
}

export function sanitizeEventMeta(meta: unknown): Prisma.InputJsonValue | undefined {
  if (meta === undefined || meta === null) {
    return undefined;
  }

  const normalized = JSON.parse(JSON.stringify(meta)) as Prisma.InputJsonValue;
  const serialized = JSON.stringify(normalized);
  if (serialized.length > 4096) {
    return { truncated: true };
  }

  return normalized;
}

export function sanitizeTrackingMeta(meta: unknown): Prisma.InputJsonValue | undefined {
  const sanitized = sanitizeEventMeta(meta);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return sanitized;
  }

  const blockedKeys = new Set(["apiKey", "api_key", "authorization", "password", "token", "secret", "ip"]);
  return Object.fromEntries(
    Object.entries(sanitized).filter(([key]) => !blockedKeys.has(key.toLowerCase()))
  ) as Prisma.InputJsonValue;
}

export async function trackProspectEvent(
  input: ProspectEventInput,
  store: ProspectEventStore
): Promise<{ prospectId: string; scoreDelta: number; engagementScore: number; engagementLevel: string } | null> {
  const prospect = input.prospectId
    ? await store.prospect.findUnique({
        where: { id: input.prospectId },
        select: { id: true, engagementScore: true }
      })
    : await store.prospect.findUnique({
        where: { slug: input.slug },
        select: { id: true, engagementScore: true }
      });

  if (!prospect) {
    return null;
  }

  const scoreDelta = getProspectEventScoreDelta(input.type);
  const engagementScore = Math.min(100, (prospect.engagementScore ?? 0) + scoreDelta);
  const engagementLevel = engagementLevelForScore(engagementScore);

  return store.$transaction(async (tx) => {
    await tx.prospectEvent.create({
      data: {
        prospectId: prospect.id,
        type: input.type,
        meta: sanitizeTrackingMeta(input.meta),
        scoreDelta
      }
    });

    const updated = await tx.prospect.update({
      where: { id: prospect.id },
      data: { engagementScore, engagementLevel },
      select: { id: true, engagementScore: true, engagementLevel: true }
    });

    return {
      prospectId: updated.id,
      scoreDelta,
      engagementScore: updated.engagementScore,
      engagementLevel: updated.engagementLevel
    };
  });
}
