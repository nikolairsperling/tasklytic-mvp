import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { recalculateAllProspects } from "@/lib/prospect-recalculate";
import { getUserOffer, parseUserOfferPayload, upsertUserOffer } from "@/lib/user-offer";

export async function GET() {
  try {
    return NextResponse.json(await getUserOffer());
  } catch (error) {
    console.error("User offer could not be loaded", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Offer konnte nicht geladen werden.") },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  return saveOffer(request);
}

export async function PATCH(request: Request) {
  return saveOffer(request);
}

async function saveOffer(request: Request) {
  try {
    const payload = parseUserOfferPayload(await request.json());
    const offer = await upsertUserOffer(payload);
    if (process.env.NODE_ENV !== "test") {
      await recalculateAllProspects();
    }
    return NextResponse.json(offer);
  } catch (error) {
    console.error("User offer could not be saved", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Offer konnte nicht gespeichert werden.") },
      { status: 400 }
    );
  }
}
