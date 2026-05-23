import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { AdminUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export { isSessionSecretConfigured, missingSessionSecretMessage } from "@/lib/env";
import { getSessionSecret } from "@/lib/env";

export const sessionCookieName = "tasklytic_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export type AdminSession = {
  userId: string;
  email: string;
  role: string;
  exp: number;
};

export function requireSessionSecret(env: NodeJS.ProcessEnv = process.env) {
  return getSessionSecret(env);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

export function signSession(user: Pick<AdminUser, "id" | "email" | "role">, now = Date.now()) {
  const payload: AdminSession = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(now / 1000) + sessionMaxAgeSeconds
  };
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", requireSessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): AdminSession | null {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  let secret: string;
  try {
    secret = requireSessionSecret();
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AdminSession;
  if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

export async function getSessionFromCookies() {
  const store = await cookies();
  return verifySessionToken(store.get(sessionCookieName)?.value);
}

export async function setSessionCookie(user: Pick<AdminUser, "id" | "email" | "role">, response?: NextResponse) {
  const options = getSessionCookieOptions();
  if (response) {
    response.cookies.set(sessionCookieName, signSession(user), options);
    return;
  }
  const store = await cookies();
  store.set(sessionCookieName, signSession(user), options);
}

export function getSessionCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(env),
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionMaxAgeSeconds
  };
}

export function shouldUseSecureSessionCookie(env: NodeJS.ProcessEnv = process.env) {
  const appUrl = env.APP_URL?.trim() ?? "";
  return env.NODE_ENV === "production" && appUrl.startsWith("https://");
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(sessionCookieName, "", {
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function adminExists() {
  return (await prisma.adminUser.count()) > 0;
}

export async function createFirstAdmin(input: { email: string; password: string; name?: string }) {
  if (await adminExists()) throw new Error("Admin Setup ist bereits abgeschlossen.");
  if (!input.name?.trim() || !input.email.trim() || !input.password) throw new Error("Bitte alle Felder ausfüllen.");
  if (input.password.length < 10) throw new Error("Passwort muss mindestens 10 Zeichen haben.");
  return prisma.adminUser.create({
    data: {
      email: normalizeAdminEmail(input.email),
      passwordHash: await hashPassword(input.password),
      name: input.name?.trim() || undefined
    }
  });
}

function base64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
