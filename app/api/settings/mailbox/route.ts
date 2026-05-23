import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getSafeMailboxSettings, importMailboxSettingsFromSmtp, parseMailboxSettingsPayload, saveMailboxSettings } from "@/lib/mailbox";

export async function GET() {
  return NextResponse.json(await getSafeMailboxSettings());
}

export async function POST(request: Request) {
  return PATCH(request);
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (body?.importFromSmtp === true) {
      await importMailboxSettingsFromSmtp();
    } else {
      await saveMailboxSettings(parseMailboxSettingsPayload(body));
    }
    return NextResponse.json(await getSafeMailboxSettings());
  } catch (error) {
    console.error("SETTINGS_SAVE_FAILED", { area: "mailbox", message: getErrorMessage(error, "Mailbox Einstellungen konnten nicht gespeichert werden.") });
    return NextResponse.json(
      { error: getErrorMessage(error, "Mailbox Einstellungen konnten nicht gespeichert werden.") },
      { status: 400 }
    );
  }
}
