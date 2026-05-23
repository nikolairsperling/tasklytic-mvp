import { MessageTemplateManager } from "@/components/admin/message-template-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  const templates = await prisma.messageTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <MessageTemplateManager
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        channel: template.channel,
        bodyText: template.bodyText,
        subject: template.subject,
        category: template.category,
        status: template.status,
        targetAudience: template.targetAudience,
        tone: template.tone,
        qualityScore: template.qualityScore,
        updatedAt: template.updatedAt.toISOString()
      }))}
    />
  );
}
