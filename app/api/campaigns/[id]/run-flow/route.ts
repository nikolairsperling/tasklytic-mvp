import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { campaignFlowPayloadSchema, runCampaignFlow } from "@/lib/campaign-flow";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = campaignFlowPayloadSchema.parse(await request.json());
    const result = await runCampaignFlow({ campaignId: id, input: payload });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Flow konnte nicht gestartet werden.") },
      { status: 400 }
    );
  }
}
