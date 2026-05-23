import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { parseLeadImportFile, previewLeadImport, suggestMapping } from "@/lib/lead-import";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Datei fehlt." }, { status: 400 });
    }

    const rows = parseLeadImportFile(Buffer.from(await file.arrayBuffer()), file.name);
    const detectedColumns = Object.keys(rows[0] ?? {});
    const suggestedMapping = suggestMapping(detectedColumns);
    const importPreview = await previewLeadImport(rows, suggestedMapping);

    return NextResponse.json({
      filename: file.name,
      detectedColumns,
      previewRows: rows.slice(0, 20),
      rows,
      suggestedMapping,
      importPreview
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Import-Vorschau fehlgeschlagen.") }, { status: 400 });
  }
}
