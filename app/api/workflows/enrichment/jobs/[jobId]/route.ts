import { NextResponse } from "next/server";
import { getEnrichmentJobProgress, maybeResumeEnrichmentJob } from "@/lib/enrichment-jobs";
import { getErrorMessage } from "@/lib/api";

type RouteProps = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, { params }: RouteProps) {
  const { jobId } = await params;
  console.info("ENRICHMENT_JOB_STATUS_REQUEST", { jobId });
  try {
    const progress = await getEnrichmentJobProgress(jobId);
    if (!progress) return NextResponse.json({ error: "Anreicherungsjob nicht gefunden." }, { status: 404 });
    maybeResumeEnrichmentJob(jobId).catch((error) => {
      const message = getErrorMessage(error, "Status konnte nicht geladen werden. Erneut versuchen.");
      console.error("ENRICHMENT_JOB_STATUS_FAILED", { jobId, message });
    });
    return NextResponse.json(progress);
  } catch (error) {
    const message = getErrorMessage(error, "Status konnte nicht geladen werden. Erneut versuchen.");
    console.error("ENRICHMENT_JOB_STATUS_FAILED", { jobId, message });
    return NextResponse.json({
      jobId,
      status: "failed",
      total: 0,
      processed: 0,
      successful: 0,
      invalid: 0,
      failed: 1,
      skipped: 0,
      currentLeadName: null,
      errors: [{ error: "Status konnte nicht geladen werden. Erneut versuchen.", source: "Jobstatus" }],
      items: [],
      error: "Status konnte nicht geladen werden. Erneut versuchen."
    });
  }
}
