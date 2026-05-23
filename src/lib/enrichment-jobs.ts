import type { Prisma } from "@prisma/client";
import { enrichImportRow, getEnrichmentRows, workflowEnrichmentErrorMessage } from "@/lib/lead-workflow";
import { prisma } from "@/lib/prisma";

const DEFAULT_PARALLELISM = 2;
const MAX_PARALLELISM = 3;
const DEFAULT_LEAD_TIMEOUT_MS = 45_000;
const activeJobs = new Map<string, Promise<void>>();

type EnrichmentJobStatus = "queued" | "running" | "completed" | "failed" | "partial";
type EnrichmentJobItemStatus = "queued" | "running" | "success" | "invalid" | "failed" | "skipped";

type EnrichmentJobProgressItem = {
  id: string;
  leadImportRowId: string;
  prospectId: string | null;
  companyName: string | null;
  status: EnrichmentJobItemStatus;
  error: string | null;
  source: string;
};

export type EnrichmentJobProgress = {
  jobId: string;
  status: EnrichmentJobStatus;
  total: number;
  processed: number;
  successful: number;
  invalid: number;
  failed: number;
  skipped: number;
  currentLeadName: string | null;
  errors: Array<{ leadImportRowId?: string; prospectId?: string | null; companyName?: string | null; error: string; source?: string }>;
  items: EnrichmentJobProgressItem[];
};

export async function startEnrichmentJob(input: { batchId: string; minFitScore?: number; parallelism?: number; leadTimeoutMs?: number }) {
  const existing = await prisma.enrichmentJob.findFirst({
    where: { batchId: input.batchId, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" }
  });
  if (existing) {
    runEnrichmentJobInBackground(existing.id, { parallelism: input.parallelism, leadTimeoutMs: input.leadTimeoutMs });
    return existing;
  }

  const rows = await getEnrichmentRows(input.batchId, 500, input.minFitScore);
  if (rows.length === 0) {
    throw new Error("Keine Leads für Anreicherung gefunden");
  }

  const job = await prisma.enrichmentJob.create({
    data: {
      batchId: input.batchId,
      status: "queued",
      total: rows.length,
      items: {
        create: rows.map((row) => ({
          leadImportRowId: row.id,
          prospectId: row.prospect?.id,
          companyName: row.prospect?.companyName,
          status: "queued"
        }))
      }
    }
  });

  runEnrichmentJobInBackground(job.id, { parallelism: input.parallelism, leadTimeoutMs: input.leadTimeoutMs });
  return job;
}

export function runEnrichmentJobInBackground(jobId: string, options: { parallelism?: number; leadTimeoutMs?: number } = {}) {
  if (activeJobs.has(jobId)) return;
  const task = runEnrichmentJob(jobId, options)
    .catch((error) => {
      console.error("ENRICHMENT_JOB_FAILED", { jobId, message: workflowEnrichmentErrorMessage(error) });
    })
    .finally(() => {
      activeJobs.delete(jobId);
    });
  activeJobs.set(jobId, task);
}

export async function maybeResumeEnrichmentJob(jobId: string) {
  const job = await prisma.enrichmentJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "queued" || job.status === "running") {
    runEnrichmentJobInBackground(job.id);
  }
}

