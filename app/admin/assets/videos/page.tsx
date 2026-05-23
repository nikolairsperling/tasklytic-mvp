import { VideoAssetManager } from "@/components/admin/video-asset-manager";
import { VideoTemplateManager } from "@/components/admin/video-template-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const [videos, templates] = await Promise.all([
    prisma.videoAsset.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.videoTemplate.findMany({ orderBy: { createdAt: "desc" } })
  ]);
  return (
    <div className="space-y-8">
      <VideoAssetManager initialItems={videos} />
      <VideoTemplateManager templates={templates} />
    </div>
  );
}
