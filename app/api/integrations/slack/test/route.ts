import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { sendSlackTestMessage } from "@/lib/integrations";

export async function POST() {
  try {
    await sendSlackTestMessage();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error, "Slack Test fehlgeschlagen.") }, { status: 400 });
  }
}
