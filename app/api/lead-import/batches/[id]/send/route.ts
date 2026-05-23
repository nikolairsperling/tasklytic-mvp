import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { sendBatchEmails } from "@/lib/lead-workflow";
import { logWorkflowServerError, workflowLoadErrorResponse } from "@/lib/workflow-errors";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { blockInfoEmails?: boolean };
    return NextResponse.json(await sendBatchEmails(id, { blockInfoEmails: body.blockInfoEmails !== false }));
  } catch (error) {
    logWorkflowServerError("/api/lead-import/batches/[id]/send", error);
    if (getErrorMessage(error, "") === "NEXT_REDIRECT") throw error;
    return workflowLoadErrorResponse(error);
  }
}
