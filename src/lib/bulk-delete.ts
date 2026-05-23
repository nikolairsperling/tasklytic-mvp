import { z } from "zod";

export const bulkDeleteTypedConfirmation = "LÖSCHEN";
export const bulkDeleteHardConfirmationThreshold = 50;

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Mindestens eine ID ist erforderlich."),
  confirmBulkDelete: z.boolean().optional().default(false),
  typedConfirmation: z.string().optional()
});

export type BulkDeleteResult = {
  deleted: number;
  failed: number;
};

export function normalizeBulkDeleteInput(input: z.infer<typeof bulkDeleteSchema>) {
  const ids = [...new Set(input.ids)];
  if (ids.length === 0) {
    throw new Error("Mindestens eine ID ist erforderlich.");
  }
  if (ids.length > bulkDeleteHardConfirmationThreshold) {
    if (!input.confirmBulkDelete || input.typedConfirmation !== bulkDeleteTypedConfirmation) {
      throw new Error(`Mehr als ${bulkDeleteHardConfirmationThreshold} Leads dürfen nur mit harter Bestätigung gelöscht werden.`);
    }
  }
  return {
    ids,
    confirmBulkDelete: input.confirmBulkDelete,
    typedConfirmation: input.typedConfirmation
  };
}
