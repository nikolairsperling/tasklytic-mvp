import { z } from "zod";
import { getDashboardMetrics } from "@/lib/dashboard";
import { getEffectiveOpenAiApiKey } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Nachricht darf nicht leer sein.").max(4000)
});

export const copilotRequestSchema = z.object({
  messages: z.array(messageSchema).min(1, "Mindestens eine Nachricht erforderlich.").max(20)
});

export type CopilotMessage = z.infer<typeof messageSchema>;

export const copilotSystemPrompt =
  "Du bist der Tasklytic Copilot, ein KI-Assistent im Admin-Bereich eines Lead- und Outreach-Tools. " +
  "Du hilfst dem Nutzer, seine Leads, Kampagnen und Kennzahlen zu verstehen und die naechsten sinnvollen Schritte zu finden. " +
  "Antworte auf Deutsch, kurz, konkret und ohne Floskeln. Nutze ausschliesslich die Daten aus dem Datenkontext. " +
  "Wenn eine Information nicht im Kontext steht, sage ehrlich, dass dir die Daten dazu fehlen, und nenne, wo der Nutzer sie im Tool findet. " +
  "Erfinde keine Zahlen, Firmen oder Fakten.";

export type CopilotTopProspect = {
  companyName: string;
  city: string;
  industry: string | null;
  score: number;
  leadStatus: string;
  engagementLevel: string;
};

export type CopilotContext = {
  metrics: Awaited<ReturnType<typeof getDashboardMetrics>>;
  topProspects: CopilotTopProspect[];
};

export async function gatherCopilotContext(): Promise<CopilotContext> {
  const [metrics, prospects] = await Promise.all([
    getDashboardMetrics(),
    prisma.prospect.findMany({
      orderBy: [{ icpFitScore: "desc" }, { fitScore: "desc" }, { icpScore: "desc" }],
      take: 10,
      select: {
        companyName: true,
        city: true,
        industry: true,
        icpFitScore: true,
        fitScore: true,
        icpScore: true,
        leadStatus: true,
        engagementLevel: true
      }
    })
  ]);

  return {
    metrics,
    topProspects: prospects.map((prospect) => ({
      companyName: prospect.companyName,
      city: prospect.city,
      industry: prospect.industry,
      score: Math.max(prospect.icpFitScore, prospect.fitScore, prospect.icpScore),
      leadStatus: prospect.leadStatus,
      engagementLevel: prospect.engagementLevel
    }))
  };
}

export function formatCopilotContext(context: CopilotContext): string {
  const m = context.metrics;
  const lines = [
    "AKTUELLE KENNZAHLEN:",
    `- Prospects gesamt: ${m.prospects}`,
    `- Kampagnenbereit (E-Mail + Landingpage): ${m.campaignReady}`,
    `- Aktive Kampagnen: ${m.activeCampaigns}, geplante Kampagnen: ${m.plannedCampaigns}`,
    `- Versendete Mails: ${m.sent}, Oeffnungen: ${m.opens}, Klicks: ${m.clicks}`,
    `- Antworten: ${m.replies}, Termine gebucht: ${m.booked}, kein Interesse: ${m.notInterested}`,
    `- Pipeline-Wert: ${m.pipelineValue} EUR`,
    `- ROI: ${m.roi === null ? "nicht berechenbar" : `${Math.round(m.roi)}%`}`,
    `- Importierte Leads: ${m.importedLeads}, angereichert: ${m.enrichedLeads}`,
    `- Valide Firmen: ${m.validLeads}, ungueltig oder unerreichbar: ${m.invalidCompanies}`,
    "",
    "TOP LEADS (nach ICP- bzw. Fit-Score):"
  ];

  if (context.topProspects.length === 0) {
    lines.push("- Noch keine Leads vorhanden.");
  } else {
    for (const prospect of context.topProspects) {
      const industry = prospect.industry ? `, ${prospect.industry}` : "";
      lines.push(
        `- ${prospect.companyName} (${prospect.city}${industry}) - Score ${prospect.score}, Status ${prospect.leadStatus}, Engagement ${prospect.engagementLevel}`
      );
    }
  }

  return lines.join("\n");
}

export function buildCopilotMessages(contextText: string, messages: CopilotMessage[]) {
  return [
    { role: "developer" as const, content: `${copilotSystemPrompt}\n\nDATENKONTEXT:\n${contextText}` },
    ...messages.map((message) => ({ role: message.role, content: message.content }))
  ];
}

export async function requestCopilotCompletion(
  input: { apiKey: string; messages: CopilotMessage[]; context: CopilotContext },
  fetcher: typeof fetch = fetch
): Promise<string> {
  const { messages } = copilotRequestSchema.parse({ messages: input.messages });
  const contextText = formatCopilotContext(input.context);

  const response = await fetcher("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: buildCopilotMessages(contextText, messages)
    })
  });

  if (!response.ok) throw new Error("Copilot-Antwort konnte nicht erzeugt werden.");

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("Copilot-Antwort war leer.");
  return reply;
}

export async function runCopilot(
  input: { messages: CopilotMessage[]; context?: CopilotContext },
  fetcher: typeof fetch = fetch
): Promise<string> {
  const apiKey = await getEffectiveOpenAiApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY fehlt.");

  const context = input.context ?? (await gatherCopilotContext());
  return requestCopilotCompletion({ apiKey, messages: input.messages, context }, fetcher);
}
