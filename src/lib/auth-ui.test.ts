import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin auth UI", () => {
  it("/login renders the expected login shell and button", () => {
    const source = readFileSync("app/login/page.tsx", "utf8");

    expect(source).toContain("Tasklytic");
    expect(source).toContain("Admin Login");
    expect(source).toContain("Tasklytic Logo");
    expect(source).toContain("Noch kein Admin angelegt");
    expect(source).toContain("Ersten Admin erstellen");
    expect(source).toContain("<AuthForm mode=\"login\" />");
    expect(source).not.toContain('redirect("/setup/admin")');
  });

  it("auth form renders login and setup controls", () => {
    const source = readFileSync("src/components/auth/auth-form.tsx", "utf8");

    expect(source).toContain("E-Mail");
    expect(source).toContain("Passwort");
    expect(source).toContain("Passwort wiederholen");
    expect(source).toContain("Einloggen");
    expect(source).toContain("Admin erstellen");
    expect(source).toContain("mt-4 w-full rounded-lg bg-primary");
    expect(source).toContain("router.replace");
    expect(source).toContain("router.refresh");
    expect(source).toContain('data.redirectTo || "/admin"');
    expect(source).not.toContain("window.location.href");
  });

  it("/setup/admin shows setup form only before an admin exists and otherwise links to login", () => {
    const source = readFileSync("app/setup/admin/page.tsx", "utf8");

    expect(source).toContain("Admin wurde bereits eingerichtet");
    expect(source).toContain("Ersten Admin anlegen");
    expect(source).toContain('href="/login"');
    expect(source).toContain("<AuthForm mode=\"setup\" />");
    expect(source).toContain("flex min-h-screen flex-col justify-start");
    expect(source).toContain("mx-auto w-full max-w-md px-4 py-6");
    expect(source).not.toContain('redirect("/login")');
    expect(source).not.toContain("flex min-h-screen items-center justify-center");
  });

  it("auth API exposes user-facing error messages", () => {
    const loginRoute = readFileSync("app/api/auth/login/route.ts", "utf8");
    const setupRoute = readFileSync("app/api/setup/admin/route.ts", "utf8");

    expect(loginRoute).toContain("Bitte E-Mail und Passwort eingeben.");
    expect(loginRoute).toContain("E-Mail oder Passwort ist falsch.");
    expect(setupRoute).toContain("passwordRepeat");
    expect(setupRoute).toContain("Passwörter stimmen nicht überein.");
    expect(setupRoute).toContain("missingSessionSecretMessage");
  });
});
