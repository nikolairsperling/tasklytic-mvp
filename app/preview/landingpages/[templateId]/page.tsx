import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ templateId: string }> };

export default async function LandingpageTemplatePreviewAliasPage({ params }: PageProps) {
  const { templateId } = await params;
  redirect(`/admin/landingpages/templates/${templateId}/preview`);
}
