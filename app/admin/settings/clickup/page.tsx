import { AdminBackButton } from "@/components/admin/admin-back-button";
import { ClickUpSettingsPanel } from "@/components/admin/clickup-settings-panel";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import { getSafeIntegrationSettings } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function ClickUpSettingsPage() {
  const settings = await getSafeIntegrationSettings();
  return (
    <div>
      <PageHeader title="ClickUp" description="ClickUp API Token und Ziel-Liste für Aufgabenübergabe konfigurieren." backButton={<AdminBackButton href="/admin/settings" />} />
      <AdminCard>
        <ClickUpSettingsPanel settings={settings.clickup} />
      </AdminCard>
    </div>
  );
}
