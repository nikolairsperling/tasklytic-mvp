import { AdminBackButton } from "@/components/admin/admin-back-button";
import { PushSetupCard } from "@/components/admin/pwa-client";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import { readNotificationSettings } from "@/lib/notification-settings";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const settings = await readNotificationSettings();

  return (
    <div>
      <PageHeader
        title="Benachrichtigungen"
        description="Push-Benachrichtigungen und Ereignisse für den Adminbereich steuern."
        backButton={<AdminBackButton href="/admin/settings" />}
      />
      <AdminCard>
        <PushSetupCard initialSettings={settings} />
      </AdminCard>
    </div>
  );
}
