import { AssetFileManager } from "@/components/admin/asset-file-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LogosPage() {
  const items = await prisma.assetFile.findMany({ where: { type: "logo" }, orderBy: { createdAt: "desc" } });
  return <AssetFileManager title="Logos" description="Logo-Dateien hochladen und in Landingpages oder Signaturen verwenden." type="logo" initialItems={items} />;
}
