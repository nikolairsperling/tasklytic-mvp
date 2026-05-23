import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { readCallingSettings, saveCallingSettings } from "@/lib/app-settings";
import { getVoiceAiTestModeState } from "@/lib/voice-ai-tests";

export async function POST() {
  try {
    const state = await getVoiceAiTestModeState();
    if (!state.canActivate) {
      return NextResponse.json({
        error: `Mindestens ${state.requiredSuccessfulCount} erfolgreiche Testcalls erforderlich.`
      }, { status: 400 });
    }
    const settings = await readCallingSettings();
    const updated = await saveCallingSettings({ ...settings, voiceAiEnabled: true });
    return NextResponse.json({ settings: updated, ...state });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Voice-KI konnte nicht aktiviert werden.") }, { status: 400 });
  }
}
