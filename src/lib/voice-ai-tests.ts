import { z } from "zod";
import { aiCallAgentPolicy, aiCallVoiceOptions } from "@/lib/ai-calls";
import { prisma } from "@/lib/prisma";

export const voiceAiScenarioOptions = [
  "interessiert",
  "keine_zeit",
  "kein_interesse",
  "falscher_ansprechpartner",
  "rueckruf_spaeter",
  "terminwunsch"
] as const;

export const voiceAiTestCallInputSchema = z.object({
  testPhoneNumber: z.string().trim().min(5, "Test-Telefonnummer erforderlich."),
  voice: z.enum(aiCallVoiceOptions).default("neutral"),
  scenario: z.enum(voiceAiScenarioOptions).default("interessiert"),
  prospectId: z.string().trim().min(1).optional().nullable()
});

export type VoiceAiTestCallInput = z.infer<typeof voiceAiTestCallInputSchema>;
export type VoiceAiScenario = (typeof voiceAiScenarioOptions)[number];

export const requiredSuccessfulVoiceAiTestCalls = 5;

export async function createVoiceAiTestCall(input: VoiceAiTestCallInput) {
  const payload = voiceAiTestCallInputSchema.parse(input);
  const prospect = payload.prospectId
    ? await prisma.prospect.findUnique({
        where: { id: payload.prospectId },
        select: { id: true, companyName: true, decisionMakerName: true, decisionMakerRole: true, industry: true, painSummary: true }
      })
    : null;
  const leadName = prospect?.companyName ?? "Demo-Lead";
  const result = scenarioResult(payload.scenario, leadName);

  return prisma.voiceAiTestCall.create({
    data: {
      prospectId: prospect?.id ?? null,
      testPhoneNumber: payload.testPhoneNumber,
      voice: payload.voice,
      scenario: payload.scenario,
      provider: "test",
      status: "completed",
      transcript: buildTranscript(payload.scenario, leadName, payload.voice),
      summary: result.summary,
      detectedObjections: result.detectedObjections,
      conversationQuality: result.conversationQuality,
      appointmentIntent: result.appointmentIntent,
      recommendedImprovement: result.recommendedImprovement
    }
  });
}

export async function getVoiceAiTestModeState() {
  const [successfulCount, recentCalls] = await Promise.all([
    prisma.voiceAiTestCall.count({ where: { status: "completed", conversationQuality: { in: ["gut", "sehr gut"] } } }),
    prisma.voiceAiTestCall.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { prospect: { select: { companyName: true } } }
    })
  ]);
  return {
    successfulCount,
    requiredSuccessfulCount: requiredSuccessfulVoiceAiTestCalls,
    canActivate: successfulCount >= requiredSuccessfulVoiceAiTestCalls,
    recentCalls
  };
}

export function voiceAiTestScript(scenario: VoiceAiScenario) {
  return [
    "Guten Tag, hier ist der KI-Telefonagent von Tasklytic.",
    "Ich wollte nur kurz prüfen, ob das Thema Prozessentlastung bei Ihnen grundsätzlich relevant ist.",
    scenarioPrompt(scenario),
    "Wenn es interessant klingt, schlage ich einen kurzen Termin mit Nikolai vor.",
    aiCallAgentPolicy.disclosure
  ];
}

function scenarioPrompt(scenario: VoiceAiScenario) {
  const prompts: Record<VoiceAiScenario, string> = {
    interessiert: "Bei Interesse frage ich nach Dispo, Backoffice und manueller Abstimmung.",
    keine_zeit: "Bei Zeitdruck halte ich es kurz und frage nach grundsätzlicher Relevanz.",
    kein_interesse: "Bei Ablehnung hake ich sauber ab und frage nur nach dem Grund.",
    falscher_ansprechpartner: "Wenn die Person nicht zuständig ist, frage ich nach der passenden Rolle.",
    rueckruf_spaeter: "Bei Rückrufwunsch frage ich nach vormittags oder nachmittags.",
    terminwunsch: "Bei Terminwunsch eskaliere ich an Nikolai und schlage einen Slot vor."
  };
  return prompts[scenario];
}

