import Link from "next/link";
import { LandingpageGenerationChoice } from "@/components/admin/landingpage-generation-choice";
import { AdminCard, DataTable, PageHeader, StatusBadge } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LandingpagesPageProps = {
  searchParams?: Promise<{ generated?: string }>;
};

export default async function LandingpagesPage({ searchParams }: LandingpagesPageProps) {
  const params = (await searchParams) ?? {};
  if (params.generated === "true") {
    const prospects = await prisma.prospect.findMany({
      where: { OR: [{ landingpageUrl: { not: null } }, { slug: { not: null } }] },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        companyName: true,
        city: true,
        slug: true,
        landingpageUrl: true,
        landingpageReviewStatus: true,
        updatedAt: true
      }
    });

    return (
      <div>
        <PageHeader title="Generierte Landingpages" description={`${prospects.length.toLocaleString("de-DE")} Prospects mit Landingpage oder Slug.`} />
        <AdminCard>
          <DataTable>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="p-3">Prospect</th>
                  <th>Ort</th>
                  <th>Status</th>
                  <th>Aktualisiert</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {prospects.map((prospect) => (
                  <tr key={prospect.id}>
                    <td className="p-3 font-medium text-ink">{prospect.companyName}</td>
                    <td>{prospect.city}</td>
                    <td><StatusBadge tone={prospect.landingpageReviewStatus === "approved" ? "green" : "neutral"}>{prospect.landingpageReviewStatus}</StatusBadge></td>
                    <td className="text-slate-500">{prospect.updatedAt.toLocaleString("de-DE")}</td>
                    <td className="space-x-3">
                      <Link className="font-semibold text-blue-700 hover:text-blue-900" href={`/admin/prospects/${prospect.id}`}>Prospect</Link>
                      {prospect.landingpageUrl || prospect.slug ? (
                        <Link className="font-semibold text-blue-700 hover:text-blue-900" href={prospect.landingpageUrl ?? `/p/${prospect.slug}`}>Seite</Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </AdminCard>
      </div>
    );
  }

  return <LandingpageGenerationChoice />;
}
