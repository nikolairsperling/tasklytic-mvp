import { notFound } from "next/navigation";
import React from "react";
import { VisualLandingpageTemplateEditor } from "@/components/admin/visual-landingpage-template-editor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function LandingpageTemplateBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const [template, prospects] = await Promise.all([
    prisma.landingpageTemplate.findUnique({ where: { id } }),
    prisma.prospect.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
  ]);

  if (!template) notFound();

  return <VisualLandingpageTemplateEditor template={template} prospects={prospects} backHref="/admin/landingpages/templates" />;
}
