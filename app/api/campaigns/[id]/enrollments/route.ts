import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { addProspectsToCampaign } from "@/lib/campaigns";
import { prospectSelectionSchema, resolveProspectSelectionIds } from "@/lib/prospect-selection";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const enrollmentPayloadSchema = prospectSelectionSchema.extend({
  prospectIds: z.array(z.string().min(1)).optional().default([])
});

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = enrollmentPayloadSchema.parse(await request.json());
    const prospectIds = payload.selectionMode === "allFiltered"
      ? await resolveProspectSelectionIds(payload)
      : [...new Set([...(payload.prospectIds ?? []), ...(payload.ids ?? [])].filter(Boolean))];
    if (prospectIds.length === 0) throw new Error("Bitte Leads auswählen.");
    const result = await addProspectsToCampaign(id, prospectIds);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Prospects konnten nicht hinzugefügt werden.") },
      { status: 400 }
    );
  }
}
