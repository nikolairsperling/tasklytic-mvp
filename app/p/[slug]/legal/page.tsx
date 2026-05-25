import Link from "next/link";
import { notFound } from "next/navigation";
import { CTAButton } from "@/components/landing/CTAButton";
import { FlowPageSections } from "@/components/landing/FlowPageSections";
import { LandingPageLayout } from "@/components/landing/LandingPageLayout";
import { Logo } from "@/components/landing/Logo";
import { legalTabLabel, legalTabOptions, legalTextForSettings, type LandingpageLegalTab } from "@/lib/landingpage-page-flow";
import { backgroundStyleFromSettings } from "@/lib/landingpage-style";
import { getActiveTemplate, getGlobalLandingpageDesign, renderLandingpageSections } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function LegalPage({ params, searchParams }: LegalPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const prospect = await prisma.prospect.findUnique({ where: { slug } });
  if (!prospect) notFound();

  const template = await getActiveTemplate(prospect);
  const design = getGlobalLandingpageDesign(template);
  const sections = renderLandingpageSections(template, prospect);
  const section = sections.find((item) => item.type === "legal");
  const settings = section?.settings ?? {};
  const activeTab = normalizeLegalTab(Array.isArray(query.tab) ? query.tab[0] : query.tab, settings.legalTab);
  const text = legalTextForSettings(settings, activeTab);

  return (
    <LandingPageLayout design={design}>
      <main className="min-h-screen px-5 py-8 text-slate-950" style={backgroundStyleFromSettings(settings, settings.backgroundColor || "#f6f8fb")}>
        <div className="mx-auto max-w-5xl">
          <header className="flex flex-wrap items-center justify-between gap-4 py-4">
            <Link href={`/p/${slug}`} className="inline-flex">
              <Logo src={template.headerLogoUrl || template.logoUrl} alt={template.headerLogoAlt || "Tasklytic"} text={template.headerTextFallback || "Tasklytic"} width={template.headerLogoWidth} height={template.headerLogoHeight} />
            </Link>
            <Link href={`/p/${slug}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Zurück zur Landingpage</Link>
          </header>

          <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Rechtliches</p>
            <h1 className="mt-3 break-words text-3xl font-extrabold leading-tight sm:text-5xl">{settings.headline || legalTabLabel(activeTab)}</h1>
            {settings.subheadline ? <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">{settings.subheadline}</p> : null}

            <nav className="mt-8 flex flex-wrap gap-2" aria-label="Rechtliche Unterseiten">
              {legalTabOptions.map((tab) => (
                <Link key={tab.value} href={`/p/${slug}/legal?tab=${tab.value}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab.value ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                  {tab.label}
                </Link>
              ))}
            </nav>

            {settings.legalMode === "external_link" && settings.legalUrl ? (
              <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-xl font-bold text-slate-950">Externe Rechtsseite</h2>
                <p className="mt-2 break-all text-sm text-slate-600">{settings.legalUrl}</p>
                <div className="mt-5"><CTAButton href={settings.legalUrl} text={`${legalTabLabel(activeTab)} öffnen`} /></div>
              </div>
            ) : (
              <article className="prose prose-slate mt-10 max-w-none">
                <h2>{legalTabLabel(activeTab)}</h2>
                <p className="whitespace-pre-line">{text || "Für diesen Bereich ist noch kein Rechtstext hinterlegt."}</p>
              </article>
            )}
          </section>
        </div>
      </main>
      <FlowPageSections sections={sections} page="legal" design={design} excludeTypes={["legal"]} />
    </LandingPageLayout>
  );
}

function normalizeLegalTab(value: string | undefined, fallback: LandingpageLegalTab | undefined): LandingpageLegalTab {
  const candidate = legalTabOptions.find((tab) => tab.value === value)?.value;
  return candidate ?? fallback ?? "impressum";
}
