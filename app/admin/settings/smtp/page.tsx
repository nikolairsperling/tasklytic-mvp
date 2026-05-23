import { redirect } from "next/navigation";

export default function SmtpSettingsRedirectPage() {
  redirect("/admin/settings/email");
}
