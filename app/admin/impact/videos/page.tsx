import { ImpactVideoWorkflow } from "@/components/admin/impact-video-workflow";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ImpactVideosPage() {
  const [campaigns, prospects, templates, jobs] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, include: { enrollments: { include: { prospect: true } } } }),
    prisma.prospect.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.videoTemplate.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.videoGenerationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { prospect: { select: { companyName: true } }, campaign: { select: { name: true } }, videoTemplate: { select: { name: true } } }
    })
  ]);

  return <ImpactVideoWorkflow campaigns={campaigns} prospects={prospects} templates={templates} jobs={jobs} />;
}
