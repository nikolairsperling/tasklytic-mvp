import { AdminBackButton } from "@/components/admin/admin-back-button";
import { LandingpageTemplateManager } from "@/components/admin/landingpage-template-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LandingpageTemplatesPage() {
  const templates = await prisma.landingpageTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <div className="mb-4">
        <AdminBackButton href="/admin/landingpages" />
      </div>
      <LandingpageTemplateManager templates={templates} />
    </div>
  );
}
