import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { createOffer, defaultWorkspaceId, listOffers, parseUserOfferPayload } from "@/lib/user-offer";

export async function GET() {
  try {
    const offers = await listOffers(defaultWorkspaceId);
    console.info("[offers]", { count: offers.length, defaultOfferId: offers.find((offer) => offer.isDefault)?.id ?? null });
    return NextResponse.json(offers);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Angebote konnten nicht geladen werden.") }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = parseUserOfferPayload(await request.json());
    const offer = await createOffer(payload, defaultWorkspaceId);
    console.info("[offers:create]", { offersCount: (await listOffers(defaultWorkspaceId)).length, selectedOfferId: offer.id });
    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Angebot konnte nicht erstellt werden.") }, { status: 400 });
  }
}
