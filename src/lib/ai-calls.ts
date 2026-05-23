import type { AiCallStatus, Prisma } from "@prisma/client";
import { readCallingSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

export const aiCallStatuses = [
  "call_eligible",
  "call_planned",
  "call_called",
  "call_interested",
  "call_not_interested",
  "call_callback_requested",
  "call_failed"
] as const satisfies AiCallStatus[];

export const aiCallVoiceOptions = ["neutral", "männlich", "weiblich"] as const;

export type AiCallVoice = (typeof aiCallVoiceOptions)[number];
export type AiCallPriority = "none" | "normal" | "high";

export type AiCallProspectInput = {
  id: string;
  icpScore: number;
  icpFitScore: number;
  fitScore: number;
  leadStatus: string;
  status: string;
  phone: string | null;
  companyPhone: string | null;
  decisionMakerPhone: string | null;
  campaignEnrollments?: Array<{ repliedAt: Date | string | null; notInterestedAt: Date | string | null }>;
  emailSendLogs?: Array<{
    status: string;
    sentAt: Date | string | null;
    repliedAt: Date | string | null;
    step?: { stepNumber: number; position?: number | null } | null;
  }>;
  inboundEmails?: Array<{ id: string }>;
  events?: Array<{ type: string; createdAt: Date | string }>;
  aiCalls?: Array<{ id: string; status: string; plannedFor: Date | string | null }>;
};

export type AiCallReadiness = {
  status: AiCallStatus | "not_eligible";
  eligible: boolean;
  recommended: boolean;
  priority: AiCallPriority;
  priorityScore: number;
  phone: string | null;
  plannedFor: Date | null;
  preferredWindowStart: Date | null;
  preferredWindowEnd: Date | null;
  reasons: string[];
  blockers: string[];
};

const disqualifyingLeadStatuses = new Set(["not_interested", "responded", "meeting", "customer", "do_not_contact", "nicht_mehr_kontaktieren"]);
const engagementEventTypes = new Set(["page_view", "video_started", "video_watched", "cta_clicked", "booking_opened"]);

export const aiCallAgentPolicy = {
  disclosure: "Der Agent darf nie behaupten, ein Mensch zu sein. KI-Anrufe starten nur nach Nutzerfreigabe.",
  voice: {
    language: "de-DE",
    style: "natürlich, ruhig, kurze Sätze, hörbare Pausen, kein aggressiver Verkaufston",
    options: aiCallVoiceOptions
  },
  conversationRules: [
    "Nicht unterbrechen; wenn der Mensch spricht, schweigen.",
    "Maximal 2-3 Sätze am Stück.",
    "Pausen von 300-800 ms.",
    "Bei Unsicherheit fragen statt erklären.",
    "Bei genervter oder ablehnender Reaktion Gespräch verkürzen.",
    "Bei Stille nachfragen, bei längerer Stille freundlich beenden."
  ],
  qualificationTopics: [
    "manuelle Abstimmung zwischen Dispo, E-Mail, Telefon, WhatsApp oder Excel",
    "Rückfragen zu Auftragsstatus",
    "doppelte Dateneingaben",
    "manuelle Angebots- oder Rechnungsprozesse",
    "Zeitverlust im Backoffice",
    "Interesse an Prozessautomatisierung"
  ],
  objectionFramework: [
    "Einwand erkennen",
    "bestätigen und entlasten",
    "kurze Relevanz herstellen",
    "keinen Druck machen",
    "kleine Abschlussfrage stellen"
  ],
  boundaries: [
    "Opt-out respektieren.",
    "Keine privaten Nummern anrufen.",
    "Keine sensiblen Daten abfragen.",
    "Keine Rabatte, Rechtsberatung oder verbindlichen technischen Zusagen."
  ]
} as const;

export function evaluateAiCallReadiness(prospect: AiCallProspectInput, now = new Date()): AiCallReadiness {
  const activePlan = prospect.aiCalls?.find((call) => call.status === "call_planned");
  const phone = callablePhone(prospect);
  const score = Math.max(prospect.icpFitScore ?? 0, prospect.icpScore ?? 0, prospect.fitScore ?? 0);
  const firstMailSentAt = firstLandingpageMailSentAt(prospect.emailSendLogs ?? []);
  const latestEngagementAt = latestEngagement(prospect.events ?? []);
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (score < 60) blockers.push("ICP Score unter 60.");
  else reasons.push(`ICP Score ${score}.`);

  if (!phone) blockers.push("Keine geschäftliche Telefonnummer vorhanden.");
  else reasons.push("Telefonnummer vorhanden.");

  if (!firstMailSentAt) blockers.push("Landingpage-Mail wurde noch nicht versendet.");
  else reasons.push("Landingpage-Mail wurde versendet.");

  if (hasOptOutOrNoInterest(prospect)) blockers.push("Opt-out, kein Interesse oder abgeschlossener Lead.");
  if (hasReply(prospect)) blockers.push("Lead hat bereits geantwortet.");

  const earliestAfterMail = firstMailSentAt ? addHours(firstMailSentAt, 24) : null;
  const preferredWindowStart = latestEngagementAt ? addHours(latestEngagementAt, 24) : null;
  const preferredWindowEnd = latestEngagementAt ? addHours(latestEngagementAt, 48) : null;
  const plannedFor = activePlan?.plannedFor ? new Date(activePlan.plannedFor) : suggestedPlannedFor(now, earliestAfterMail, preferredWindowStart);
  const timeReady = earliestAfterMail ? now.getTime() >= earliestAfterMail.getTime() : false;
  const engaged = Boolean(latestEngagementAt);
  const priorityScore = (score >= 80 ? 30 : 15) + (engaged ? 40 : 0) + (hasVideoEngagement(prospect.events ?? []) ? 20 : 0);
  const priority: AiCallPriority = blockers.length ? "none" : priorityScore >= 60 ? "high" : "normal";

  if (engaged) reasons.push("Landingpage besucht oder Video-Interaktion erkannt.");
  if (timeReady) reasons.push("Mindestens 24 Stunden seit Versand vergangen.");

  if (activePlan) {
    return {
      status: "call_planned",
      eligible: true,
      recommended: true,
      priority,
      priorityScore,
      phone,
      plannedFor,
      preferredWindowStart,
      preferredWindowEnd,
      reasons,
      blockers: []
    };
  }

  const eligible = blockers.length === 0 && timeReady;
  return {
    status: eligible ? "call_eligible" : "not_eligible",
    eligible,
    recommended: blockers.length === 0,
    priority,
    priorityScore,
    phone,
    plannedFor,
    preferredWindowStart,
    preferredWindowEnd,
    reasons,
    blockers: timeReady || !earliestAfterMail ? blockers : [...blockers, "Call ist frühestens 24 Stunden nach Versand erlaubt."]
  };
}

export async function planAiCall(prospectId: string, options: { voice?: AiCallVoice; approvedBy?: string; now?: Date } = {}) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: aiCallReadinessInclude
  });
  if (!prospect) throw new Error("Prospect nicht gefunden.");

  const settings = await readCallingSettings();
  if (!settings.voiceAiEnabled) {
    throw new Error("Voice-KI ist noch nicht für Leads aktiviert. Mindestens 5 erfolgreiche Testcalls erforderlich.");
  }

  const readiness = evaluateAiCallReadiness(prospect, options.now ?? new Date());
  if (!readiness.recommended || !readiness.phone || readiness.blockers.length > 0) {
    throw new Error(readiness.blockers[0] ?? "KI-Anruf ist nicht empfohlen.");
  }

  const existing = prospect.aiCalls.find((call) => call.status === "call_planned");
  if (existing) return existing;

  return prisma.aiCall.create({
    data: {
      prospectId,
      status: "call_planned",
      plannedFor: readiness.plannedFor,
      approvedAt: options.now ?? new Date(),
      approvedBy: options.approvedBy,
      voice: options.voice ?? "neutral",
      priority: readiness.priorityScore,
      phone: readiness.phone,
      eligibilitySnapshot: readiness as unknown as Prisma.InputJsonValue
    }
  });
}

