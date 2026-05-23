import { LeadWorkflowPanel, type WorkflowStep } from "@/components/admin/lead-workflow-panel";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { PageHeader } from "@/components/admin/ui";
import { getLatestEnrichmentJobProgress } from "@/lib/enrichment-jobs";
import { buildWorkflowLeadPreviews, summarizeWorkflowBatch } from "@/lib/lead-workflow";
import { prisma } from "@/lib/prisma";
import { getSafeSmtpSettings } from "@/lib/smtp-settings";
import { getWorkflowErrorDetails, logWorkflowServerError } from "@/lib/workflow-errors";

export const dynamic = "force-dynamic";

export default async function LeadToOutreachWorkflowPage() {
  console.info("WORKFLOW_PAGE_LOAD_START", {
    route: "/admin/workflows/lead-to-outreach"
  });

  try {
    const loadErrors: Array<{ source: string; message: string; stack?: string }> = [];
    const [batchesResult, smtpResult, signatureResult] = await Promise.allSettled([
      prisma.leadImportBatch.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          rows: {
            include: {
              prospect: {
                include: { emailSendLogs: true }
              }
            }
          }
        }
      }),
      getSafeSmtpSettings(),
      prisma.emailSignature.findFirst({ where: { isDefault: true } })
    ]);

    if (batchesResult.status === "rejected") {
      const details = getWorkflowErrorDetails(batchesResult.reason);
      loadErrors.push({ source: "leadImportBatch.findMany", message: details.message, stack: details.stack });
      console.error("WORKFLOW_PAGE_LOAD_FAILED", { route: "/admin/workflows/lead-to-outreach", source: "leadImportBatch.findMany", details });
      logWorkflowServerError("/admin/workflows/lead-to-outreach:batches", batchesResult.reason);
    }

    if (smtpResult.status === "rejected") {
      const details = getWorkflowErrorDetails(smtpResult.reason);
      loadErrors.push({ source: "getSafeSmtpSettings", message: details.message, stack: details.stack });
      console.error("WORKFLOW_PAGE_LOAD_FAILED", { route: "/admin/workflows/lead-to-outreach", source: "getSafeSmtpSettings", details });
      logWorkflowServerError("/admin/workflows/lead-to-outreach:smtp", smtpResult.reason);
    }

    if (signatureResult.status === "rejected") {
      const details = getWorkflowErrorDetails(signatureResult.reason);
      loadErrors.push({ source: "emailSignature.findFirst", message: details.message, stack: details.stack });
      console.error("WORKFLOW_PAGE_LOAD_FAILED", { route: "/admin/workflows/lead-to-outreach", source: "emailSignature.findFirst", details });
      logWorkflowServerError("/admin/workflows/lead-to-outreach:signature", signatureResult.reason);
    }

    const batchesData = batchesResult.status === "fulfilled" ? batchesResult.value : [];
    const smtp = smtpResult.status === "fulfilled" ? smtpResult.value : { configured: false, missingFields: ["Workflow konnte SMTP-Einstellungen nicht laden"] };
    const signature = signatureResult.status === "fulfilled" ? signatureResult.value : null;

    const batches = batchesData ?? [];
    const latest = batches[0] ?? null;
    const latestRows = latest?.rows ?? [];

    const [summaryResult, previewsResult, enrichmentJobResult] = latest
      ? await Promise.allSettled([
        summarizeWorkflowBatch(latest.id, { blockInfoEmails: true, minFitScore: 60 }),
        buildWorkflowLeadPreviews(latest.id, { blockInfoEmails: true, minFitScore: 60 }),
        getLatestEnrichmentJobProgress(latest.id)
      ])
      : [null, null, null] as const;

    if (summaryResult && summaryResult.status === "rejected") {
      const details = getWorkflowErrorDetails(summaryResult.reason);
      loadErrors.push({ source: "summarizeWorkflowBatch", message: details.message, stack: details.stack });
      console.error("WORKFLOW_PAGE_LOAD_FAILED", { route: "/admin/workflows/lead-to-outreach", source: "summarizeWorkflowBatch", details });
      logWorkflowServerError("/admin/workflows/lead-to-outreach:summary", summaryResult.reason);
    }

    if (previewsResult && previewsResult.status === "rejected") {
      const details = getWorkflowErrorDetails(previewsResult.reason);
      loadErrors.push({ source: "buildWorkflowLeadPreviews", message: details.message, stack: details.stack });
      console.error("WORKFLOW_PAGE_LOAD_FAILED", { route: "/admin/workflows/lead-to-outreach", source: "buildWorkflowLeadPreviews", details });
      logWorkflowServerError("/admin/workflows/lead-to-outreach:previews", previewsResult.reason);
    }

    if (enrichmentJobResult && enrichmentJobResult.status === "rejected") {
      const details = getWorkflowErrorDetails(enrichmentJobResult.reason);
      loadErrors.push({ source: "getLatestEnrichmentJobProgress", message: details.message, stack: details.stack });
      console.error("WORKFLOW_PAGE_LOAD_FAILED", { route: "/admin/workflows/lead-to-outreach", source: "getLatestEnrichmentJobProgress", details });
      logWorkflowServerError("/admin/workflows/lead-to-outreach:enrichment-job", enrichmentJobResult.reason);
    }

    const workflowSummary = summaryResult && summaryResult.status === "fulfilled" ? summaryResult.value : null;
    const leadPreviews = previewsResult && previewsResult.status === "fulfilled" ? previewsResult.value : [];
    const latestEnrichmentJob = enrichmentJobResult && enrichmentJobResult.status === "fulfilled" ? enrichmentJobResult.value : null;
    const imported = latest ? (latest.createdCount ?? 0) + (latest.updatedCount ?? 0) : 0;
    const enriched = latestRows.filter((row) => row.status === "enriched").length;
    const invalid = latestRows.filter((row) => row.status === "invalid" || row.status === "failed").length;
    const landingpages = latestRows.filter((row) => Boolean(row.prospect?.landingpageUrl)).length;
    const emails = latestRows.filter((row) => hasGeneratedEmails(row.mappedJson)).length;
    const sent = latestRows.reduce((sum, row) => sum + (row.prospect?.emailSendLogs?.length ?? 0), 0);
    const prepared = latestRows.filter((row) => row.prospect?.landingpageReviewStatus === "approved" && Boolean(row.prospect?.landingpageUrl) && hasGeneratedEmails(row.mappedJson)).length;
    const landingpagePreviews = latestRows
      .filter((row) => row.prospect?.slug)
      .map((row) => ({
        prospectId: row.prospect?.id ?? "",
        companyName: row.prospect?.companyName ?? "Unbenannter Lead",
        slug: row.prospect?.slug ?? null,
        reviewStatus: row.prospect?.landingpageReviewStatus ?? "draft",
        blocking: row.prospect?.landingpageReviewStatus !== "approved"
      }))
      .filter((item) => item.prospectId);

    const steps = buildWorkflowSteps({
      latest,
      imported,
      enriched,
      invalid,
      landingpages,
      emails,
      prepared,
      sent,
      smtp,
      hasSignature: Boolean(signature)
    });

    return renderWorkflowPage({
      batchId: latest?.id,
      landingpages: landingpagePreviews,
      loadErrors,
      latestEnrichmentJob,
      previews: leadPreviews,
      summary: workflowSummary,
      steps
    });
  } catch (error) {
    const details = getWorkflowErrorDetails(error);
    console.error("WORKFLOW_PAGE_LOAD_FAILED", {
      route: "/admin/workflows/lead-to-outreach",
      source: "page",
      details
    });
    logWorkflowServerError("/admin/workflows/lead-to-outreach", error);
    return renderWorkflowPage({
      loadErrors: [{ source: "page", message: details.message, stack: details.stack }],
      steps: buildWorkflowSteps()
    });
  }
}

