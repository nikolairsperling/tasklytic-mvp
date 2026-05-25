import Link from "next/link";
import { notFound } from "next/navigation";
import { CTAButton } from "@/components/landing/CTAButton";
import { FlowPageSections } from "@/components/landing/FlowPageSections";
import { LandingPageLayout } from "@/components/landing/LandingPageLayout";
import { Logo } from "@/components/landing/Logo";
import { backgroundStyleFromSettings } from "@/lib/landingpage-style";
import { getActiveTemplate, getGlobalLandingpageDesign, renderLandingpageSections } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ThankYouPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ThankYouPage({ params }: ThankYouPageProps) {
  const { slug } = await params;
  const prospect = await prisma.prospect.findUnique({ where: { slug } });
  if (!prospect) notFound();

  const template = await getActiveTemplate(prospect);
  const design = getGlobalLandingpageDesign(template);
  const sections = renderLandingpageSections(template, prospect);
  const section = sections.find((item) => item.type === "thank_you");
  const settings = section?.settings ?? {};
  const ctaHref = settings.ctaUrl && !settings.ctaUrl.includes("{{") ? settings.ctaUrl : `/p/${slug}`;

  return (
    <LandingPageLayout design={design}>
      <main
        className="grid min-h-[80vh] place-items-center px-5 py-10 text-center text-slate-950"
        style={backgroundStyleFromSettings(settings, settings.backgroundColor || "#f6f8fb")}
      >
        <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel sm:p-10">
          <Link href={`/p/${slug}`} className="mx-auto inline-flex justify-center">
            <Logo src={template.headerLogoUrl || template.logoUrl} alt={template.headerLogoAlt || "Tasklytic"} text={template.headerTextFallback || "Tasklytic"} width={template.headerLogoWidth} height={template.headerLogoHeight} />
          </Link>
          <div className="mx-auto mt-8 grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-4xl font-bold text-emerald-700">✓</div>
          <h1 className="mt-8 break-words text-3xl font-extrabold leading-tight sm:text-5xl">{settings.headline || "Termin erfolgreich gebucht!"}</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">{settings.bodyText || "Vielen Dank für die Buchung. Die Bestätigungsmail mit allen Termindetails wird in Kürze versendet."}</p>
          {settings.ctaText ? <div className="mt-8 flex justify-center"><CTAButton href={ctaHref} text={settings.ctaText} variant={settings.buttonStyle || "primary"} /></div> : null}
        </div>
      </main>
      <FlowPageSections sections={sections} page="thank_you" design={design} excludeTypes={["thank_you"]} />
    </LandingPageLayout>
  );
}
