import { NextResponse } from "next/server";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { defaultWorkspaceId, setDefaultOffer } from "@/lib/user-offer";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    return NextResponse.json(await setDefaultOffer(id, defaultWorkspaceId));
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Standard-Angebot konnte nicht gesetzt werden.") }, { status: 400 });
  }
}
