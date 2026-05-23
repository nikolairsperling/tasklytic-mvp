import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getEnrichmentJobProgress, startEnrichmentJob } from "@/lib/enrichment-jobs";
import { logWorkflowServerError } from "@/lib/workflow-errors";

type Props = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Props) {
  try {
    const { id } = await params;
    const job = await startEnrichmentJob({ batchId: id });
    const progress = await getEnrichmentJobProgress(job.id);
    return NextResponse.json({ jobId: job.id, status: job.status === "running" ? "running" : "queued", ...(progress ?? {}) });
  } catch (error) {
    logWorkflowServerError("/api/lead-import/batches/[id]/enrich", error);
    if (getErrorMessage(error, "") === "NEXT_REDIRECT") throw error;
    return NextResponse.json({ error: getErrorMessage(error, "Datenanreicherung fehlgeschlagen.") }, { status: 400 });
  }
}
