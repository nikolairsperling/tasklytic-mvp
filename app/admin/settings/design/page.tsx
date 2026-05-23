import { DesignSettingsPanel } from "@/components/admin/design-settings-panel";
import { readDesignSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function DesignSettingsPage() {
  const settings = await readDesignSettings();
  return <DesignSettingsPanel settings={settings} />;
}
