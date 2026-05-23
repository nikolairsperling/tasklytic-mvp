import { NextResponse } from "next/server";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { defaultWorkspaceId, duplicateOffer } from "@/lib/user-offer";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    return NextResponse.json(await duplicateOffer(id, defaultWorkspaceId), { status: 201 });
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Angebot konnte nicht dupliziert werden.") }, { status: 400 });
  }
}
