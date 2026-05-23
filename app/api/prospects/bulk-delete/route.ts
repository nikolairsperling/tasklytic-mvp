import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { bulkDeleteSchema, normalizeBulkDeleteInput } from "@/lib/bulk-delete";
import { prospectSelectionSchema, resolveProspectSelectionIds } from "@/lib/prospect-selection";
import { prisma } from "@/lib/prisma";

const bulkDeleteSelectionSchema = prospectSelectionSchema.extend({
  confirmBulkDelete: bulkDeleteSchema.shape.confirmBulkDelete,
  typedConfirmation: bulkDeleteSchema.shape.typedConfirmation
});

export async function POST(request: Request) {
  try {
    const payload = bulkDeleteSelectionSchema.parse(await request.json());
    const ids = await resolveProspectSelectionIds(payload);
    normalizeBulkDeleteInput({
      ids,
      confirmBulkDelete: payload.confirmBulkDelete,
      typedConfirmation: payload.typedConfirmation
    });
    const result = await prisma.prospect.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ deleted: result.count, failed: Math.max(0, ids.length - result.count) });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Einträge konnten nicht gelöscht werden.") }, { status: 400 });
  }
}
