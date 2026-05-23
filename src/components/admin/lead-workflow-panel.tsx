"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowLeadPreview, WorkflowQualificationSummary } from "@/lib/lead-workflow";

type WorkflowAction = "import" | "enrich" | "invalid" | "landingpages" | "emails" | "prepare" | "send";
type StepStatus = "offen" | "läuft" | "erledigt" | "Fehler";

export type WorkflowStep = {
  action: WorkflowAction;
  title: string;
  description: string;
  status: StepStatus;
  count: number;
  endpoint?: string;
};

export type WorkflowLandingpage = {
  prospectId: string;
  companyName: string;
  slug: string | null;
  reviewStatus: string;
  blocking: boolean;
};

export type ActionResult = {
  jobId?: string;
  status?: string;
  total?: number;
  valid?: number;
  withWebsite?: number;
  withCompanyName?: number;
  withEmail?: number;
  sendable?: number;
  blocked?: number;
  breakdown?: string;
  processed?: number;
  enriched?: number;
  invalid?: number;
  generated?: number;
  landingpagesGenerated?: number;
  emailsGenerated?: number;
  prepared?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  error?: string;
  successful?: number;
  details?: Array<{
    leadImportRowId?: string;
    prospectId?: string;
    companyName?: string;
    status: "queued" | "running" | "success" | "invalid" | "failed" | "skipped";
    error?: string;
    source?: string;
  }>;
  currentLeadName?: string | null;
  errors?: Array<{
    leadImportRowId?: string;
    prospectId?: string | null;
    companyName?: string | null;
    error: string;
    source?: string;
  }>;
};

export type EnrichmentJobProgress = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed" | "partial";
  total: number;
  processed: number;
  successful: number;
  invalid: number;
  failed: number;
  skipped: number;
  currentLeadName: string | null;
  errors: Array<{ leadImportRowId?: string; prospectId?: string | null; companyName?: string | null; error: string; source?: string }>;
  items?: Array<{
    id: string;
    leadImportRowId: string;
    prospectId: string | null;
    companyName: string | null;
    status: "queued" | "running" | "success" | "invalid" | "failed" | "skipped";
    error: string | null;
    source?: string;
  }>;
};

type WorkflowLoadError = {
  source: string;
  message: string;
  stack?: string;
};

type AutoFlowOptions = {
  enrich: boolean;
  generateLandingpages: boolean;
  generateEmails: boolean;
  prepareSend: boolean;
  sendNow: boolean;
};

const actionLabels: Record<WorkflowAction, string> = {
  import: "Import anzeigen",
  enrich: "Daten anreichern",
  invalid: "Status anzeigen",
  landingpages: "Landingpages generieren",
  emails: "E-Mails generieren",
  prepare: "Versand vorbereiten",
  send: "Versand prüfen"
};

