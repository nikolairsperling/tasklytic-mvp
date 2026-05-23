import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { readDesignSettings, saveDesignSettings } from "@/lib/app-settings";

export async function GET() {
  try {
    return NextResponse.json(await readDesignSettings());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Design Einstellungen konnten nicht gelesen werden.") }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    return NextResponse.json(await saveDesignSettings(await request.json()));
  } catch (error) {
    console.error("SETTINGS_SAVE_FAILED", { area: "design", message: getErrorMessage(error, "Design Einstellungen konnten nicht gespeichert werden.") });
    return NextResponse.json({ error: getErrorMessage(error, "Design Einstellungen konnten nicht gespeichert werden.") }, { status: 400 });
  }
}