type BuildWorkflowStepsInput = {
  latest?: { id: string; createdCount?: number | null; updatedCount?: number | null } | null;
  imported?: number;
  enriched?: number;
  invalid?: number;
  landingpages?: number;
  emails?: number;
  prepared?: number;
  sent?: number;
  smtp?: { configured: boolean; missingFields?: string[] };
  hasSignature?: boolean;
};

export function buildWorkflowSteps(input: BuildWorkflowStepsInput = {}): WorkflowStep[] {
  const latest = input.latest ?? null;
  const imported = input.imported ?? 0;
  const enriched = input.enriched ?? 0;
  const invalid = input.invalid ?? 0;
  const landingpages = input.landingpages ?? 0;
  const emails = input.emails ?? 0;
  const prepared = input.prepared ?? 0;
  const sent = input.sent ?? 0;
  const smtp = input.smtp ?? { configured: false, missingFields: [] };
  const hasSignature = input.hasSignature ?? false;
  const missingFields = smtp.missingFields ?? [];

  return [
    { action: "import", title: "Import abgeschlossen", description: latest ? `${latest.createdCount ?? 0} neu, ${latest.updatedCount ?? 0} aktualisiert` : "Noch kein Import-Batch vorhanden.", status: latest ? "erledigt" : "offen", count: imported },
    { action: "enrich", title: "Daten anreichern", description: "Startet einen Hintergrundjob und zeigt den Fortschritt live.", status: enriched > 0 ? "erledigt" : "offen", count: enriched, endpoint: latest ? "/api/workflows/enrichment/start" : undefined },
    { action: "invalid", title: "Ungültige aussortieren", description: "Passiert durch Statusprüfung während der Anreicherung.", status: invalid > 0 ? "erledigt" : "offen", count: invalid },
    { action: "landingpages", title: "Landingpage-Vorschauen generieren", description: "Erstellt Entwürfe mit Slug. Vor Versand bitte mobil und desktop prüfen und freigeben.", status: landingpages > 0 ? "erledigt" : "offen", count: landingpages, endpoint: latest ? `/api/lead-import/batches/${latest.id}/landingpages` : undefined },
    { action: "emails", title: "E-Mails generieren", description: "Erstellt Entwürfe mit Signaturvorbereitung, versendet aber nichts.", status: emails > 0 ? "erledigt" : "offen", count: emails, endpoint: latest ? `/api/lead-import/batches/${latest.id}/generate-emails` : undefined },
    { action: "prepare", title: "Versand vorbereiten", description: smtp.configured && hasSignature ? "SMTP und Signatur bereit." : `Prüfen: ${smtp.configured ? "" : `SMTP fehlt ${missingFields.join(", ")}`} ${hasSignature ? "" : "Signatur fehlt"}`.trim(), status: prepared > 0 && smtp.configured && hasSignature ? "erledigt" : "offen", count: prepared },
    { action: "send", title: "Versand starten", description: "Startet nur in /admin/campaigns über Fällige Mails senden, Kampagnenfreigabe und Zeitregeln.", status: sent > 0 ? "erledigt" : "offen", count: sent }
  ];
}