function buildTranscript(scenario: VoiceAiScenario, leadName: string, voice: string) {
  return [
    `Voice: ${voice}`,
    `Lead: ${leadName}`,
    "Agent: Guten Tag, hier ist der KI-Telefonagent von Tasklytic.",
    "Agent: Ich wollte nur kurz prüfen, ob das Thema bei Ihnen grundsätzlich relevant ist.",
    `Kontakt: ${scenarioContactLine(scenario)}`,
    `Agent: ${scenarioAgentLine(scenario)}`,
    "Agent: Vielen Dank, ich halte das entsprechend fest."
  ].join("\n");
}

function scenarioContactLine(scenario: VoiceAiScenario) {
  const lines: Record<VoiceAiScenario, string> = {
    interessiert: "Ja, manuelle Abstimmung kostet uns tatsächlich Zeit.",
    keine_zeit: "Ich habe gerade keine Zeit.",
    kein_interesse: "Nein, daran haben wir kein Interesse.",
    falscher_ansprechpartner: "Dafür bin ich nicht zuständig.",
    rueckruf_spaeter: "Rufen Sie bitte später nochmal an.",
    terminwunsch: "Schlagen Sie gern einen Termin vor."
  };
  return lines[scenario];
}

function scenarioAgentLine(scenario: VoiceAiScenario) {
  const lines: Record<VoiceAiScenario, string> = {
    interessiert: "Das klingt nach einem Punkt, den Nikolai persönlich mit Ihnen besprechen sollte.",
    keine_zeit: "Verstehe ich gut. Dann nur kurz: Ist Entlastung in Dispo oder Backoffice grundsätzlich relevant?",
    kein_interesse: "Alles klar, dann hake ich das sauber ab.",
    falscher_ansprechpartner: "Kein Problem. Wer wäre bei Ihnen eher zuständig für Prozesse in Dispo oder Verwaltung?",
    rueckruf_spaeter: "Gerne. Passt es eher vormittags oder nachmittags?",
    terminwunsch: "Dann schlage ich einen kurzen Termin mit Nikolai vor."
  };
  return lines[scenario];
}

function scenarioResult(scenario: VoiceAiScenario, leadName: string) {
  const results: Record<VoiceAiScenario, { summary: string; detectedObjections: string[]; conversationQuality: string; appointmentIntent: string; recommendedImprovement: string }> = {
    interessiert: {
      summary: `${leadName} zeigt Relevanz für manuelle Abstimmung. Menschliches Follow-up sinnvoll.`,
      detectedObjections: [],
      conversationQuality: "sehr gut",
      appointmentIntent: "mittel",
      recommendedImprovement: "Bei echten Calls schneller nach einem konkreten Prozess fragen."
    },
    keine_zeit: {
      summary: "Zeitdruck erkannt, Gespräch wurde verkürzt.",
      detectedObjections: ["Keine Zeit"],
      conversationQuality: "gut",
      appointmentIntent: "unklar",
      recommendedImprovement: "Noch früher entlasten und nur eine Relevanzfrage stellen."
    },
    kein_interesse: {
      summary: "Ablehnung erkannt und sauber abgemeldet.",
      detectedObjections: ["Kein Interesse"],
      conversationQuality: "gut",
      appointmentIntent: "nein",
      recommendedImprovement: "Keinen zweiten Nutzenblock nach Ablehnung nennen."
    },
    falscher_ansprechpartner: {
      summary: "Falscher Ansprechpartner erkannt, richtige Zuständigkeit angefragt.",
      detectedObjections: ["Ich bin nicht zuständig"],
      conversationQuality: "gut",
      appointmentIntent: "unklar",
      recommendedImprovement: "Rolle statt Person erfragen, wenn kein Name genannt wird."
    },
    rueckruf_spaeter: {
      summary: "Rückrufwunsch erkannt und Zeitfenster abgefragt.",
      detectedObjections: ["Rufen Sie später an"],
      conversationQuality: "gut",
      appointmentIntent: "niedrig",
      recommendedImprovement: "Konkretes Zeitfenster wiederholen lassen."
    },
    terminwunsch: {
      summary: "Terminabsicht erkannt, Eskalation an Nikolai passend.",
      detectedObjections: [],
      conversationQuality: "sehr gut",
      appointmentIntent: "hoch",
      recommendedImprovement: "Slot-Vorschlag direkt nach Zustimmung nennen."
    }
  };
  return results[scenario];
}
