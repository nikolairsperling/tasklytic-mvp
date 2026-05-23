import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { generateInboxReply, parseInboxReplyPayload } from "@/lib/inbox-replies";

export async function POST(request: Request) {
  try {
    const payload = parseInboxReplyPayload(await request.json());
    return NextResponse.json(generateInboxReply(payload));
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Antwortvorschlag konnte nicht erzeugt werden.") },
      { status: 400 }
    );
  }
}
