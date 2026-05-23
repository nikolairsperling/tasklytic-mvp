import { NextResponse } from "next/server";
import { scoreMessageTemplate } from "@/lib/message-templates";

export async function POST(request: Request) {
  const body = await request.json() as { bodyText?: string; targetAudience?: string; category?: string };
  return NextResponse.json(scoreMessageTemplate({
    bodyText: body.bodyText ?? "",
    targetAudience: body.targetAudience,
    category: body.category
  }));
}
