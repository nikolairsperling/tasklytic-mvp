import { redirect } from "next/navigation";

export default function NewCampaignPage() {
  redirect("/admin/campaigns?tab=neu");
}
