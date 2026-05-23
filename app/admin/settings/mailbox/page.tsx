import { redirect } from "next/navigation";

export default function MailboxSettingsRedirectPage() {
  redirect("/admin/settings/email");
}
