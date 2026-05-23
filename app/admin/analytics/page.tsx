import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { PageHeader } from "@/components/admin/ui";
import { getAnalyticsFilterOptions, getAnalyticsOverview, parseAnalyticsFilters } from "@/lib/analytics-overview";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) urlParams.set(key, value);
  }
  const filters = parseAnalyticsFilters(urlParams);
  const [overview, options] = await Promise.all([
    getAnalyticsOverview(filters),
    getAnalyticsFilterOptions()
  ]);

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="Analytics"
        description="Kampagnen, Leads und Landingpages visuell auswerten."
      />
      <AnalyticsDashboard overview={overview} filters={filters} options={options} />
    </div>
  );
}
