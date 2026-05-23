import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import { CallingSettingsPanel } from "@/components/admin/calling-settings-panel";
import { readCallingSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function CallingSettingsPage() {
  const settings = await readCallingSettings();

  return (
    <div>
      <PageHeader
        title="Calling Einstellungen"
        description="Eigene Telefonnummer, Ländervorwahl und Anrufmodus verwalten."
        backButton={<AdminBackButton href="/admin/settings" />}
      />
      <AdminCard>
        <CallingSettingsPanel settings={settings} />
      </AdminCard>
    </div>
  );
}
