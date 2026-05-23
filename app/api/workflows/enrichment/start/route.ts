import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { getEnrichmentJobProgress, startEnrichmentJob } from "@/lib/enrichment-jobs";
import { logWorkflowServerError } from "@/lib/workflow-errors";

const payloadSchema = z.object({
  batchId: z.string().min(1),
  minFitScore: z.coerce.number().int().min(0).max(100).optional()
});

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    const job = await startEnrichmentJob({ batchId: payload.batchId, minFitScore: payload.minFitScore });
    const progress = await getEnrichmentJobProgress(job.id);
    return NextResponse.json({
      jobId: job.id,
      status: job.status === "running" ? "running" : "queued",
      ...(progress ?? {})
    });
  } catch (error) {
    logWorkflowServerError("/api/workflows/enrichment/start", error);
    return NextResponse.json({ error: getErrorMessage(error, "Anreicherungsjob konnte nicht gestartet werden.") }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
