import { AssetListManager } from "@/components/admin/asset-list-manager";
import { CONNECTED_ACCOUNT_TYPES } from "@/lib/connected-accounts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await prisma.connectedAccount.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AssetListManager
      title="Verbundene Accounts"
      description="SMTP, Mailbox, Slack, ClickUp, OpenAI, HeyGen und Custom Accounts."
      endpoint="/api/assets/accounts"
      items={items}
      itemLabel="Account"
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "type", label: "Typ", options: CONNECTED_ACCOUNT_TYPES.map((type) => ({ label: type, value: type })), required: true },
        { name: "provider", label: "Provider" },
        { name: "notes", label: "Notizen", textarea: true }
      ]}
    />
  );
}
