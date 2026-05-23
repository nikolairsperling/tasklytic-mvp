import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { confirmLeadImport, importableProspectFields } from "@/lib/lead-import";

const payloadSchema = z.object({
  filename: z.string().default("Import"),
  rows: z.array(z.record(z.string())).min(1),
  mapping: z.record(z.union([z.enum(importableProspectFields), z.literal("")])).default({}),
  duplicateMode: z.enum(["skip", "enrich", "overwrite", "create"]).optional(),
  skipDuplicates: z.boolean().default(true),
  leadListId: z.string().trim().optional().nullable().transform((value) => value || null)
});

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    console.info("IMPORT_START", { filename: payload.filename, rows: payload.rows.length });
    const batch = await confirmLeadImport(payload);
    const duplicateMode = payload.duplicateMode ?? (payload.skipDuplicates ? "skip" : "overwrite");
    return NextResponse.json({
      success: true,
      batchId: batch.id,
      created: batch.createdCount,
      updated: batch.updatedCount,
      skipped: batch.skippedCount,
      failed: batch.invalidCount,
      duplicates: batch.duplicateCount,
      imported: batch.createdCount + batch.updatedCount,
      skippedDuplicates: duplicateMode === "skip" ? batch.duplicateCount : 0,
      warnings: batch.importWarnings.map((warning) => ({ row: warning.row, field: warning.field, message: warning.message })),
      errors: batch.importErrors.map((error) => ({ row: error.row, field: error.field, message: error.message })),
      fatalErrors: batch.importErrors.map((error) => ({ row: error.row, field: error.field, message: error.message }))
    }, { status: 200 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    console.error("IMPORT_FAILED", { status, message: getErrorMessage(error, "Import fehlgeschlagen.") });
    return NextResponse.json({ success: false, error: getErrorMessage(error, "Import fehlgeschlagen.") }, { status });
  }
}
