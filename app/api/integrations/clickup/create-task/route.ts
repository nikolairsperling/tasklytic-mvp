import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { createClickUpTask } from "@/lib/integrations";

const payloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    const result = await createClickUpTask(payload);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error, "ClickUp Task fehlgeschlagen.") }, { status: 400 });
  }
}
