import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { isAssetFileType, saveAssetUpload } from "@/lib/asset-files";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const type = formData.get("type");
    const file = formData.get("file");

    if (!isAssetFileType(type)) {
      throw new Error("Ungültiger Asset-Typ.");
    }
    if (!(file instanceof File)) {
      throw new Error("Datei fehlt.");
    }

    const asset = await saveAssetUpload({ type, file });
    return NextResponse.json({
      ...asset,
      url: asset.publicUrl,
      filename: asset.fileName,
      mimeType: asset.mimeType
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Upload fehlgeschlagen.") }, { status: 400 });
  }
}
