import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { generateEmailTemplateVariants, parseEmailTemplateAiPayload } from "@/lib/email-template-ai";

export async function POST(request: Request) {
  try {
    const payload = parseEmailTemplateAiPayload(await request.json());
    const result = await generateEmailTemplateVariants(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "KI-Vorlagen konnten nicht erzeugt werden.") },
      { status: 400 }
    );
  }
}
