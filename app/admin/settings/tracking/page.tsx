import { TrackingSettingsPanel } from "@/components/admin/tracking-settings-panel";
import { readTrackingSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function TrackingSettingsPage() {
  const settings = await readTrackingSettings();
  return <TrackingSettingsPanel settings={settings} />;
}
