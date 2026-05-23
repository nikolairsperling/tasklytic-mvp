import { NextResponse } from "next/server";
import { createFirstAdmin, getSessionCookieOptions, missingSessionSecretMessage, normalizeAdminEmail, setSessionCookie } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api";
import { getSessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { email?: string; password?: string; passwordRepeat?: string; name?: string } | null;
    const adminCount = await prisma.adminUser.count();
    console.info("[setup.admin]", { adminCount });
    if (adminCount > 0) {
      return NextResponse.json({ error: "Admin Setup ist bereits abgeschlossen." }, { status: 400 });
    }
    if (!body?.name?.trim() || !body.email?.trim() || !body.password || !body.passwordRepeat) {
      return NextResponse.json({ error: "Bitte alle Felder ausfüllen." }, { status: 400 });
    }
    if (body.password !== body.passwordRepeat) {
      return NextResponse.json({ error: "Passwörter stimmen nicht überein." }, { status: 400 });
    }
    try {
      getSessionSecret();
    } catch {
      return NextResponse.json({ error: missingSessionSecretMessage }, { status: 500 });
    }
    const user = await createFirstAdmin({
      email: body.email,
      password: body.password,
      name: body.name
    });
    console.info("[setup.admin]", { createdAdminEmail: normalizeAdminEmail(user.email) });
    const response = NextResponse.json({ success: true, redirectTo: "/admin" }, { status: 201 });
    await setSessionCookie(user, response);
    console.info("[setup.admin.response]", {
      status: 201,
      success: true,
      redirectTo: "/admin",
      sessionCookieSet: response.headers.getSetCookie().some((cookie) => cookie.startsWith("tasklytic_session=")),
      sessionCookieSecure: getSessionCookieOptions().secure
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Admin konnte nicht erstellt werden.") }, { status: 400 });
  }
}
