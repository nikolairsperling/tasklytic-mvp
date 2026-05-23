import { NextResponse } from "next/server";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { defaultWorkspaceId, deleteOffer, getOffer, listOffers, parseUserOfferPayload, updateOffer } from "@/lib/user-offer";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    return NextResponse.json(await getOffer(id, defaultWorkspaceId));
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Angebot konnte nicht geladen werden.") }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = parseUserOfferPayload(await request.json());
    const offer = await updateOffer(id, payload, defaultWorkspaceId);
    console.info("[offers:update]", { offersCount: (await listOffers(defaultWorkspaceId)).length, selectedOfferId: offer.id });
    return NextResponse.json(offer);
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Angebot konnte nicht gespeichert werden.") }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    await deleteOffer(id, defaultWorkspaceId);
    console.info("[offers:delete]", { offersCount: (await listOffers(defaultWorkspaceId)).length, selectedOfferId: null });
    return new Response(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Angebot konnte nicht gelöscht werden.") }, { status: 400 });
  }
}