export async function markDoNotCall(prospectId: string) {
  await prisma.aiCall.updateMany({
    where: { prospectId, status: "call_planned" },
    data: { status: "call_not_interested", completedAt: new Date(), nextStep: "Nicht anrufen" }
  });
  return prisma.prospect.update({
    where: { id: prospectId },
    data: { leadStatus: "not_interested", followUpStatus: "dismissed", followUpReason: "KI-Anruf ausgeschlossen" }
  });
}

export const aiCallReadinessInclude = {
  campaignEnrollments: { select: { repliedAt: true, notInterestedAt: true } },
  emailSendLogs: {
    where: { status: "sent" },
    select: { status: true, sentAt: true, repliedAt: true, step: { select: { stepNumber: true, position: true } } },
    orderBy: { sentAt: "asc" }
  },
  inboundEmails: { select: { id: true }, take: 1 },
  events: {
    where: { type: { in: ["page_view", "video_started", "video_watched", "cta_clicked", "booking_opened"] } },
    select: { type: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10
  },
  aiCalls: {
    select: { id: true, status: true, plannedFor: true },
    orderBy: { createdAt: "desc" },
    take: 5
  }
} satisfies Prisma.ProspectInclude;

function callablePhone(prospect: Pick<AiCallProspectInput, "companyPhone" | "decisionMakerPhone" | "phone">) {
  return prospect.companyPhone || prospect.decisionMakerPhone || prospect.phone || null;
}

function firstLandingpageMailSentAt(logs: NonNullable<AiCallProspectInput["emailSendLogs"]>) {
  const firstStepLog = logs.find((log) => log.sentAt && (log.step?.stepNumber === 1 || log.step?.position === 1));
  const firstSentLog = firstStepLog ?? logs.find((log) => log.sentAt);
  return firstSentLog?.sentAt ? new Date(firstSentLog.sentAt) : null;
}

function latestEngagement(events: NonNullable<AiCallProspectInput["events"]>) {
  const latest = events.find((event) => engagementEventTypes.has(event.type));
  return latest ? new Date(latest.createdAt) : null;
}

function hasVideoEngagement(events: NonNullable<AiCallProspectInput["events"]>) {
  return events.some((event) => event.type === "video_started" || event.type === "video_watched");
}

function hasOptOutOrNoInterest(prospect: AiCallProspectInput) {
  return disqualifyingLeadStatuses.has(prospect.leadStatus)
    || prospect.status === "disqualified"
    || Boolean(prospect.campaignEnrollments?.some((enrollment) => enrollment.notInterestedAt));
}

function hasReply(prospect: AiCallProspectInput) {
  return prospect.leadStatus === "responded"
    || Boolean(prospect.inboundEmails?.length)
    || Boolean(prospect.campaignEnrollments?.some((enrollment) => enrollment.repliedAt))
    || Boolean(prospect.emailSendLogs?.some((log) => log.repliedAt));
}

function suggestedPlannedFor(now: Date, earliestAfterMail: Date | null, preferredWindowStart: Date | null) {
  const floor = maxDate([now, earliestAfterMail, preferredWindowStart]);
  return floor;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function maxDate(values: Array<Date | null>) {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) return latest;
    if (!latest || value.getTime() > latest.getTime()) return value;
    return latest;
  }, null);
}
