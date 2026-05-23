import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { aiCallReadinessInclude, aiCallVoiceOptions, evaluateAiCallReadiness, markDoNotCall, planAiCall } from "@/lib/ai-calls";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const patchSchema = z.object({
  action: z.enum(["plan", "do_not_call"]),
  voice: z.enum(aiCallVoiceOptions).optional()
});

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: aiCallReadinessInclude
    });
    if (!prospect) return NextResponse.json({ error: "Prospect nicht gefunden." }, { status: 404 });

    return NextResponse.json(evaluateAiCallReadiness(prospect));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "KI-Anruf konnte nicht geprüft werden.") }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    if (body.action === "do_not_call") {
      await markDoNotCall(id);
      return NextResponse.json({ ok: true, status: "call_not_interested" });
    }

    const call = await planAiCall(id, { voice: body.voice, approvedBy: "admin" });
    return NextResponse.json({ ok: true, status: call.status, plannedFor: call.plannedFor, callId: call.id });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "KI-Anruf konnte nicht aktualisiert werden.") }, { status: 400 });
  }
}
