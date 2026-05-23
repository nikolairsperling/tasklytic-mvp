import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getSafeIntegrationSettings, saveClickUpSettings } from "@/lib/integrations";

export async function GET() {
  const settings = await getSafeIntegrationSettings();
  return NextResponse.json(settings.clickup);
}

export async function PATCH(request: Request) {
  try {
    await saveClickUpSettings(await request.json());
    const settings = await getSafeIntegrationSettings();
    return NextResponse.json(settings.clickup);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "ClickUp Einstellungen konnten nicht gespeichert werden.") }, { status: 400 });
  }
}
