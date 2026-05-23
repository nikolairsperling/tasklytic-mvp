import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { sendSmtpMail } from "@/lib/mailer";
import { parseTestEmailPayload } from "@/lib/settings";

export async function POST(request: Request) {
  try {
    const payload = parseTestEmailPayload(await request.json());
    const result = await sendSmtpMail({
      to: payload.to,
      subject: "Tasklytic SMTP Testmail",
      text: "Diese Testmail wurde aus den Tasklytic SMTP-Einstellungen gesendet."
    });

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Testmail konnte nicht gesendet werden.") },
      { status: 400 }
    );
  }
}
