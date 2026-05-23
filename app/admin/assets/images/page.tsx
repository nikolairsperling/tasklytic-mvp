import { AssetFileManager } from "@/components/admin/asset-file-manager";
import { prisma } from "@/lib/prisma";
export const dynamic="force-dynamic";
export default async function Page(){const items=await prisma.assetFile.findMany({where:{type:"image"},orderBy:{createdAt:"desc"}});return <AssetFileManager title="Bilder" description="Bilder und Thumbnails hochladen und als URL in Landingpages, Kampagnen und Signaturen verwenden." type="image" initialItems={items}/>}
