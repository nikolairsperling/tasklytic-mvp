import { LeadListManager } from "@/components/admin/lead-list-manager";
import { PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadListsPage() {
  const [lists, targetGroups] = await Promise.all([
    prisma.leadList.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        targetGroup: { select: { id: true, name: true } },
        members: {
          orderBy: { createdAt: "desc" },
          include: {
            prospect: {
              select: { id: true, companyName: true, decisionMakerName: true, decisionMakerEmail: true, companyEmail: true, status: true }
            }
          }
        }
      }
    }),
    prisma.targetGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
  ]);

  return (
    <div className="max-w-7xl">
      <PageHeader title="Leadlisten" description="Segmente erstellen, Zielgruppen zuordnen und zugewiesene Leads prüfen." />
      <LeadListManager
        initialLists={lists.map((list) => ({
          id: list.id,
          name: list.name,
          description: list.description,
          targetGroupId: list.targetGroupId,
          targetGroup: list.targetGroup,
          members: list.members.map((member) => ({
            id: member.id,
            prospect: member.prospect
          }))
        }))}
        targetGroups={targetGroups}
      />
    </div>
  );
}
