import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { updateProspectVideoFromJob } from "@/lib/video";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const prospect = await updateProspectVideoFromJob(id);
    return NextResponse.json(prospect);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Video konnte nicht übernommen werden.") }, { status: 400 });
  }
}
