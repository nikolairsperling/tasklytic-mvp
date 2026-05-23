import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { generateCampaignCopy, parseAiCampaignCopyPayload } from "@/lib/ai-copy";

export async function POST(request: Request) {
  try {
    const payload = parseAiCampaignCopyPayload(await request.json());
    const result = await generateCampaignCopy(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "KI-Texte konnten nicht erzeugt werden.") },
      { status: 400 }
    );
  }
}
