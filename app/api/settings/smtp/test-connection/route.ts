import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { verifySmtpConnection } from "@/lib/mailer";

export async function POST() {
  try {
    await verifySmtpConnection();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "SMTP Verbindung fehlgeschlagen.") },
      { status: 400 }
    );
  }
}
