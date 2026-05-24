import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { readDesignSettings } from "@/lib/app-settings";
import { adminExists } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupAdminPage() {
  const hasAdmin = await adminExists();
  const settings = await readDesignSettings();
  return (
    <AuthShell
      appName={settings.appName}
      logoUrl={settings.logoUrl}
      iconUrl={settings.iconUrl}
      eyebrow="Admin Setup"
      title={hasAdmin ? "Admin wurde bereits eingerichtet" : "Ersten Admin anlegen"}
      description={hasAdmin ? "Die Ersteinrichtung ist gesperrt, weil bereits ein AdminUser existiert." : "Dieses Setup ist nur verfügbar, solange kein AdminUser existiert."}
    >
      {hasAdmin ? (
        <>
          <AuthNotice tone="info" title="Setup ist gesperrt">
            <p>Zum Schutz der Installation können weitere Admins nur im geschützten Admin-Bereich verwaltet werden.</p>
          </AuthNotice>
          <Link href="/login" className="auth-primary-button">
            Zu /login
          </Link>
        </>
      ) : (
        <AuthForm mode="setup" />
      )}
    </AuthShell>
  );
}
