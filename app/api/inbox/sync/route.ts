import { NextResponse } from "next/server";
import { getMailboxPublicError, syncInbox } from "@/lib/mailbox";

export async function POST() {
  try {
    const result = await syncInbox(50);
    return NextResponse.json(result);
  } catch (error) {
    const publicError = getMailboxPublicError(error);
    return NextResponse.json(
      { error: publicError.message, code: publicError.code },
      { status: 400 }
    );
  }
}
