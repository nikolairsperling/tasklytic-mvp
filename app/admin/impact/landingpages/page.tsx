import { ImpactLandingpageFlow } from "@/components/admin/impact-landingpage-flow";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ImpactLandingpagesPage() {
  const [campaigns, templates, videoTemplates, prospects] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        enrollments: {
          select: { prospectId: true },
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    prisma.landingpageTemplate.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.videoTemplate.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.prospect.findMany({ orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }], take: 100 })
  ]);

  return (
    <ImpactLandingpageFlow
      campaigns={campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        prospectIds: campaign.enrollments.map((enrollment) => enrollment.prospectId)
      }))}
      prospects={prospects.map((prospect) => ({
        id: prospect.id,
        companyName: prospect.companyName,
        city: prospect.city,
        slug: prospect.slug,
        landingpageUrl: prospect.landingpageUrl
      }))}
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name
      }))}
      videoTemplates={videoTemplates.map((template) => ({
        id: template.id,
        name: template.name
      }))}
    />
  );
}
