import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { copilotRequestSchema, runCopilot } from "@/lib/copilot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { messages } = copilotRequestSchema.parse(await request.json());
    const reply = await runCopilot({ messages });
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Copilot-Antwort konnte nicht erzeugt werden.") },
      { status: 400 }
    );
  }
}
