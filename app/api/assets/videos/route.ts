import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assertVideoAssetUrl, resolveVideoMimeType, sanitizeVideoName, validateVideoUpload } from "@/lib/video-assets";

export async function GET() {
  return NextResponse.json(await prisma.videoAsset.findMany({
    where: {
      AND: [
        { url: { not: { startsWith: "/uploads/images/" } } },
        { mimeType: { startsWith: "video/" } }
      ]
    },
    orderBy: { createdAt: "desc" }
  }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = sanitizeVideoName(body.name);
    const url = typeof body.url === "string" ? assertVideoAssetUrl(body.url) : "";
    const originalName = sanitizeVideoName(body.originalName) || pathNameFromUrl(url) || name;
    const mimeType = resolveVideoMimeType(originalName, typeof body.mimeType === "string" ? body.mimeType : "video/mp4");
    const sizeBytes = Number(body.sizeBytes ?? 0);
    validateVideoUpload({ originalName, mimeType, sizeBytes: sizeBytes > 0 ? sizeBytes : 1 });
    if (!name || !url) throw new Error("Name und URL sind erforderlich.");
    return NextResponse.json(await prisma.videoAsset.create({
      data: {
        name,
        filename: sanitizeVideoName(body.filename) || "",
        originalName,
        url,
        mobileUrl: body.mobileUrl || undefined,
        webmUrl: body.webmUrl || undefined,
        mimeType,
        sizeBytes,
        thumbnailUrl: body.thumbnailUrl || undefined,
        description: body.description || undefined,
        category: body.category || undefined
      }
    }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Video konnte nicht erstellt werden.") }, { status: 400 });
  }
}

function pathNameFromUrl(url: string) {
  return url.split("/").pop()?.split("?")[0] ?? "";
}
