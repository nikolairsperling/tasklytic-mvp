import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import { EmailMailboxSettingsPanel } from "@/components/admin/email-mailbox-settings-panel";
import { getSafeMailboxSettings } from "@/lib/mailbox";
import { getSafeSmtpSettings } from "@/lib/smtp-settings";

export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  const [smtp, mailbox] = await Promise.all([
    getSafeSmtpSettings(),
    getSafeMailboxSettings()
  ]);

  return (
    <div>
      <PageHeader
        title="E-Mail Einstellungen"
        description="Absender, SMTP-Zugang und Versandlimit. Passwörter werden verschlüsselt gespeichert und nie ausgegeben."
        backButton={<AdminBackButton href="/admin/settings" />}
      />
      <AdminCard>
        <EmailMailboxSettingsPanel smtp={smtp} mailbox={mailbox} />
      </AdminCard>
    </div>
  );
}
