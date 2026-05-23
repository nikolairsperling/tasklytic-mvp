import { NextResponse } from "next/server";
import { generateMessageTemplateAi, type MessageAiAction } from "@/lib/message-template-ai";

const allowedActions = new Set([
  "rewrite",
  "shorten",
  "more_personal",
  "more_b2b",
  "linkedin",
  "whatsapp",
  "email_subject",
  "follow_up",
  "objection",
  "abc_variants",
  "new_template"
]);

export async function POST(request: Request) {
  const body = await request.json() as Record<string, string>;
  const action = allowedActions.has(body.action) ? body.action as MessageAiAction : "rewrite";
  const result = await generateMessageTemplateAi(action, body);
  return NextResponse.json(result);
}
