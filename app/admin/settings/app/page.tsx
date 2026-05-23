import { headers } from "next/headers";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AppUpdateCheckButton } from "@/components/app-version-client";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";
import { readAppSettings } from "@/lib/app-settings";
import { getPublicAppUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppSettingsPage() {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const currentUrl = host ? `${proto}://${host}` : null;
  const publicAppUrl = getPublicAppUrl();
  const appSettings = await readAppSettings();

  return (
    <div>
      <PageHeader
        title="App Einstellungen"
        description="Aktuelle öffentliche URLs und Betriebsnotizen für das Outreach-Dashboard."
        backButton={<AdminBackButton href="/admin/settings" />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">PUBLIC_APP_URL</h2>
              <p className="mt-2 break-words text-sm text-slate-600">{publicAppUrl ?? "nicht gesetzt"}</p>
              <p className="mt-3 text-xs text-slate-500">
                Gelesen aus `PUBLIC_APP_URL` oder `NEXT_PUBLIC_APP_URL`.
              </p>
            </div>
            <StatusBadge tone={publicAppUrl ? "green" : "amber"}>{publicAppUrl ? "gesetzt" : "fehlt"}</StatusBadge>
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Aktuelle Server-URL</h2>
          <p className="mt-2 break-words text-sm text-slate-600">{currentUrl ?? "nicht verfügbar"}</p>
          <p className="mt-3 text-xs text-slate-500">
            Abgeleitet aus den eingehenden Request-Headern.
          </p>
        </AdminCard>
      </div>

      <AdminCard className="mt-4">
        <h2 className="text-lg font-semibold text-ink">Admin Theme</h2>
        <p className="mt-2 text-sm text-slate-600">
          Gespeicherter Modus: <span className="font-medium text-ink">{appSettings.themeMode}</span>. Umschalten kannst du global in der Topbar.
        </p>
      </AdminCard>

      <AdminCard className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">App-Aktualisierung</h2>
            <p className="mt-2 text-sm text-slate-600">
              Prüft die lokale Version gegen die Server-Version aus /version.json.
            </p>
          </div>
          <AppUpdateCheckButton />
        </div>
      </AdminCard>

      <AdminCard className="mt-4">
        <h2 className="text-lg font-semibold text-ink">Domain und HTTPS</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Domain, HTTPS und produktive Base-URL sollten später sauber über Hosting, Reverse Proxy und DNS
          eingerichtet werden. Diese Seite schreibt keine Umgebungsvariablen und verändert keine Infrastruktur.
        </p>
      </AdminCard>
    </div>
  );
}
