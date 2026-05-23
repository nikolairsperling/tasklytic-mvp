import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { deleteAssetFile } from "@/lib/asset-files";

type RouteProps = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    await deleteAssetFile(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Asset konnte nicht gelöscht werden.") }, { status: 400 });
  }
}
