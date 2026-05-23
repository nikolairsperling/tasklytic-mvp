import { BrandingSettingsPanel } from "@/components/admin/branding-settings-panel";
import { readDesignSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  return <BrandingSettingsPanel settings={await readDesignSettings()} />;
}
