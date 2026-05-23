import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getSafeSmtpSettings, parseSmtpSettingsPayload, saveSmtpSettings } from "@/lib/smtp-settings";

export async function GET() {
  return NextResponse.json(await getSafeSmtpSettings());
}

export async function PUT(request: Request) {
  try {
    const payload = parseSmtpSettingsPayload(await request.json());
    await saveSmtpSettings(payload);
    return NextResponse.json(await getSafeSmtpSettings());
  } catch (error) {
    console.error("SETTINGS_SAVE_FAILED", { area: "smtp", message: getErrorMessage(error, "SMTP Einstellungen konnten nicht gespeichert werden.") });
    return NextResponse.json(
      { error: getErrorMessage(error, "SMTP Einstellungen konnten nicht gespeichert werden.") },
      { status: 400 }
    );
  }
}