async function runEnrichmentJob(jobId: string, options: { parallelism?: number; leadTimeoutMs?: number } = {}) {
  const parallelism = Math.min(MAX_PARALLELISM, Math.max(1, options.parallelism ?? DEFAULT_PARALLELISM));
  const leadTimeoutMs = Math.max(5_000, options.leadTimeoutMs ?? DEFAULT_LEAD_TIMEOUT_MS);
  const job = await prisma.enrichmentJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  console.info("ENRICHMENT_JOB_START", { jobId, batchId: job.batchId, total: job.total });

  await prisma.enrichmentJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: job.startedAt ?? new Date(), finishedAt: null }
  });
  await prisma.enrichmentJobItem.updateMany({
    where: { jobId, status: "running" },
    data: { status: "queued", error: "Job wurde nach Unterbrechung fortgesetzt.", startedAt: null }
  });

  try {
    while (true) {
      const items = await prisma.enrichmentJobItem.findMany({
        where: { jobId, status: "queued" },
        orderBy: { createdAt: "asc" },
        take: parallelism
      });
      if (items.length === 0) break;
      await Promise.all(items.map((item) => processJobItem(jobId, item.id, leadTimeoutMs)));
    }

    const counts = await summarizeJobItems(jobId);
    const finalStatus = getFinalJobStatus(counts);
    if (finalStatus === "partial") {
      console.warn("ENRICHMENT_JOB_PARTIAL", { jobId, total: job.total, processed: counts.processed, successful: counts.successful, invalid: counts.invalid, failed: counts.failed, skipped: counts.skipped });
    }
    await prisma.enrichmentJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        processed: counts.processed,
        successful: counts.successful,
        invalid: counts.invalid,
        failed: counts.failed,
        currentLeadName: null,
        errors: counts.errors as Prisma.InputJsonValue,
        finishedAt: new Date()
      }
    });
    console.info("ENRICHMENT_JOB_COMPLETED", { jobId, status: finalStatus, total: job.total, processed: counts.processed, successful: counts.successful, invalid: counts.invalid, failed: counts.failed, skipped: counts.skipped });
  } catch (error) {
    const message = workflowEnrichmentErrorMessage(error);
    const counts = await summarizeJobItems(jobId);
    const finalStatus = counts.processed > 0 ? "partial" : "failed";
    if (finalStatus === "partial") {
      console.warn("ENRICHMENT_JOB_PARTIAL", { jobId, processed: counts.processed, successful: counts.successful, invalid: counts.invalid, failed: counts.failed, skipped: counts.skipped, error: message });
    }
    await prisma.enrichmentJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        processed: counts.processed,
        successful: counts.successful,
        invalid: counts.invalid,
        failed: counts.failed,
        errors: [...counts.errors, { error: message }] as Prisma.InputJsonValue,
        currentLeadName: null,
        finishedAt: new Date()
      }
    });
  }
}

async function processJobItem(jobId: string, itemId: string, leadTimeoutMs: number) {
  const item = await prisma.enrichmentJobItem.update({
    where: { id: itemId },
    data: { status: "running", startedAt: new Date(), error: null }
  });
  await prisma.enrichmentJob.update({ where: { id: jobId }, data: { currentLeadName: item.companyName } });

  try {
    const row = await prisma.leadImportRow.findUnique({
      where: { id: item.leadImportRowId },
      include: { prospect: true }
    });
    if (!row) throw new Error("Lead wurde nicht gefunden.");
    const result = await withTimeout(enrichImportRow(row, jobId), leadTimeoutMs);
    await prisma.enrichmentJobItem.update({
      where: { id: itemId },
      data: {
        status: result.status,
        prospectId: result.prospectId ?? item.prospectId,
        companyName: result.companyName ?? item.companyName,
        error: result.error,
        finishedAt: new Date()
      }
    });
  } catch (error) {
    const message = workflowEnrichmentErrorMessage(error);
    console.error("ENRICHMENT_ITEM_FAILED", { jobId, itemId, leadImportRowId: item.leadImportRowId, prospectId: item.prospectId, companyName: item.companyName, message });
    console.error("ITEM_FAILED", { jobId, itemId, leadImportRowId: item.leadImportRowId, prospectId: item.prospectId, companyName: item.companyName, message });
    await prisma.enrichmentJobItem.update({
      where: { id: itemId },
      data: { status: "failed", error: message, finishedAt: new Date() }
    });
    await prisma.leadImportRow.update({
      where: { id: item.leadImportRowId },
      data: { status: "failed", reason: message }
    }).catch(() => undefined);
  } finally {
    const counts = await summarizeJobItems(jobId);
    await prisma.enrichmentJob.update({
      where: { id: jobId },
      data: {
        processed: counts.processed,
        successful: counts.successful,
        invalid: counts.invalid,
        failed: counts.failed,
        errors: counts.errors as Prisma.InputJsonValue
      }
    });
  }
}

