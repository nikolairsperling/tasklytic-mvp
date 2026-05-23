import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { startVideoGeneration } from "@/lib/video";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const job = await startVideoGeneration(id);
    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Video-Job konnte nicht gestartet werden.") }, { status: 400 });
  }
}
