import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { readCallingSettings, saveCallingSettings } from "@/lib/app-settings";

export async function GET() {
  try {
    return NextResponse.json(await readCallingSettings());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Calling Einstellungen konnten nicht gelesen werden.") }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await saveCallingSettings(body));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Calling Einstellungen konnten nicht gespeichert werden.") }, { status: 400 });
  }
}
