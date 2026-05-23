import type { Prisma, Prospect, VideoGenerationJob, VideoTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTargetGroupOrDefault, targetGroupContextText, type TargetGroupLike } from "@/lib/target-groups";
import { requireOfferForProspect, userOfferContextText } from "@/lib/user-offer";

export const videoProviders = ["mock", "heygen", "tavus", "synthesia", "custom"] as const;
export const videoStatuses = ["none", "pending", "script_ready", "processing", "ready", "failed"] as const;
export const maxVideoBatchProspects = 20;

export type VideoTone = "direkt" | "freundlich" | "beratend" | "kurz";

type VideoPrisma = Pick<typeof prisma, "prospect" | "videoTemplate" | "videoGenerationJob">;

export function isVideoProvider(value: unknown): value is (typeof videoProviders)[number] {
  return typeof value === "string" && videoProviders.includes(value as (typeof videoProviders)[number]);
}

export function isVideoStatus(value: unknown): value is (typeof videoStatuses)[number] {
  return typeof value === "string" && videoStatuses.includes(value as (typeof videoStatuses)[number]);
}

export function enforceVideoBatchLimit(ids: string[], limit = maxVideoBatchProspects) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length > limit) {
    throw new Error(`Maximal ${limit} Prospects pro Video-Batch erlaubt.`);
  }
  return unique;
}

export function fallbackVideoScript(
  prospect: Pick<Prospect, "companyName" | "city" | "decisionMakerName" | "decisionMakerRole" | "customPainPoint" | "businessFields" | "vehicleCount" | "locationsCount">,
  options: { tone?: VideoTone; maxSeconds?: number; targetGroup?: TargetGroupLike; offerContext?: string } = {}
) {
  const name = prospect.decisionMakerName || "Guten Tag";
  const role = prospect.decisionMakerRole ? ` in Ihrer Rolle als ${prospect.decisionMakerRole}` : "";
  const signal = prospect.customPainPoint
    || prospect.businessFields[0]
    || (prospect.vehicleCount ? `Ihre Flotte mit ${prospect.vehicleCount} Fahrzeugen` : "")
    || (prospect.locationsCount ? `Ihre Standorte` : "")
    || `die operativen Abläufe bei ${prospect.companyName}`;
  const compact = options.tone === "kurz";
  const body = compact
    ? `ich habe mir ${prospect.companyName} in ${prospect.city} kurz angesehen. ${signal} wirkt nach einem guten Ansatzpunkt, um manuelle Abstimmung zu reduzieren.`
    : `ich habe mir ${prospect.companyName} in ${prospect.city} kurz angesehen. ${signal} ist ein sinnvoller Einstieg, um zu prüfen, wo wiederkehrende Abstimmung, Nachfassen und Übergaben Zeit kosten.`;

  const targetGroupHint = options.targetGroup ? ` Fuer ${options.targetGroup.name} geht es vor allem um ${options.targetGroup.painKeywords.slice(0, 2).join(" und ")}.` : "";
  const offerHint = options.offerContext ? ` Der Bezug ist: ${options.offerContext.split("\n").filter((line) => /Dienstleistung|Loesung/.test(line)).join(" ")}` : "";
  return `${name}${role}, ${body}${targetGroupHint}${offerHint} Wenn das relevant ist, lassen Sie uns kurz austauschen oder schauen Sie sich zuerst die persoenliche Landingpage an.`;
}