async function summarizeJobItems(jobId: string) {
  const items = await prisma.enrichmentJobItem.findMany({ where: { jobId } });
  const successful = items.filter((item) => item.status === "success").length;
  const invalid = items.filter((item) => item.status === "invalid").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const skipped = items.filter((item) => item.status === "skipped").length;
  const errors = items
    .filter((item) => item.status === "invalid" || item.status === "failed")
    .map((item) => ({
      leadImportRowId: item.leadImportRowId,
      prospectId: item.prospectId,
      companyName: item.companyName,
      source: "Datenanreicherung",
      error: item.error || (item.status === "invalid" ? "Lead ist ungueltig." : "Anreicherung fehlgeschlagen.")
    }));
  return { processed: successful + invalid + failed + skipped, successful, invalid, failed, skipped, errors };
}

function getFinalJobStatus(counts: Awaited<ReturnType<typeof summarizeJobItems>>): EnrichmentJobStatus {
  if (counts.failed > 0 || counts.invalid > 0) return "partial";
  return "completed";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(Object.assign(new Error("Crawler Timeout"), { code: "CRAWLER_TIMEOUT", failedStep: "crawler" })), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function getEnrichmentJobProgress(jobId: string): Promise<EnrichmentJobProgress | null> {
  const job = await prisma.enrichmentJob.findUnique({
    where: { id: jobId },
    include: { items: { orderBy: { createdAt: "asc" } } }
  });
  if (!job) return null;
  return mapEnrichmentJobProgress(job);
}

export async function getLatestEnrichmentJobProgress(batchId: string): Promise<EnrichmentJobProgress | null> {
  const job = await prisma.enrichmentJob.findFirst({
    where: { batchId },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { createdAt: "asc" } } }
  });
  if (!job) return null;
  return mapEnrichmentJobProgress(job);
}

function mapEnrichmentJobProgress(job: {
  id: string;
  status: string;
  total: number;
  processed: number;
  successful: number;
  invalid: number;
  failed: number;
  currentLeadName: string | null;
  errors: Prisma.JsonValue;
  items?: Array<{
    id: string;
    leadImportRowId: string;
    prospectId: string | null;
    companyName: string | null;
    status: string;
    error: string | null;
  }>;
}): EnrichmentJobProgress {
  const items = (job.items ?? []).map((item) => ({
    id: item.id,
    leadImportRowId: item.leadImportRowId,
    prospectId: item.prospectId,
    companyName: item.companyName,
    status: normalizeJobItemStatus(item.status),
    error: item.error,
    source: "Datenanreicherung"
  }));
  const successful = Math.max(job.successful, items.filter((item) => item.status === "success").length);
  const invalid = Math.max(job.invalid, items.filter((item) => item.status === "invalid").length);
  const failed = Math.max(job.failed, items.filter((item) => item.status === "failed").length);
  const skipped = items.filter((item) => item.status === "skipped").length;
  const processed = Math.max(job.processed, successful + invalid + failed + skipped);
  return {
    jobId: job.id,
    status: normalizeJobStatus(job.status, { successful, invalid, failed, skipped, processed }),
    total: job.total,
    processed,
    successful,
    invalid,
    failed,
    skipped,
    currentLeadName: job.currentLeadName,
    errors: normalizeErrors(job.errors),
    items
  };
}

function normalizeJobStatus(status: string, counts?: { processed: number; successful: number; invalid: number; failed: number; skipped: number }): EnrichmentJobStatus {
  if (status === "completed" && counts && (counts.failed > 0 || counts.invalid > 0)) return "partial";
  if (status === "failed" && counts && counts.processed > 0 && (counts.failed > 0 || counts.invalid > 0)) return "partial";
  if (status === "partial" || status === "running" || status === "completed" || status === "failed") return status;
  return "queued";
}

function normalizeJobItemStatus(status: string): EnrichmentJobItemStatus {
  if (status === "running" || status === "success" || status === "invalid" || status === "failed" || status === "skipped") return status;
  return "queued";
}

function normalizeErrors(value: Prisma.JsonValue): EnrichmentJobProgress["errors"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    return [{
      leadImportRowId: typeof record.leadImportRowId === "string" ? record.leadImportRowId : undefined,
      prospectId: typeof record.prospectId === "string" ? record.prospectId : null,
      companyName: typeof record.companyName === "string" ? record.companyName : null,
      source: typeof record.source === "string" ? record.source : "Datenanreicherung",
      error: typeof record.error === "string" ? record.error : "Anreicherung fehlgeschlagen."
    }];
  });
}

export function isEnrichmentJobRunning(status: string) {
  return status === "queued" || status === "running";
}