function renderWorkflowPage({
  batchId,
  landingpages = [],
  loadErrors = [],
  latestEnrichmentJob = null,
  previews = [],
  summary = null,
  steps = []
}: {
  batchId?: string;
  landingpages?: Parameters<typeof LeadWorkflowPanel>[0]["landingpages"];
  loadErrors?: Parameters<typeof LeadWorkflowPanel>[0]["loadErrors"];
  latestEnrichmentJob?: Parameters<typeof LeadWorkflowPanel>[0]["latestEnrichmentJob"];
  previews?: Parameters<typeof LeadWorkflowPanel>[0]["previews"];
  summary?: Parameters<typeof LeadWorkflowPanel>[0]["summary"];
  steps?: WorkflowStep[];
}) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <PageHeader title="Lead-to-Outreach Workflow" description="Kontrollierter Prozess von CSV/XLSX Import bis SMTP-Versand. Große Schritte werden manuell ausgelöst." backButton={<AdminBackButton href="/admin/dashboard" />} />
      <LeadWorkflowPanel batchId={batchId} landingpages={landingpages ?? []} latestEnrichmentJob={latestEnrichmentJob ?? null} loadErrors={loadErrors ?? []} previews={previews ?? []} summary={summary ?? null} steps={steps ?? []} />
    </div>
  );
}

function hasGeneratedEmails(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as { generatedEmails?: unknown }).generatedEmails));
}
