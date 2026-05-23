import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { saveVideoAssetUpload, VideoUploadError } from "@/lib/video-assets";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = request.cookies;
    const session = cookieStore ? verifySessionToken(cookieStore.get(sessionCookieName)?.value) : null;
    if (cookieStore && !session) {
      return NextResponse.json({ success: false, error: "Nicht angemeldet." }, { status: 401 });
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      console.log("video upload formData keys", []);
      console.log("video upload formData file", null);
      return NextResponse.json({
        success: false,
        error: "Keine Datei unter FormData-Key file gefunden.",
        receivedKeys: []
      }, { status: 400 });
    }
    const formKeys = Array.from(formData.keys());
    const file = formData.get("file");
    console.log("video upload formData keys", formKeys);
    console.log("video upload formData file", file);
    if (file instanceof File) {
      console.log("video upload file name", file.name);
      console.log("video upload file type", file.type);
      console.log("video upload file size", file.size);
    }

    if (!(file instanceof File)) {
      return NextResponse.json({
        success: false,
        error: "Keine Datei unter FormData-Key file gefunden.",
        receivedKeys: formKeys
      }, { status: 400 });
    }

    const asset = await saveVideoAssetUpload(file);
    return NextResponse.json({
      success: true,
      id: asset.id,
      url: asset.url,
      mobileUrl: asset.mobileUrl,
      webmUrl: asset.webmUrl,
      thumbnailUrl: asset.thumbnailUrl,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      asset: {
        ...asset,
        url: asset.url,
        mobileUrl: asset.mobileUrl,
        webmUrl: asset.webmUrl,
        thumbnailUrl: asset.thumbnailUrl,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.sizeBytes
      }
    }, { status: 201 });
  } catch (error) {
    console.error("video upload failed", error);
    if (error instanceof VideoUploadError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "Video konnte nicht hochgeladen werden." }, { status: 500 });
  }
}
