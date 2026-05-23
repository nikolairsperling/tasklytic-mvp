import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import { IntegrationsPanel } from "@/components/admin/integrations-panel";
import { getSafeIntegrationSettings } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
  const settings = await getSafeIntegrationSettings();
  return (
    <div className="w-full max-w-full overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <PageHeader
        title="Integrationen"
        description="Slack Incoming Webhook und ClickUp API Token vorbereiten. Keine OAuth- oder Massensync-Funktionen in V1."
        backButton={<AdminBackButton href="/admin/settings" />}
      />
      <AdminCard className="w-full max-w-full overflow-hidden">
        <IntegrationsPanel settings={settings} />
      </AdminCard>
    </div>
  );
}
