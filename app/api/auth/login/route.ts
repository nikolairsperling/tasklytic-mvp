import { NextResponse } from "next/server";
import { getSessionCookieOptions, missingSessionSecretMessage, normalizeAdminEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { getSessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = normalizeAdminEmail(body?.email ?? "");
  const password = body?.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "Bitte E-Mail und Passwort eingeben." }, { status: 400 });

  const user = await prisma.adminUser.findUnique({ where: { email } });
  const passwordMatch = user ? await verifyPassword(password, user.passwordHash) : false;
  console.info("[auth.login]", {
    loginEmail: email,
    userFound: Boolean(user),
    passwordMatch
  });

  if (!user || !passwordMatch) {
    return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
  }
  try {
    getSessionSecret();
  } catch {
    return NextResponse.json({ error: missingSessionSecretMessage }, { status: 500 });
  }

  const response = NextResponse.json({ success: true, redirectTo: "/admin" });
  await setSessionCookie(user, response);
  console.info("[auth.login.response]", {
    status: 200,
    success: true,
    redirectTo: "/admin",
    sessionCookieSet: response.headers.getSetCookie().some((cookie) => cookie.startsWith("tasklytic_session=")),
    sessionCookieSecure: getSessionCookieOptions().secure
  });
  return response;
}
