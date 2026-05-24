import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { adminExists, getSessionFromCookies } from "@/lib/auth";
import { readDesignSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const hasAdmin = await adminExists();
  if (await getSessionFromCookies()) redirect("/admin");
  const settings = await readDesignSettings();
  return (
    <AuthShell
      appName={settings.appName}
      logoUrl={settings.logoUrl}
      iconUrl={settings.iconUrl}
      eyebrow="Admin Login"
      title="Willkommen zurück"
      description="Melde dich an, um Kampagnen, Leads und operative Workflows zentral zu steuern."
    >
        {!hasAdmin ? (
          <AuthNotice tone="warning" title="Noch kein Admin angelegt" actionHref="/setup/admin" actionLabel="Ersten Admin erstellen">
            <p>Lege zuerst einen Admin-Zugang an. Danach ist das Setup automatisch gesperrt.</p>
          </AuthNotice>
        ) : null}
        <AuthForm mode="login" />
        {!hasAdmin ? (
          <Link href="/setup/admin" className="auth-text-link">
            Ersten Admin erstellen
          </Link>
        ) : null}
    </AuthShell>
  );
}
