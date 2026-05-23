import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { createClickUpTask } from "@/lib/integrations";

export async function POST() {
  try {
    const result = await createClickUpTask({
      name: "Tasklytic Test-Task",
      description: "Diese Aufgabe wurde aus den Tasklytic ClickUp-Einstellungen erstellt."
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error, "ClickUp Test-Task fehlgeschlagen.") }, { status: 400 });
  }
}