export async function generateVideoScript(
  prospect: Prospect,
  options: { tone?: VideoTone; maxSeconds?: number; prompt?: string } = {}
) {
  const { getEffectiveOpenAiApiKey } = await import("@/lib/integrations");
  const offer = await requireOfferForProspect(prospect);
  const offerContext = userOfferContextText(offer);
  const targetGroup = await getTargetGroupOrDefault(prospect.targetGroupId);
  const apiKey = await getEffectiveOpenAiApiKey();
  if (!apiKey) {
    return fallbackVideoScript(prospect, { ...options, targetGroup, offerContext });
  }

  const prompt = [
    "Schreibe ein deutsches Skript fuer ein personalisiertes B2B-Outreach-Video.",
    offerContext,
    `Du sprichst einen Prospect aus der Zielgruppe ${targetGroup.name} an.`,
    targetGroupContextText(targetGroup),
    "Regeln: menschlich, keine Gedankenstriche, kein ChatGPT-Code, keine Floskel wie Ich hoffe, es geht Ihnen gut.",
    "Keine erfundenen Fakten. Nur vorhandene Prospect-Daten nutzen. Wenn Daten fehlen, allgemein formulieren.",
    `Maximal ${options.maxSeconds ?? 60} Sekunden Sprechtext. Tonalitaet: ${options.tone ?? "freundlich"}.`,
    "Klare Ansprache an Geschaeftsfuehrer oder Ansprechpartner. Ziel: persoenlicher Einstieg und Termininteresse.",
    "CTA am Ende: kurzer Austausch oder Landingpage ansehen.",
    options.prompt ? `Zusatzprompt: ${options.prompt}` : "",
    `Prospect: ${JSON.stringify({
      companyName: prospect.companyName,
      city: prospect.city,
      decisionMakerName: prospect.decisionMakerName,
      decisionMakerRole: prospect.decisionMakerRole,
      businessFields: prospect.businessFields,
      customPainPoint: prospect.customPainPoint,
      vehicleCount: prospect.vehicleCount,
      locationsCount: prospect.locationsCount
    })}`
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    return fallbackVideoScript(prospect, { ...options, targetGroup, offerContext });
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return (data.choices?.[0]?.message?.content?.trim() || fallbackVideoScript(prospect, { ...options, targetGroup, offerContext })).replace(/[—–]/g, ",");
}

export async function createVideoJob(
  prospectId: string,
  templateId?: string | null,
  options: { campaignId?: string | null; tone?: VideoTone; scriptText?: string; db?: VideoPrisma } = {}
) {
  const db = options.db ?? prisma;
  const prospect = await db.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) throw new Error("Prospect nicht gefunden");

  const template = templateId ? await db.videoTemplate.findUnique({ where: { id: templateId } }) : null;
  const provider = template?.provider ?? "mock";
  const scriptText = options.scriptText ?? await generateVideoScript(prospect, {
    tone: options.tone,
    prompt: template?.defaultScriptPrompt ?? undefined
  });

  return db.videoGenerationJob.create({
    data: {
      prospectId,
      campaignId: options.campaignId || undefined,
      videoTemplateId: template?.id,
      provider,
      status: "script_ready",
      scriptText,
      thumbnailUrl: template?.defaultThumbnailUrl ?? undefined
    }
  });
}

export function createMockVideo(script: string | null | undefined, prospect: Pick<Prospect, "id" | "slug">) {
  const key = prospect.slug || prospect.id;
  return {
    videoUrl: `/mock-videos/${encodeURIComponent(key)}`,
    thumbnailUrl: `/tasklytic-icon.svg`,
    providerJobId: `mock_${key}`,
    scriptText: script || ""
  };
}

export async function startVideoGeneration(jobId: string, db: VideoPrisma = prisma) {
  const job = await db.videoGenerationJob.findUnique({ where: { id: jobId }, include: { prospect: true } });
  if (!job) throw new Error("Video-Job nicht gefunden");

  if (job.provider !== "mock") {
    return db.videoGenerationJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: "Provider vorbereitet, noch nicht verbunden."
      }
    });
  }

  const mock = createMockVideo(job.scriptText, job.prospect);
  return db.videoGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "ready",
      videoUrl: mock.videoUrl,
      thumbnailUrl: job.thumbnailUrl || mock.thumbnailUrl,
      providerJobId: mock.providerJobId,
      errorMessage: null
    }
  });
}

export async function updateProspectVideoFromJob(jobId: string, db: VideoPrisma = prisma) {
  const job = await db.videoGenerationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Video-Job nicht gefunden");

  return db.prospect.update({
    where: { id: job.prospectId },
    data: {
      personalVideoUrl: job.videoUrl,
      personalVideoThumbnailUrl: job.thumbnailUrl,
      personalVideoScript: job.scriptText,
      personalVideoStatus: job.status,
      personalVideoProvider: job.provider,
      personalVideoJobId: job.id,
      personalVideoError: job.errorMessage
    }
  });
}

export async function generateAndApplyMockVideo(input: {
  prospectId: string;
  campaignId?: string | null;
  videoTemplateId?: string | null;
  tone?: VideoTone;
}, db: VideoPrisma = prisma) {
  const job = await createVideoJob(input.prospectId, input.videoTemplateId, {
    campaignId: input.campaignId,
    tone: input.tone,
    db
  });
  const started = await startVideoGeneration(job.id, db);
  await updateProspectVideoFromJob(started.id, db);
  return sanitizeVideoJob(started);
}

export function sanitizeVideoJob<T extends Partial<VideoGenerationJob> & { videoTemplate?: VideoTemplate | null }>(job: T) {
  return job;
}

export function videoTemplateData(body: Record<string, unknown>): Prisma.VideoTemplateUncheckedCreateInput {
  const provider = isVideoProvider(body.provider) ? body.provider : "mock";
  return {
    name: String(body.name || "Video Template"),
    provider,
    providerTemplateId: typeof body.providerTemplateId === "string" && body.providerTemplateId ? body.providerTemplateId : undefined,
    defaultScriptPrompt: typeof body.defaultScriptPrompt === "string" && body.defaultScriptPrompt ? body.defaultScriptPrompt : undefined,
    defaultThumbnailUrl: typeof body.defaultThumbnailUrl === "string" && body.defaultThumbnailUrl ? body.defaultThumbnailUrl : undefined,
    isActive: body.isActive === undefined ? true : body.isActive === true || body.isActive === "true" || body.isActive === "on"
  };
}
