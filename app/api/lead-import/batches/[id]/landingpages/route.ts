import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { generateLandingpagesForBatch } from "@/lib/lead-workflow";
import { logWorkflowServerError, workflowLoadErrorResponse } from "@/lib/workflow-errors";

type Props = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Props) {
  try {
    const { id } = await params;
    return NextResponse.json(await generateLandingpagesForBatch(id));
  } catch (error) {
    logWorkflowServerError("/api/lead-import/batches/[id]/landingpages", error);
    if (getErrorMessage(error, "") === "NEXT_REDIRECT") throw error;
    return workflowLoadErrorResponse(error);
  }
}
