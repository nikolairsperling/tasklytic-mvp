import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { readNotificationSettings, saveNotificationSettings } from "@/lib/notification-settings";

export async function GET() {
  try {
    return NextResponse.json(await readNotificationSettings());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Benachrichtigungseinstellungen konnten nicht geladen werden.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    return NextResponse.json(await saveNotificationSettings(await request.json()));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Benachrichtigungseinstellungen konnten nicht gespeichert werden.") }, { status: 400 });
  }
}
