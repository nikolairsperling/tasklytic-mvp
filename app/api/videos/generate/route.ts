import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { generateAndApplyMockVideo } from "@/lib/video";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const job = await generateAndApplyMockVideo({
      prospectId: String(body.prospectId || ""),
      campaignId: typeof body.campaignId === "string" ? body.campaignId : undefined,
      videoTemplateId: typeof body.videoTemplateId === "string" ? body.videoTemplateId : undefined,
      tone: body.tone
    });
    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Video konnte nicht erzeugt werden.") }, { status: 400 });
  }
}
