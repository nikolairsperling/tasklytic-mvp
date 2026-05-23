import { AdminBackButton } from "@/components/admin/admin-back-button";
import { TargetGroupManager } from "@/components/admin/target-group-manager";
import { PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TargetGroupsPage() {
  const targetGroups = await prisma.targetGroup.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="max-w-7xl">
      <PageHeader
        title="Zielgruppen"
        description="ICP Kriterien, Pain-Logik und Ansprache pro Zielgruppe verwalten."
        backButton={<AdminBackButton href="/admin/prospects" />}
      />
      <TargetGroupManager initialTargetGroups={targetGroups.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        industryKeywords: item.industryKeywords,
        painKeywords: item.painKeywords,
        icpRules: item.icpRules,
        emailTone: item.emailTone,
        landingpageStyle: item.landingpageStyle,
        videoStyle: item.videoStyle
      }))} />
    </div>
  );
}
