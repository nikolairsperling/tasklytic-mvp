import { LetterTemplateWorkbench } from "@/components/admin/letter-template-workbench";
import { ensureSystemLetterTemplate } from "@/lib/letter-templates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  await ensureSystemLetterTemplate();
  const templates = await prisma.letterTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { isSystemTemplate: "desc" }, { updatedAt: "desc" }] });
  return <LetterTemplateWorkbench templates={templates} />;
}
