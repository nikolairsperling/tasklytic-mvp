import { NextResponse, type NextRequest } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import { getClickUpSyncAnalytics, getSafeIntegrationSettings } from "@/lib/integrations";
import { readAppSettings } from "@/lib/app-settings";
import { logSystemError } from "@/lib/error-diagnostics";
import { prisma } from "@/lib/prisma";
import { getRequestIdFromHeaders } from "@/lib/request-id";

type SmokeStatus = "ok" | "warning" | "error";

type SmokeResult = {
  name: string;
  area: string;
  action: string;
  status: SmokeStatus;
  durationMs: number;
  message: string;
  requestId?: string;
};

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const tests: Array<{ name: string; area: string; action: string; run: () => Promise<string | void> }> = [
    { name: "Dashboard laden", area: "dashboard", action: "load-dashboard", run: async () => { await prisma.prospect.count(); await prisma.campaign.count(); } },
    { name: "Prospects laden", area: "prospects", action: "load-prospects", run: async () => { await prisma.prospect.findMany({ take: 5, orderBy: { createdAt: "desc" } }); } },
    { name: "Lead öffnen", area: "lead", action: "open-lead", run: async () => { const lead = await prisma.prospect.findFirst({ select: { id: true } }); if (!lead) return "Warnung: Kein Lead zum Öffnen vorhanden."; } },
    { name: "Datenanreicherung", area: "enrichment", action: "enrichment-readiness", run: async () => { const settings = await getSafeIntegrationSettings(); if (!settings.openai.keySet) return "Warnung: OpenAI API Key fehlt."; } },
    { name: "Retry einzelner Leads", area: "enrichment", action: "retry-lead-readiness", run: async () => { await prisma.prospect.count({ where: { researchStatus: "failed" } }); } },
    { name: "Landingpage erstellen", area: "landingpage", action: "create-landingpage-readiness", run: async () => { const templates = await prisma.landingpageTemplate.count(); if (templates === 0) return "Warnung: Keine Landingpage-Templates vorhanden."; } },
    { name: "Landingpage öffnen", area: "landingpage", action: "open-landingpage", run: async () => { const page = await prisma.prospect.findFirst({ where: { slug: { not: null } }, select: { slug: true } }); if (!page) return "Warnung: Kein Lead mit Landingpage-Slug vorhanden."; } },
    { name: "Kampagne erstellen", area: "campaign", action: "create-campaign-readiness", run: async () => { await prisma.offer.count(); } },
    { name: "Kampagne bearbeiten", area: "campaign", action: "edit-campaign", run: async () => { const campaign = await prisma.campaign.findFirst({ select: { id: true } }); if (!campaign) return "Warnung: Keine Kampagne vorhanden."; } },
    { name: "Leads zur Kampagne hinzufügen", area: "campaign", action: "add-leads-to-campaign", run: async () => { const [campaigns, leads] = await Promise.all([prisma.campaign.count(), prisma.prospect.count()]); if (!campaigns || !leads) return "Warnung: Kampagne oder Lead fehlt."; } },
    { name: "E-Mail Vorlage erstellen", area: "email-template", action: "email-template-readiness", run: async () => { await prisma.emailTemplate.count(); } },
    { name: "KI generieren", area: "ai", action: "ai-readiness", run: async () => { const settings = await getSafeIntegrationSettings(); if (!settings.openai.keySet) return "Warnung: OpenAI API Key fehlt."; } },
    { name: "Inbox synchronisieren", area: "inbox", action: "inbox-readiness", run: async () => { await prisma.inboundEmail.count(); } },
    { name: "SMTP/IMAP prüfen", area: "smtp-imap", action: "mail-settings-readiness", run: async () => { await prisma.smtpSettings.findFirst(); await prisma.mailboxSettings.findFirst(); } },
    { name: "Assets speichern", area: "assets", action: "assets-readiness", run: async () => { await prisma.assetFile.count(); await prisma.imageAsset.count(); await prisma.videoAsset.count(); } },
    { name: "ClickUp Sync", area: "clickup", action: "clickup-readiness", run: async () => { const settings = await getSafeIntegrationSettings(); await getClickUpSyncAnalytics(); if (!settings.clickup.tokenSet) return "Warnung: ClickUp Token fehlt."; } },
    { name: "Impact Studio", area: "impact", action: "impact-readiness", run: async () => { await prisma.videoTemplate.count(); await prisma.videoGenerationJob.count(); } },
    { name: "Theme Umschalten", area: "theme", action: "theme-settings", run: async () => { await readAppSettings(); } },
    { name: "Update prüfen", area: "update", action: "service-worker-assets", run: async () => { if (!existsSync(join(process.cwd(), "public", "sw.js"))) return "Warnung: Service Worker fehlt."; } },
    { name: "_next/static Assets", area: "static-assets", action: "next-static-assets", run: async () => { if (!existsSync(join(process.cwd(), ".next", "static"))) return "Warnung: .next/static ist noch nicht gebaut."; } }
  ];

  const results = await Promise.all(tests.map((test) => runSmokeTest(test)));
  const summary = {
    ok: results.filter((entry) => entry.status === "ok").length,
    warning: results.filter((entry) => entry.status === "warning").length,
    error: results.filter((entry) => entry.status === "error").length
  };
  const response = NextResponse.json({ requestId, summary, items: results });
  response.headers.set("x-request-id", requestId);
  return response;
}

async function runSmokeTest(test: { name: string; area: string; action: string; run: () => Promise<string | void> }): Promise<SmokeResult> {
  const startedAt = Date.now();
  try {
    const message = await test.run();
    return {
      name: test.name,
      area: test.area,
      action: test.action,
      status: message?.startsWith("Warnung") ? "warning" : "ok",
      durationMs: Date.now() - startedAt,
      message: message ?? "OK"
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const logged = await logSystemError({
      area: test.area,
      action: test.action,
      errorCode: "SMOKE_TEST_FAILED",
      userMessage: "Systemtest fehlgeschlagen.",
      technicalDetail: error instanceof Error ? error.stack ?? error.message : String(error),
      durationMs,
      source: "smoke-test"
    });
    return {
      name: test.name,
      area: test.area,
      action: test.action,
      status: "error",
      durationMs,
      message: `${logged.userMessage} Fehler-ID: ${logged.requestId}`,
      requestId: logged.requestId
    };
  }
}
