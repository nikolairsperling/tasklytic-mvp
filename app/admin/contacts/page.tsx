import Link from "next/link";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import { ContactsTable, type ContactRow } from "@/components/admin/contacts-table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const filters = [
  { value: "all", label: "Alle" },
  { value: "with-email", label: "mit E-Mail" },
  { value: "without-email", label: "ohne E-Mail" },
  { value: "with-landingpage", label: "mit Landingpage" },
  { value: "without-landingpage", label: "ohne Landingpage" },
  { value: "contacted", label: "kontaktiert" },
  { value: "not-contacted", label: "nicht kontaktiert" }
];

type ContactsPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = (await searchParams) ?? {};
  const activeFilter = filters.some((filter) => filter.value === params.filter) ? params.filter ?? "all" : "all";
  const where = buildWhere(activeFilter);

  const [prospects, campaigns] = await Promise.all([
    prisma.prospect.findMany({
      where,
      include: {
        campaignEnrollments: {
          include: {
            campaign: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 3
        },
        enrichmentRuns: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }]
    }),
    prisma.campaign.findMany({
      where: { status: { in: ["active", "draft"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
    })
  ]);

  const contacts: ContactRow[] = prospects.map((prospect) => ({
    id: prospect.id,
    companyName: prospect.companyName,
    decisionMakerName: prospect.decisionMakerName,
    decisionMakerRole: prospect.decisionMakerRole,
    decisionMakerEmail: prospect.decisionMakerEmail,
    city: prospect.city,
    status: prospect.status,
    slug: prospect.slug,
    campaignStatus:
      prospect.campaignEnrollments.length === 0
        ? "nicht hinzugefügt"
        : prospect.campaignEnrollments.map((enrollment) => enrollment.campaign.name).join(", "),
    canAddToCampaign: Boolean(prospect.decisionMakerEmail && prospect.slug),
    enriched: prospect.enrichmentRuns.some((run) => run.status === "completed"),
    missingData: !prospect.decisionMakerEmail || !prospect.decisionMakerName || !prospect.businessFields.length
  }));

  return (
    <div>
      <PageHeader
        title="Kontakte"
        description="Kontaktfokussierte Prospect-Ansicht für E-Mail-Bereitschaft, Landingpages und Kampagnenzuordnung."
      />

      <AdminCard>
        <div className="mb-5 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Link
              key={filter.value}
              href={`/admin/contacts${filter.value === "all" ? "" : `?filter=${filter.value}`}`}
              className={`rounded-full px-3 py-2 text-xs font-medium ${
                activeFilter === filter.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        <ContactsTable contacts={contacts} campaigns={campaigns} appUrl={process.env.NEXT_PUBLIC_APP_URL} />
      </AdminCard>
    </div>
  );
}

function buildWhere(filter: string) {
  if (filter === "with-email") {
    return { decisionMakerEmail: { not: null } };
  }
  if (filter === "without-email") {
    return { decisionMakerEmail: null };
  }
  if (filter === "with-landingpage") {
    return { slug: { not: null } };
  }
  if (filter === "without-landingpage") {
    return { slug: null };
  }
  if (filter === "contacted") {
    return { status: "contacted" as const };
  }
  if (filter === "not-contacted") {
    return { NOT: { status: "contacted" as const } };
  }
  return {};
}
