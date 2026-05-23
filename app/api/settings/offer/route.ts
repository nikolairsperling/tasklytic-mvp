import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { recalculateAllProspects } from "@/lib/prospect-recalculate";
import { defaultWorkspaceId, getUserOffer, parseUserOfferPayload, safeDatabaseUrlForLog, upsertUserOffer } from "@/lib/user-offer";

export async function GET() {
  try {
    const offer = await getUserOffer(defaultWorkspaceId);
    logOfferAccess("GET", Boolean(offer));
    return NextResponse.json(offer);
  } catch (error) {
    console.error("Offer settings could not be loaded", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Angebot konnte nicht geladen werden.") },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = parseUserOfferPayload(await request.json());
    const offer = await upsertUserOffer(payload, defaultWorkspaceId);
    logOfferAccess("PATCH", true);
    if (process.env.NODE_ENV !== "test") {
      await recalculateAllProspects();
    }
    return NextResponse.json(offer);
  } catch (error) {
    console.error("Offer settings could not be saved", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Angebot konnte nicht gespeichert werden.") },
      { status: 400 }
    );
  }
}

function logOfferAccess(method: "GET" | "PATCH", found: boolean) {
  console.info("[settings/offer]", {
    method,
    offerFound: found,
    workspaceId: defaultWorkspaceId,
    databaseUrl: safeDatabaseUrlForLog()
  });
}
