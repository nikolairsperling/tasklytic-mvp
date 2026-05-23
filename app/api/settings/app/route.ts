import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { readAppSettings, saveAppSettings } from "@/lib/app-settings";

export async function GET() {
  try {
    return NextResponse.json(await readAppSettings());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "App Einstellungen konnten nicht gelesen werden.") }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await saveAppSettings(body));
  } catch (error) {
    console.error("SETTINGS_SAVE_FAILED", { area: "app", message: getErrorMessage(error, "App Einstellungen konnten nicht gespeichert werden.") });
    return NextResponse.json({ error: getErrorMessage(error, "App Einstellungen konnten nicht gespeichert werden.") }, { status: 400 });
  }
}
