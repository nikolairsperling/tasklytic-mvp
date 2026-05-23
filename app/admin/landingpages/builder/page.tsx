import { VisualLandingpageTemplateEditor } from "@/components/admin/visual-landingpage-template-editor";
import { defaultLandingpageTemplate } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LandingpageBuilderPage() {
  const [template, prospects] = await Promise.all([
    getBuilderTemplate(),
    prisma.prospect.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
  ]);

  return <VisualLandingpageTemplateEditor template={template} prospects={prospects} backHref="/admin/landingpages/templates" />;
}

async function getBuilderTemplate() {
  const existing = await prisma.landingpageTemplate.findFirst({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
  });
  if (existing) return existing;
  return prisma.landingpageTemplate.create({ data: defaultLandingpageTemplate() });
}
