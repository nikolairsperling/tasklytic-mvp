import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { testClickUpConnection } from "@/lib/integrations";

export async function POST() {
  try {
    const result = await testClickUpConnection();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error, "ClickUp Test fehlgeschlagen.") }, { status: 400 });
  }
}
