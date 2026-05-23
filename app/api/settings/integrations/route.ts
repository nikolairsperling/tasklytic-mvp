import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getSafeIntegrationSettings, saveClickUpSettings, saveOpenAiSettings, saveSlackSettings } from "@/lib/integrations";

export async function GET() {
  return NextResponse.json(await getSafeIntegrationSettings());
}

export async function POST(request: Request) {
  return saveIntegration(request);
}

export async function PATCH(request: Request) {
  return saveIntegration(request);
}

async function saveIntegration(request: Request) {
  try {
    const body = await request.json();
    if (body.type === "slack") {
      await saveSlackSettings(body);
    } else if (body.type === "clickup") {
      await saveClickUpSettings(body);
    } else if (body.type === "openai") {
      await saveOpenAiSettings(body);
    } else {
      throw new Error("Unbekannter Integrationstyp.");
    }

    return NextResponse.json(await getSafeIntegrationSettings());
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Integration konnte nicht gespeichert werden.") },
      { status: 400 }
    );
  }
}
