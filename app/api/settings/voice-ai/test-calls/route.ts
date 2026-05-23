import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { createVoiceAiTestCall, getVoiceAiTestModeState, voiceAiTestCallInputSchema, voiceAiTestScript } from "@/lib/voice-ai-tests";

export async function GET() {
  try {
    const state = await getVoiceAiTestModeState();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Testprotokoll konnte nicht geladen werden.") }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = voiceAiTestCallInputSchema.parse(await request.json());
    const call = await createVoiceAiTestCall(payload);
    const state = await getVoiceAiTestModeState();
    return NextResponse.json({
      call,
      script: voiceAiTestScript(payload.scenario),
      ...state
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Testanruf konnte nicht gestartet werden.") }, { status: 400 });
  }
}
