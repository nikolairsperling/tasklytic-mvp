import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { getEnrichmentJobProgress, startEnrichmentJob } from "@/lib/enrichment-jobs";
import { runLeadToOutreachWorkflow } from "@/lib/lead-workflow";
import { logWorkflowServerError } from "@/lib/workflow-errors";

const payloadSchema = z.object({
  batchId: z.string().min(1),
  minFitScore: z.coerce.number().int().min(0).max(100).default(60),
  enrich: z.boolean().default(false),
  generateLandingpages: z.boolean().default(false),
  generateEmails: z.boolean().default(false),
  prepareSend: z.boolean().default(false),
  sendNow: z.boolean().default(false),
  selectedProspectIds: z.array(z.string().min(1)).optional()
});

export async function POST(request: Request) {
  console.info("WORKFLOW_API_LOAD_START", {
    route: "/api/workflows/lead-to-outreach/run",
    method: request.method
  });

  try {
    const payload = payloadSchema.parse(await request.json());
    if (payload.enrich) {
      const job = await startEnrichmentJob({ batchId: payload.batchId, minFitScore: payload.minFitScore });
      const progress = await getEnrichmentJobProgress(job.id);
      return NextResponse.json({ jobId: job.id, status: job.status === "running" ? "running" : "queued", ...(progress ?? {}) }, { status: 202 });
    }
    return NextResponse.json(await runLeadToOutreachWorkflow(payload));
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    const body = {
      error: error instanceof z.ZodError
        ? getErrorMessage(error, "Workflow konnte nicht geladen werden.")
        : "Workflow konnte nicht geladen werden."
    };
    console.error("WORKFLOW_API_LOAD_FAILED", {
      route: "/api/workflows/lead-to-outreach/run",
      status,
      body
    });
    logWorkflowServerError("/api/workflows/lead-to-outreach/run", error);
    return NextResponse.json(body, { status });
  }
}
