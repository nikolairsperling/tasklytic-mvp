import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { importableProspectFields, previewLeadImport } from "@/lib/lead-import";

const payloadSchema = z.object({
  rows: z.array(z.record(z.string())).default([]),
  mapping: z.record(z.union([z.enum(importableProspectFields), z.literal("")])).default({}),
  duplicateMode: z.enum(["skip", "enrich", "overwrite", "create"]).default("skip")
});

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    return NextResponse.json(await previewLeadImport(payload.rows, payload.mapping, payload.duplicateMode));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Import-Vorschau fehlgeschlagen.") }, { status: 400 });
  }
}
