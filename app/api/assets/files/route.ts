import { NextResponse } from "next/server";
import { isAssetFileType } from "@/lib/asset-files";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  return NextResponse.json(await prisma.assetFile.findMany({
    where: isAssetFileType(type) ? { type } : undefined,
    orderBy: { createdAt: "desc" }
  }));
}
