import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { testOpenAiConnection } from "@/lib/integrations";

export async function POST() {
  try {
    return NextResponse.json(await testOpenAiConnection());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "OpenAI Testverbindung fehlgeschlagen.") }, { status: 400 });
  }
}
