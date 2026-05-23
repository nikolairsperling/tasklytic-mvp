import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { readTrackingSettings, saveTrackingSettings } from "@/lib/app-settings";

export async function GET() {
  try {
    return NextResponse.json(await readTrackingSettings());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Tracking Einstellungen konnten nicht gelesen werden.") }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    return NextResponse.json(await saveTrackingSettings(await request.json()));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Tracking Einstellungen konnten nicht gespeichert werden.") }, { status: 400 });
  }
}
