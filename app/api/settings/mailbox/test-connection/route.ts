import { NextResponse } from "next/server";
import { getMailboxPublicError, testMailboxConnection } from "@/lib/mailbox";

export async function POST() {
  try {
    await testMailboxConnection();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const publicError = getMailboxPublicError(error);
    return NextResponse.json(
      { ok: false, error: publicError.message, code: publicError.code },
      { status: 400 }
    );
  }
}
