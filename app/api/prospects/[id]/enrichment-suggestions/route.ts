import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { applyEnrichmentSuggestions, rejectEnrichmentSuggestions } from "@/lib/prospect-enrichment";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const payloadSchema = z.object({
  action: z.enum(["apply", "reject"]),
  fields: z.array(z.string().min(1)).optional(),
  minConfidence: z.coerce.number().int().min(0).max(100).optional(),
  overwrite: z.boolean().optional()
});

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = payloadSchema.parse(await request.json());
    if (payload.action === "reject") {
      return NextResponse.json(await rejectEnrichmentSuggestions(id, payload.fields));
    }
    return NextResponse.json(await applyEnrichmentSuggestions(id, payload.fields, {
      minConfidence: payload.minConfidence,
      overwrite: payload.overwrite
    }));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Vorschlag konnte nicht verarbeitet werden.") }, { status: 400 });
  }
}