export function LeadWorkflowPanel({
  batchId,
  landingpages = [],
  latestEnrichmentJob = null,
  loadErrors = [],
  previews = [],
  summary = null,
  steps = []
}: {
  batchId?: string;
  landingpages?: WorkflowLandingpage[];
  latestEnrichmentJob?: EnrichmentJobProgress | null;
  loadErrors?: WorkflowLoadError[];
  previews?: WorkflowLeadPreview[];
  summary?: WorkflowQualificationSummary | null;
  steps?: WorkflowStep[];
}) {
  const router = useRouter();
  const [runningAction, setRunningAction] = useState<WorkflowAction | "auto" | null>(null);
  const [stepResults, setStepResults] = useState<Partial<Record<WorkflowAction, { status: StepStatus; message: string; data?: ActionResult }>>>({});
  const [stepProgress, setStepProgress] = useState<Partial<Record<WorkflowAction, { processed: number; total: number }>>>({});
  const [enrichmentJob, setEnrichmentJob] = useState<EnrichmentJobProgress | null>(latestEnrichmentJob);
  const [errorDetailsOpen, setErrorDetailsOpen] = useState<Partial<Record<WorkflowAction, boolean>>>({});
  const [toast, setToast] = useState<{ title: string; lines: string[]; type: "success" | "error" } | null>(null);
  const [toastDetailsOpen, setToastDetailsOpen] = useState(false);
  const [loadDetailsOpen, setLoadDetailsOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoResult, setAutoResult] = useState<ActionResult | null>(null);
  const [landingpagesApproved, setLandingpagesApproved] = useState(false);
  const [onlySelectedSend, setOnlySelectedSend] = useState(true);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const enrichmentPollFailuresRef = useRef(0);
  const [autoOptions, setAutoOptions] = useState<AutoFlowOptions>({
    enrich: true,
    generateLandingpages: true,
    generateEmails: true,
    prepareSend: true,
    sendNow: false
  });

  const safeSteps = steps ?? [];
  const safeLandingpages = landingpages ?? [];
  const safeLoadErrors = loadErrors ?? [];
  const safePreviews = previews ?? [];

  useEffect(() => {
    setSelectedLeadIds(safePreviews.filter((item) => item.sendable).map((item) => item.prospectId));
  }, [safePreviews]);

  useEffect(() => {
    if (!latestEnrichmentJob) return;
    setEnrichmentJob(latestEnrichmentJob);
    setStepResults((current) => ({
      ...current,
      enrich: {
        status: enrichmentStatusToStepStatus(latestEnrichmentJob.status),
        message: formatEnrichmentJobMessage(latestEnrichmentJob),
        data: enrichmentJobToActionResult(latestEnrichmentJob)
      }
    }));
    setStepProgress((current) => ({
      ...current,
      enrich: { processed: latestEnrichmentJob.processed, total: latestEnrichmentJob.total }
    }));
  }, [latestEnrichmentJob]);

  useEffect(() => {
    if (!enrichmentJob || !isEnrichmentJobRunning(enrichmentJob.status)) return;
    const poll = async () => {
      try {
        const response = await fetch(`/api/workflows/enrichment/jobs/${enrichmentJob.jobId}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as EnrichmentJobProgress & { error?: string };
        if (!response.ok) throw new Error(getSafeEnrichmentStatusError(data.error));
        if (data.error && data.total === 0 && (data.items?.length ?? 0) === 0) {
          throw new Error(getSafeEnrichmentStatusError(data.error));
        }
        enrichmentPollFailuresRef.current = 0;
        setEnrichmentJob(data);
        setStepProgress((current) => ({ ...current, enrich: { processed: data.processed, total: data.total } }));
        setStepResults((current) => ({
          ...current,
          enrich: {
            status: enrichmentStatusToStepStatus(data.status),
            message: formatEnrichmentJobMessage(data),
            data: enrichmentJobToActionResult(data)
          },
          invalid: data.status === "completed" || data.status === "failed" || data.status === "partial"
            ? { status: "erledigt", message: formatWorkflowResult("invalid", enrichmentJobToActionResult(data)), data: enrichmentJobToActionResult(data) }
            : current.invalid
        }));
        if (!isEnrichmentJobRunning(data.status)) {
          setRunningAction(null);
          setToast({ title: data.status === "partial" ? "Datenanreicherung teilweise abgeschlossen" : "Datenanreicherung abgeschlossen", lines: [formatEnrichmentJobMessage(data)], type: data.status === "failed" ? "error" : "success" });
          router.refresh();
        }
      } catch (error) {
        const message = getSafeEnrichmentStatusError(error);
        enrichmentPollFailuresRef.current += 1;
        setStepResults((current) => ({
          ...current,
          enrich: {
            status: enrichmentPollFailuresRef.current > 2 ? "Fehler" : "läuft",
            message,
            data: current.enrich?.data ?? (enrichmentJob ? enrichmentJobToActionResult(enrichmentJob) : undefined)
          }
        }));
        if (enrichmentPollFailuresRef.current > 2) setRunningAction(null);
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2500);
    return () => window.clearInterval(interval);
  }, [enrichmentJob?.jobId, enrichmentJob?.status, router]);

  const selectedCount = useMemo(() => selectedLeadIds.length, [selectedLeadIds]);

  async function runStep(step: WorkflowStep) {
    if (!batchId) return;

    if (step.action === "import" || step.action === "invalid") {
      const message = formatWorkflowResult(step.action, { processed: step.count, invalid: step.count });
      setStepResults((current) => ({ ...current, [step.action]: { status: "erledigt", message } }));
      setToast({ title: step.title, lines: [message], type: "success" });
      return;
    }

    if (step.action === "send") {
      setStepResults((current) => ({ ...current, [step.action]: { status: "erledigt", message: "Versandvorschau geöffnet." } }));
      setAutoOptions((current) => ({ ...current, sendNow: true }));
      setAutoOpen(true);
      return;
    }

    setRunningAction(step.action);
    setStepResults((current) => ({ ...current, [step.action]: { status: "läuft", message: "Aktion läuft..." } }));
    if (step.action === "enrich") {
      setStepProgress((current) => ({ ...current, enrich: { processed: 0, total: Math.min(20, Math.max(1, step.count || 20)) } }));
    }

    try {
      const response = await fetch(step.endpoint ?? "/api/workflows/lead-to-outreach/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: step.action === "prepare" ? JSON.stringify({ batchId, prepareSend: true }) : step.action === "enrich" ? JSON.stringify({ batchId }) : undefined
      });
      const data = (await response.json().catch(() => ({}))) as ActionResult;

      if (!response.ok) {
        const message = data.error ?? "Aktion fehlgeschlagen.";
        const apiResponseBody = formatApiResponseBody(data);
        setStepResults((current) => ({
          ...current,
          [step.action]: { status: "Fehler", message: `${message} (HTTP ${response.status})`, data }
        }));
        setToast({
          title: step.title,
          lines: [message, `API Statuscode: ${response.status}`, `API Response Body: ${apiResponseBody}`],
          type: "error"
        });
        return;
      }

      if (step.action === "enrich" && data.jobId) {
        const job = normalizeEnrichmentJob(data);
        setEnrichmentJob(job);
        setStepProgress((current) => ({ ...current, enrich: { processed: job.processed, total: job.total } }));
        setStepResults((current) => ({
          ...current,
          enrich: { status: enrichmentStatusToStepStatus(job.status), message: formatEnrichmentJobMessage(job), data: enrichmentJobToActionResult(job) }
        }));
        setToast({ title: step.title, lines: ["Anreicherungsjob wurde gestartet."], type: "success" });
        return;
      }

      const message = formatWorkflowResult(step.action, data);
      setStepResults((current) => ({ ...current, [step.action]: { status: "erledigt", message, data } }));
      if (step.action === "enrich") {
        setStepProgress((current) => ({ ...current, enrich: { processed: data.processed ?? 0, total: data.processed ?? Math.min(20, Math.max(1, step.count || 20)) } }));
      }
      if (step.action === "enrich") {
        setStepResults((current) => ({
          ...current,
          invalid: { status: "erledigt", message: formatWorkflowResult("invalid", data), data }
        }));
      }
      setToast({ title: step.title, lines: [message], type: "success" });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen.";
      setStepResults((current) => ({ ...current, [step.action]: { status: "Fehler", message } }));
      setToast({ title: step.title, lines: [message], type: "error" });
    } finally {
      if (step.action !== "enrich") setRunningAction(null);
    }
  }

  async function runAutoFlow() {
    if (!batchId) return;
    setRunningAction("auto");
    setAutoResult(null);

    try {
      if (autoOptions.enrich) {
        const response = await fetch("/api/workflows/enrichment/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId })
        });
        const data = (await response.json().catch(() => ({}))) as ActionResult;
        if (!response.ok || !data.jobId) {
          throw new Error(data.error ?? "Anreicherungsjob konnte nicht gestartet werden.");
        }
        const job = normalizeEnrichmentJob(data);
        setEnrichmentJob(job);
        setStepProgress((current) => ({ ...current, enrich: { processed: job.processed, total: job.total } }));
        setStepResults((current) => ({
          ...current,
          enrich: { status: enrichmentStatusToStepStatus(job.status), message: formatEnrichmentJobMessage(job), data: enrichmentJobToActionResult(job) }
        }));
        setToast({ title: "Auto-Flow gestartet", lines: ["Datenanreicherung läuft im Hintergrund. Starte die nächsten Schritte nach Abschluss."], type: "success" });
        setAutoOpen(false);
        return;
      }

      const response = await fetch("/api/workflows/lead-to-outreach/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          ...autoOptions,
          selectedProspectIds: autoOptions.sendNow && onlySelectedSend ? selectedLeadIds : undefined
        })
      });
      const data = (await response.json().catch(() => ({}))) as ActionResult;

      if (!response.ok) {
        const apiResponseBody = formatApiResponseBody(data);
        setToast({
          title: "Auto-Flow fehlgeschlagen",
          lines: [data.error ?? "Auto-Flow fehlgeschlagen.", `API Statuscode: ${response.status}`, `API Response Body: ${apiResponseBody}`],
          type: "error"
        });
        return;
      }

      const lines = formatAutoFlowResult(data);
      setAutoResult(data);
      setToast({ title: "Auto-Flow abgeschlossen", lines, type: "success" });
      setAutoOpen(false);
      router.refresh();
    } catch (error) {
      setToast({
        title: "Auto-Flow fehlgeschlagen",
        lines: [error instanceof Error ? error.message : "Auto-Flow fehlgeschlagen."],
        type: "error"
      });
    } finally {
      if (!autoOptions.enrich) setRunningAction(null);
    }
  }

  async function updateLandingpageReviewStatus(prospectId: string, landingpageReviewStatus: "draft" | "needs_review" | "approved") {
    const response = await fetch(`/api/prospects/${prospectId}/landingpage-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landingpageReviewStatus })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Landingpage-Status konnte nicht aktualisiert werden.");
    }

    setToast({ title: "Landingpage aktualisiert", lines: ["Review-Status wurde gespeichert."], type: "success" });
    router.refresh();
  }

  const sendBlocked = autoOptions.sendNow && (!landingpagesApproved || (onlySelectedSend && selectedLeadIds.length === 0));
  const visiblePreview = onlySelectedSend ? safePreviews.filter((item) => selectedLeadIds.includes(item.prospectId)) : safePreviews;
  const hasWorkflowData = Boolean(batchId) || safeSteps.some((step) => step.count > 0) || safeLandingpages.length > 0 || safePreviews.length > 0;

  return (
    <>
      {!hasWorkflowData ? <WorkflowEmptyState /> : null}

      {safeLoadErrors.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="text-base font-semibold">Workflow wurde mit eingeschränkten Daten geladen</h2>
          <p className="mt-1 text-sm">Einzelne Datenquellen konnten nicht geladen werden. Die Seite bleibt nutzbar; betroffene Aktionen sind deaktiviert oder zeigen 0 Werte.</p>
          <button
            type="button"
            onClick={() => setLoadDetailsOpen((current) => !current)}
            className="mt-3 rounded-xl border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Details anzeigen
          </button>
          {loadDetailsOpen ? (
            <div className="mt-3 space-y-3 rounded-2xl bg-white/70 p-3 text-xs">
              {safeLoadErrors.map((item, index) => (
                <div key={`${item.source}-${index}`}>
                  <p className="font-semibold">{item.source}</p>
                  <p className="mt-1 break-words">error.message: {item.message}</p>
                  {item.stack ? <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-amber-100 p-2">componentStack: {item.stack}</pre> : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-panel">
        <div>
          <h2 className="text-lg font-semibold text-ink">Manueller Auto-Flow</h2>
          <p className="mt-1 text-sm text-slate-500">Startet erst nach Bestätigung. E-Mails werden nur gesendet, wenn du den Versand explizit aktivierst.</p>
        </div>
        <button
          type="button"
          onClick={() => setAutoOpen(true)}
          disabled={!batchId || runningAction !== null}
          className="btn-primary rounded-full px-5 py-3 text-sm font-semibold shadow-sm"
        >
          Auto-Flow starten
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {safeSteps.map((step, index) => {
          const result = stepResults[step.action];
          const status = step.action === "enrich" && enrichmentJob ? enrichmentStatusToStepStatus(enrichmentJob.status) : result?.status ?? step.status;
          const progress = stepProgress[step.action];
          const enrichData = step.action === "enrich" && enrichmentJob ? enrichmentJobToActionResult(enrichmentJob) : result?.data;
          const details = step.action === "enrich" ? (enrichData?.details ?? []) : [];
          const enrichmentRunning = step.action === "enrich" && Boolean(enrichmentJob && isEnrichmentJobRunning(enrichmentJob.status));
          return (
            <section key={step.action} className="rounded-2xl bg-white p-6 shadow-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Schritt {index + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">{step.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">{step.description}</p>
                </div>
                <StatusPill status={status} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Verarbeitet</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{step.count}</p>
                {progress ? <p className="mt-1 text-sm font-medium text-slate-600">{progress.processed}/{progress.total} verarbeitet</p> : null}
                {step.action === "enrich" && enrichmentJob && isEnrichmentJobRunning(enrichmentJob.status) ? (
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p className="font-medium">Daten werden angereichert ... {enrichmentJob.processed}/{enrichmentJob.total}</p>
                    {enrichmentJob.currentLeadName ? <p>Aktuell: {enrichmentJob.currentLeadName}</p> : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => runStep(step)}
                disabled={!batchId || runningAction !== null || enrichmentRunning || (step.action === "send" && step.count === 0)}
                className="btn-primary mt-4 rounded-full px-4 py-2 text-sm font-semibold shadow-sm"
              >
                {runningAction === step.action || enrichmentRunning ? runningActionLabel(step.action) : actionLabels[step.action]}
              </button>
              <p className="mt-3 min-h-5 text-sm text-slate-500">{step.action === "enrich" && enrichmentJob ? formatEnrichmentJobMessage(enrichmentJob) : result?.message ?? "Noch keine Ausführung in dieser Ansicht."}</p>
              {step.action === "enrich" && enrichData ? <EnrichmentSummary result={enrichData} /> : null}
              {step.action === "enrich" && details.length > 0 ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setErrorDetailsOpen((current) => ({ ...current, enrich: !current.enrich }))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Leadstatus anzeigen
                  </button>
                  {errorDetailsOpen.enrich ? (
                    <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-800">
                      {details.map((detail, detailIndex) => (
                        <div key={`${detail.companyName ?? detail.leadImportRowId ?? detailIndex}-${detailIndex}`} className="rounded-xl bg-white/70 p-3">
                          <p className="break-words">
                            <span className="font-semibold">{detail.companyName || detail.prospectId || detail.leadImportRowId || `Lead ${detailIndex + 1}`}:</span>{" "}
                            <span className={enrichmentItemStatusClass(detail.status)}>{enrichmentItemStatusLabel(detail.status)}</span>
                          </p>
                          {detail.error ? <p className="mt-1 break-words text-xs text-red-700">Fehlergrund: {detail.error}</p> : null}
                          <p className="mt-1 text-xs font-medium text-slate-500">Quelle: {detail.source ?? "Datenanreicherung"}</p>
                          {detail.status === "failed" || detail.status === "invalid" ? (
                            <button
                              type="button"
                              onClick={() => runStep(step)}
                              disabled={!batchId || runningAction !== null || enrichmentRunning}
                              className="mt-2 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Retry
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <section className="mt-6 rounded-2xl bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Versandvorschau</h2>
            <p className="mt-1 text-sm text-slate-500">Nur relevante Leads. Vor dem Versand prüfst du Auswahl, Landingpage und Mailinhalt.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{summary?.breakdown ?? "Noch keine Vorschau verfügbar."}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{selectedCount} ausgewählt</span>
          </div>
        </div>

        <label className="mt-4 flex min-w-0 items-center gap-3 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={onlySelectedSend} onChange={(event) => setOnlySelectedSend(event.target.checked)} className="h-5 w-5 shrink-0 rounded border-slate-300" />
          <span className="min-w-0 break-words">Nur ausgewählte Leads senden</span>
        </label>

        <div className="mt-4 space-y-4">
          {visiblePreview.length === 0 ? <p className="text-sm text-slate-500">Noch keine qualifizierten Leads für die Vorschau.</p> : null}
          {visiblePreview.map((item) => (
            <div key={item.prospectId} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.includes(item.prospectId)}
                    onChange={(event) => {
                      setSelectedLeadIds((current) =>
                        event.target.checked ? [...new Set([...current, item.prospectId])] : current.filter((id) => id !== item.prospectId)
                      );
                    }}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300"
                  />
                  <span>
                    <span className="block break-words font-medium text-ink">{item.companyName}</span>
                    <span className="block break-words text-sm text-slate-500">{item.email}{item.reason ? ` · ${item.reason}` : ""}</span>
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {item.slug ? <Link href={`/p/${item.slug}`} target="_blank" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Landingpage Preview</Link> : null}
                  {item.landingpageUrl ? <Link href={item.landingpageUrl} target="_blank" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Open Link</Link> : null}
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400">E-Mail Vorschau</p>
                <p className="mt-2 text-sm font-semibold text-ink">{item.generatedEmails[0]?.subject ?? "Kein Betreff"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.generatedEmails[0]?.body ?? "Keine Vorschau verfügbar."}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Landingpage-Vorschauen</h2>
            <p className="mt-1 text-sm text-slate-500">Nicht freigegebene Landingpages blockieren Tracking-Links und Kampagnenmails.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Entwurf {safeLandingpages.filter((item) => item.reviewStatus === "draft").length}</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Geprüft {safeLandingpages.filter((item) => item.reviewStatus === "needs_review").length}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Freigegeben {safeLandingpages.filter((item) => item.reviewStatus === "approved").length}</span>
            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">Blockiert {safeLandingpages.filter((item) => item.blocking).length}</span>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {safeLandingpages.length === 0 ? <p className="text-sm text-slate-500">Noch keine Landingpage-Vorschauen erstellt.</p> : null}
          {safeLandingpages.map((item) => (
            <div key={item.prospectId} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="break-words font-medium text-ink">{item.companyName}</p>
                  <p className="mt-1 text-sm text-slate-500">Status: {reviewLabel(item.reviewStatus)}{item.blocking ? " · blockiert Versand" : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.slug ? <Link href={`/p/${item.slug}`} target="_blank" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Vorschau öffnen</Link> : null}
                  {item.slug ? <Link href={`/p/${item.slug}`} target="_blank" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Mobile Preview</Link> : null}
                  {item.slug ? <Link href={`/p/${item.slug}`} target="_blank" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Desktop Preview</Link> : null}
                  <button type="button" onClick={() => updateLandingpageReviewStatus(item.prospectId, "approved")} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Freigeben</button>
                  <button type="button" onClick={() => updateLandingpageReviewStatus(item.prospectId, "draft")} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">Zurück auf Entwurf</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {autoOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/60 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">Auto-Flow starten?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Es werden Leads angereichert, ungültige Firmen aussortiert, Landingpages und E-Mail-Entwürfe erstellt. E-Mails werden noch nicht automatisch versendet.
            </p>
            <div className="mt-5 space-y-3">
              <Checkbox label="Daten anreichern" checked={autoOptions.enrich} onChange={(value) => setAutoOptions((current) => ({ ...current, enrich: value }))} />
              <Checkbox label="Landingpages generieren" checked={autoOptions.generateLandingpages} onChange={(value) => setAutoOptions((current) => ({ ...current, generateLandingpages: value }))} />
              <Checkbox label="E-Mails generieren" checked={autoOptions.generateEmails} onChange={(value) => setAutoOptions((current) => ({ ...current, generateEmails: value }))} />
              <Checkbox label="Versand vorbereiten" checked={autoOptions.prepareSend} onChange={(value) => setAutoOptions((current) => ({ ...current, prepareSend: value }))} />
              <Checkbox label="E-Mails direkt senden (optional)" checked={autoOptions.sendNow} onChange={(value) => setAutoOptions((current) => ({ ...current, sendNow: value }))} />
              {autoOptions.sendNow ? (
                <Checkbox label="Landingpages wurden geprüft und freigegeben" checked={landingpagesApproved} onChange={setLandingpagesApproved} />
              ) : null}
            </div>
            {autoResult ? <ResultList title="Letztes Auto-Flow Ergebnis" lines={formatAutoFlowResult(autoResult)} /> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setAutoOpen(false)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Abbrechen</button>
              <button
                type="button"
                onClick={runAutoFlow}
                disabled={runningAction === "auto" || sendBlocked}
                className="btn-primary rounded-full px-4 py-2 text-sm font-semibold"
              >
                {runningAction === "auto" ? "Flow läuft..." : "Flow starten"}
              </button>
            </div>
            {sendBlocked ? <p className="mt-3 text-sm text-red-700">Vor dem Versand müssen Landingpages geprüft und freigegeben werden und es muss mindestens ein Lead ausgewählt sein.</p> : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed right-4 top-4 z-50 w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-sm font-semibold ${toast.type === "success" ? "text-emerald-700" : "text-red-700"}`}>{toast.title}</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {toast.lines.slice(0, 1).map((line) => <li key={line}>{line}</li>)}
              </ul>
              {toast.type === "error" && toast.lines.length > 1 ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setToastDetailsOpen((current) => !current)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Details anzeigen
                  </button>
                  {toastDetailsOpen ? (
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                      {toast.lines.slice(1).join("\n")}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => { setToast(null); setToastDetailsOpen(false); }} className="rounded-full px-2 py-1 text-sm font-semibold text-slate-500">Schließen</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function WorkflowEmptyState() {
  return (
    <section className="mb-6 rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-xl font-semibold text-ink">Noch keine Daten vorhanden</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Es wurden noch keine verarbeiteten Leads gefunden. Der Workflow lädt trotzdem mit 0 verarbeiteten Leads; Aktionen werden erst nach einem Import aktiv.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/admin/import" className="btn-primary rounded-full px-4 py-2 text-sm font-semibold shadow-sm">
          Leads importieren
        </Link>
        <Link href="/admin/campaigns/new" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Kampagne erstellen
        </Link>
      </div>
    </section>
  );
}

function formatApiResponseBody(data: unknown) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function runningActionLabel(action: WorkflowAction) {
  if (action === "enrich") return "Daten werden angereichert ...";
  return "Läuft...";
}

function EnrichmentSummary({ result }: { result: ActionResult }) {
  return (
    <div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
      <p className="font-medium text-emerald-700">Erfolgreich: {result.successful ?? result.enriched ?? 0}</p>
      <p className="font-medium text-amber-700">Ungültig: {result.invalid ?? 0}</p>
      <p className="font-medium text-red-700">Fehlgeschlagen: {result.failed ?? 0}</p>
      <p className="font-medium text-slate-600">Übersprungen: {result.skipped ?? 0}</p>
    </div>
  );
}

function isEnrichmentJobRunning(status: string) {
  return status === "queued" || status === "running";
}

function enrichmentStatusToStepStatus(status: string): StepStatus {
  if (status === "queued" || status === "running") return "läuft";
  if (status === "failed") return "Fehler";
  return "erledigt";
}

function normalizeEnrichmentJob(data: ActionResult): EnrichmentJobProgress {
  return {
    jobId: data.jobId ?? "",
    status: data.status === "running" || data.status === "completed" || data.status === "failed" || data.status === "partial" ? data.status : "queued",
    total: data.total ?? 0,
    processed: data.processed ?? 0,
    successful: data.successful ?? data.enriched ?? 0,
    invalid: data.invalid ?? 0,
    failed: data.failed ?? 0,
    skipped: data.skipped ?? 0,
    currentLeadName: data.currentLeadName ?? null,
    errors: data.errors ?? [],
    items: []
  };
}

function enrichmentJobToActionResult(job: EnrichmentJobProgress): ActionResult {
  const itemDetails = (job.items ?? []).map((item) => ({
    leadImportRowId: item.leadImportRowId,
    prospectId: item.prospectId ?? undefined,
    companyName: item.companyName ?? undefined,
    status: item.status,
    error: item.error ?? undefined,
    source: item.source ?? "Datenanreicherung"
  }));
  const errorDetails = job.errors.map((error) => ({
    leadImportRowId: error.leadImportRowId,
    prospectId: error.prospectId ?? undefined,
    companyName: error.companyName ?? undefined,
    status: "failed" as const,
    error: error.error,
    source: error.source ?? "Datenanreicherung"
  }));
  return {
    jobId: job.jobId,
    status: job.status,
    total: job.total,
    processed: job.processed,
    successful: job.successful,
    enriched: job.successful,
    invalid: job.invalid,
    failed: job.failed,
    skipped: job.skipped,
    currentLeadName: job.currentLeadName,
    errors: job.errors,
    details: itemDetails.length > 0 ? itemDetails : errorDetails,
    breakdown: `${job.processed}/${job.total} verarbeitet, ${job.successful} erfolgreich, ${job.invalid} ungültig, ${job.failed} fehlgeschlagen, ${job.skipped} übersprungen`
  };
}

function formatEnrichmentJobMessage(job: EnrichmentJobProgress) {
  if (isEnrichmentJobRunning(job.status)) {
    const current = job.currentLeadName ? ` Aktuell: ${job.currentLeadName}` : "";
    if (job.failed > 0 || job.invalid > 0) {
      return `Anreicherung läuft weiter. ${job.processed}/${job.total} verarbeitet. ${job.successful} erfolgreich, ${job.invalid} ungültig, ${job.failed} fehlgeschlagen, ${job.skipped} übersprungen.${current}`;
    }
    return `Daten werden angereichert ... ${job.processed}/${job.total}.${current}`;
  }
  if (job.status === "partial") {
    return `Teilweise abgeschlossen. Erfolgreich: ${job.successful}. Ungültig: ${job.invalid}. Fehlgeschlagen: ${job.failed}. Übersprungen: ${job.skipped}.`;
  }
  if (job.status === "failed") {
    return `Status konnte nicht geladen werden. Erneut versuchen. Erfolgreich bisher: ${job.successful}. Fehlgeschlagen: ${job.failed}.`;
  }
  return `Abgeschlossen. Erfolgreich: ${job.successful}. Ungültig: ${job.invalid}. Fehlgeschlagen: ${job.failed}. Übersprungen: ${job.skipped}.`;
}

function enrichmentItemStatusLabel(status: NonNullable<ActionResult["details"]>[number]["status"]) {
  if (status === "queued") return "Wartet";
  if (status === "running") return "Läuft";
  if (status === "success") return "Angereichert";
  if (status === "invalid") return "Ungültig";
  if (status === "failed") return "Fehler";
  return "Übersprungen";
}

function enrichmentItemStatusClass(status: NonNullable<ActionResult["details"]>[number]["status"]) {
  if (status === "success") return "font-semibold text-emerald-700";
  if (status === "invalid") return "font-semibold text-amber-700";
  if (status === "failed") return "font-semibold text-red-700";
  if (status === "running") return "font-semibold text-blue-700";
  return "font-semibold text-slate-600";
}

function getSafeEnrichmentStatusError(error: unknown) {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (!message || /load failed|failed to fetch|networkerror/i.test(message)) return "Status konnte nicht geladen werden. Erneut versuchen.";
  return message;
}

export function formatWorkflowResult(action: WorkflowAction, data: ActionResult) {
  if (action === "import") {
    return `${data.processed ?? 0} Leads importiert.`;
  }

  if (action === "enrich") {
    const failedText = data.failed === undefined ? "" : ` ${data.failed} fehlgeschlagen.`;
    return `${data.processed ?? 0} Leads verarbeitet. ${data.enriched ?? 0} angereichert.${failedText} ${data.invalid ?? 0} ungültig. ${data.breakdown ?? ""}`.trim();
  }

  if (action === "invalid") {
    return `${data.invalid ?? 0} ungültige Firmen aussortiert.`;
  }

  if (action === "landingpages") {
    return `${data.generated ?? data.landingpagesGenerated ?? 0} Landingpages generiert. ${data.skipped ?? 0} übersprungen. ${data.breakdown ?? ""}`.trim();
  }

  if (action === "emails") {
    return `${data.generated ?? data.emailsGenerated ?? 0} E-Mails generiert. ${data.failed ?? 0} Fehler. ${data.breakdown ?? ""}`.trim();
  }

  if (action === "prepare") {
    return `${data.prepared ?? 0} E-Mail-Entwürfe für den Versand vorbereitet. ${data.breakdown ?? ""}`.trim();
  }

  return `${data.sent ?? 0} E-Mails versendet. ${data.failed ?? 0} fehlgeschlagen. ${data.skipped ?? 0} übersprungen. ${data.breakdown ?? ""}`.trim();
}

export function formatAutoFlowResult(data: ActionResult) {
  const lines = [
    data.breakdown ?? `${data.total ?? 0} Leads verarbeitet`,
    `${data.processed ?? 0} Leads verarbeitet`,
    `${data.enriched ?? 0} angereichert`,
    `${data.invalid ?? 0} ungültig`,
    `${data.landingpagesGenerated ?? 0} Landingpages generiert`,
    `${data.emailsGenerated ?? 0} E-Mail-Entwürfe erstellt`,
    `${data.prepared ?? 0} für den Versand vorbereitet`,
    `${data.sent ?? 0} E-Mails versendet`,
    `${data.blocked ?? 0} geblockt`
  ];

  if ((data.sent ?? 0) > 0 || (data.failed ?? 0) > 0) {
    lines.push(`${data.sent ?? 0} E-Mails versendet, ${data.failed ?? 0} fehlgeschlagen`);
  }

  return lines;
}

function StatusPill({ status }: { status: StepStatus }) {
  const className = {
    offen: "bg-slate-100 text-slate-600",
    läuft: "bg-cyan-50 text-cyan-700",
    erledigt: "bg-emerald-50 text-emerald-700",
    Fehler: "bg-red-50 text-red-700"
  }[status];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 rounded border-slate-300" />
      <span className="min-w-0 break-words">{label}</span>
    </label>
  );
}

function ResultList({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}

function reviewLabel(status: string) {
  if (status === "approved") return "freigegeben";
  if (status === "needs_review") return "geprüft";
  return "Entwurf";
}
