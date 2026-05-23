import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { POST as login } from "../../app/api/auth/login/route";
import { GET as me } from "../../app/api/auth/me/route";
import { POST as setupAdmin } from "../../app/api/setup/admin/route";
import { createFirstAdmin, getSessionCookieOptions, hashPassword, isSessionSecretConfigured, missingSessionSecretMessage, signSession, verifyPassword, verifySessionToken } from "@/lib/auth";
import { getSessionSecret, warnOrFailForSessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";

beforeEach(async () => {
  process.env.SESSION_SECRET = "test-secret-with-enough-length-12345";
  await prisma.adminUser.deleteMany();
});

afterEach(async () => {
  await prisma.adminUser.deleteMany();
});

describe("admin auth", () => {
  it("login password verification works with bcrypt", async () => {
    const passwordHash = await hashPassword("correct-password");
    expect(await verifyPassword("correct-password", passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-password", passwordHash)).toBe(false);
  });

  it("redirects /admin without login to /login", async () => {
    const response = await middleware(new NextRequest("http://localhost/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("/p/[slug] stays public", async () => {
    const response = await middleware(new NextRequest("http://localhost/p/demo"));
    expect(response.status).toBe(200);
  });

  it("blocks mutating admin APIs without a session", async () => {
    const response = await middleware(new NextRequest("http://localhost/api/prospects", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("allows authenticated admin requests", async () => {
    const user = await prisma.adminUser.create({
      data: { email: "admin@example.com", passwordHash: await hashPassword("correct-password") }
    });
    const request = new NextRequest("http://localhost/admin", {
      headers: { cookie: `tasklytic_session=${signSession(user)}` }
    });
    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it("redirects authenticated /login requests to /admin", async () => {
    const user = await prisma.adminUser.create({
      data: { email: "admin@example.com", passwordHash: await hashPassword("correct-password") }
    });
    const response = await middleware(new NextRequest("http://localhost/login", {
      headers: { cookie: `tasklytic_session=${signSession(user)}` }
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin");
  });

  it("logout is represented by an expired session cookie value", async () => {
    const user = { id: "u1", email: "admin@example.com", role: "admin" };
    const token = signSession(user, Date.now() - 8 * 24 * 60 * 60 * 1000);
    const response = await middleware(new NextRequest("http://localhost/admin", {
      headers: { cookie: `tasklytic_session=${token}` }
    }));
    expect(response.status).toBe(307);
  });

  it("treats existing cookies as logged out when SESSION_SECRET is missing", async () => {
    const user = { id: "u1", email: "admin@example.com", role: "admin" };
    const token = signSession(user);
    delete process.env.SESSION_SECRET;

    expect(() => signSession(user)).toThrow("SESSION_SECRET_MISSING");
    expect(verifySessionToken(token)).toBeNull();
    const response = await middleware(new NextRequest("http://localhost/admin", {
      headers: { cookie: `tasklytic_session=${token}` }
    }));
    expect(response.status).toBe(307);
  });

  it("first admin can be created and setup is locked afterwards", async () => {
    const created = await createFirstAdmin({ email: "ADMIN@example.com", password: "correct-password", name: "Admin" });
    expect(created.email).toBe("admin@example.com");
    await expect(createFirstAdmin({ email: "second@example.com", password: "correct-password" })).rejects.toThrow("bereits abgeschlossen");
  });

  it("first admin is stored immediately with a bcrypt hash and no email verification gate", async () => {
    const response = await setupAdmin(new Request("http://localhost/api/setup/admin", {
      method: "POST",
      body: JSON.stringify({
        name: "Admin",
        email: " Admin@Example.COM ",
        password: "correct-password",
        passwordRepeat: "correct-password"
      })
    }));
    const setupCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("tasklytic_session="));
    const created = await prisma.adminUser.findUnique({ where: { email: "admin@example.com" } });

    expect(response.status).toBe(201);
    expect(setupCookie).toBeDefined();
    expect(created).toBeTruthy();
    expect(created?.passwordHash).toBeTruthy();
    expect(created?.passwordHash).not.toBe("correct-password");
    expect(await verifyPassword("correct-password", created?.passwordHash ?? "")).toBe(true);
  });

  it("created admin can log in with the stored bcrypt password hash", async () => {
    await createFirstAdmin({ email: "admin@example.com", password: "correct-password", name: "Admin" });
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: "admin@example.com" } });

    expect(user.passwordHash).not.toBe("correct-password");
    expect(await verifyPassword("correct-password", user.passwordHash)).toBe(true);
  });

  it("setup admin returns a clean SESSION_SECRET error before creating a user", async () => {
    delete process.env.SESSION_SECRET;

    const response = await setupAdmin(new Request("http://localhost/api/setup/admin", {
      method: "POST",
      body: JSON.stringify({
        name: "Admin",
        email: "admin@example.com",
        password: "correct-password",
        passwordRepeat: "correct-password"
      })
    }));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe(missingSessionSecretMessage);
    expect(await prisma.adminUser.count()).toBe(0);
  });

  it("login returns a clean SESSION_SECRET error without creating a session", async () => {
    const user = await createFirstAdmin({ email: "admin@example.com", password: "correct-password", name: "Admin" });
    expect(user.email).toBe("admin@example.com");
    delete process.env.SESSION_SECRET;

    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "correct-password"
      })
    }));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe(missingSessionSecretMessage);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it("setup admin creates a session and sets the session cookie with a valid SESSION_SECRET", async () => {
    const response = await setupAdmin(new Request("http://localhost/api/setup/admin", {
      method: "POST",
      body: JSON.stringify({
        name: "Admin",
        email: "admin@example.com",
        password: "correct-password",
        passwordRepeat: "correct-password"
      })
    }));
    const body = await response.json() as { success?: boolean; redirectTo?: string };
    const setCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("tasklytic_session="));

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe("/admin");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Secure");
    expect(await prisma.adminUser.count()).toBe(1);
  });

  it("login returns success redirect target and sets the session cookie with a valid SESSION_SECRET", async () => {
    await createFirstAdmin({ email: "admin@example.com", password: "correct-password", name: "Admin" });

    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "correct-password"
      })
    }));
    const body = await response.json() as { success?: boolean; redirectTo?: string };
    const setCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("tasklytic_session="));

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe("/admin");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Secure");
  });

  it("failed login does not create a session cookie", async () => {
    await createFirstAdmin({ email: "admin@example.com", password: "correct-password", name: "Admin" });

    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "wrong-password"
      })
    }));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("E-Mail oder Passwort ist falsch.");
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it("session cookie is secure only for https APP_URL in production", () => {
    expect(getSessionCookieOptions({ NODE_ENV: "development", APP_URL: "https://app.tasklytic.de" } as NodeJS.ProcessEnv)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false
    });
    expect(getSessionCookieOptions({ NODE_ENV: "production", APP_URL: "http://148.230.114.53:3000" } as NodeJS.ProcessEnv)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false
    });
    expect(getSessionCookieOptions({ NODE_ENV: "production", APP_URL: "https://app.tasklytic.de" } as NodeJS.ProcessEnv)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true
    });
  });

  it("setup admin can log in immediately with case-insensitive email and reach /admin", async () => {
    await setupAdmin(new Request("http://localhost/api/setup/admin", {
      method: "POST",
      body: JSON.stringify({
        name: "Admin",
        email: "admin@example.com",
        password: "correct-password",
        passwordRepeat: "correct-password"
      })
    }));

    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: " ADMIN@EXAMPLE.COM ",
        password: "correct-password"
      })
    }));
    const setCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("tasklytic_session="));
    const sessionCookie = setCookie?.split(";")[0] ?? "";
    const adminResponse = await middleware(new NextRequest("http://localhost/admin", {
      headers: { cookie: sessionCookie }
    }));

    expect(response.status).toBe(200);
    expect(setCookie).toBeDefined();
    expect(adminResponse.status).toBe(200);
  });

  it("/api/auth/me reports the logged-in user after login", async () => {
    await createFirstAdmin({ email: "admin@example.com", password: "correct-password", name: "Admin" });
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "correct-password"
      })
    }));
    const setCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("tasklytic_session="));
    const sessionCookie = setCookie?.split(";")[0] ?? "";

    const meResponse = await me(new NextRequest("http://localhost/api/auth/me", {
      headers: { cookie: sessionCookie }
    }));
    const body = await meResponse.json() as { authenticated?: boolean; userEmail?: string | null };

    expect(meResponse.status).toBe(200);
    expect(body.authenticated).toBe(true);
    expect(body.userEmail).toBe("admin@example.com");
  });

  it("validates SESSION_SECRET without exposing the value", () => {
    expect(isSessionSecretConfigured({ SESSION_SECRET: "test-secret-with-enough-length-12345" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isSessionSecretConfigured({ SESSION_SECRET: "" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isSessionSecretConfigured({ SESSION_SECRET: "short-secret" } as NodeJS.ProcessEnv)).toBe(false);
    expect(() => getSessionSecret({ SESSION_SECRET: "" } as NodeJS.ProcessEnv)).toThrow("SESSION_SECRET_MISSING");
    expect(() => getSessionSecret({ SESSION_SECRET: "short-secret" } as NodeJS.ProcessEnv)).toThrow("SESSION_SECRET_TOO_SHORT");
    expect(missingSessionSecretMessage).toBe("SESSION_SECRET fehlt. Bitte in der .env setzen und Server neu starten.");
  });

  it("fails fast only in production when SESSION_SECRET is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => warnOrFailForSessionSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow("FATAL: SESSION_SECRET missing");
    expect(() => warnOrFailForSessionSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(missingSessionSecretMessage);

    warn.mockRestore();
  });

  it("favicon and app icons exist", () => {
    expect(existsSync("public/favicon.ico")).toBe(true);
    expect(existsSync("public/icon.png")).toBe(true);
    expect(existsSync("public/apple-touch-icon.png")).toBe(true);
  });
});
