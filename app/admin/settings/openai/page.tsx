import { AdminBackButton } from "@/components/admin/admin-back-button";
import { IntegrationsPanel } from "@/components/admin/integrations-panel";
import { PageHeader } from "@/components/admin/ui";
import { getSafeIntegrationSettings } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function OpenAiSettingsPage() {
  const settings = await getSafeIntegrationSettings();
  return (
    <div>
      <PageHeader title="OpenAI" description="OpenAI API Key in den Integrationen speichern und testen." backButton={<AdminBackButton href="/admin/settings" />} />
      <IntegrationsPanel settings={settings} />
    </div>
  );
}
