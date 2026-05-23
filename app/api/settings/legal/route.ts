import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getLegalSettings, updateLegalSettings } from "@/lib/legal-settings";

export async function GET() {
  try {
    return NextResponse.json(await getLegalSettings());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Rechtliche Einstellungen konnten nicht geladen werden.") }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const settings = await updateLegalSettings(await request.json());
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Rechtliche Einstellungen konnten nicht gespeichert werden.") }, { status: 400 });
  }
}
