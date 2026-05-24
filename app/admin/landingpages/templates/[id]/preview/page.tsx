import type { Prospect } from "@prisma/client";
import { BeforeAfterSection } from "@/components/landing/BeforeAfterSection";
import { CTAButton } from "@/components/landing/CTAButton";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingPageLayout } from "@/components/landing/LandingPageLayout";
import { LandingVideo } from "@/components/landing/LandingVideo";
import { backgroundStyleFromSettings, elementStyleByField } from "@/lib/landingpage-style";
import { getGlobalLandingpageDesign, previewLead, renderLandingpageSections, type GlobalLandingpageDesign, type RenderedLandingpageSection } from "@/lib/landingpage-templates";
import { landingDesignTokens } from "@/styles/landing-design";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

const exampleLead = {
  ...previewLead,
  firstName: "Max",
  lastName: "Mustermann",
  salutation: "Herr",
  companyName: "Muster Spedition GmbH",
  city: "Bremen",
  decisionMakerName: "Max Mustermann",
  painSummary: "Viele Anfragen laufen über E-Mail, Telefon und Excel parallel.",
  calendarUrl: "https://example.com/termin",
  landingpageUrl: "https://example.com/max-mustermann",
  businessFields: ["Spedition"],
  slug: null
} as Prospect;

export default async function LandingpageTemplatePreviewPage({ params }: PageProps) {
  try {
    const { id } = await params;
    const template = await prisma.landingpageTemplate.findUnique({ where: { id } });
    if (!template) return <PreviewError title="Vorlage nicht gefunden." />;

    const design = getGlobalLandingpageDesign(template);
    const sections = renderLandingpageSections(template, exampleLead).filter((section) => section.enabled);

    return (
      <LandingPageLayout design={design}>
        <div className="fixed left-4 top-4 z-50 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg">Vorschau</div>
        {sections.map((section) => <PreviewSection key={section.id} section={section} design={design} />)}
      </LandingPageLayout>
    );
  } catch (error) {
    console.error("Landingpage template preview failed", error);
    return <PreviewError title="Vorschau konnte nicht geladen werden." />;
  }
}

function PreviewError({ title }: { title: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-950">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Bitte pruefe die Vorlage im Builder oder versuche es erneut.</p>
      </div>
    </main>
  );
}

function PreviewSection({ section, design }: { section: RenderedLandingpageSection; design: GlobalLandingpageDesign }) {
  const settings = section.settings;
  const style = {
    ...backgroundStyleFromSettings(settings, settings.backgroundColor || "transparent"),
    color: settings.textColor,
    paddingTop: Number(settings.paddingTop ?? settings.spacingTop ?? 48),
    paddingBottom: Number(settings.paddingBottom ?? settings.spacingBottom ?? 48)
  };

  if (section.type === "spacer") return <div style={{ height: Number(settings.spacerHeight ?? 48) }} />;
  if (section.type === "divider") return <div className="mx-auto h-px max-w-6xl bg-slate-200" />;

  return (
    <section className="px-5 sm:px-6" style={style}>
      <div className="mx-auto" style={{ maxWidth: landingDesignTokens.layout.maxWidth }}>
        {section.type === "header" ? <LandingNavbar settings={settings} design={design} /> : null}
        {section.type === "hero" ? <LandingHero section={section} design={design} ctaHref={settings.ctaUrl || "#"} /> : null}
        {section.type === "comparison" ? <BeforeAfterSection section={section} /> : null}
        {section.type === "faq" ? <FaqPreview settings={settings} /> : null}
        {section.type === "benefits" ? <BenefitsPreview settings={settings} /> : null}
        {section.type === "image" ? <ImagePreview settings={settings} /> : null}
        {section.type === "video" || section.type === "explainer_video" || section.type === "personal_video" ? <TemplateVideoPreview settings={settings} /> : null}
        {["cta", "textblock", "cta_button", "approach", "footer"].includes(section.type) ? <TextPreview section={section} /> : null}
      </div>
    </section>
  );
}

function TextPreview({ section }: { section: RenderedLandingpageSection }) {
  const settings = section.settings;
  return (
    <div className="mx-auto max-w-4xl text-center">
      {settings.headline ? <h2 className="break-words text-3xl font-extrabold md:text-4xl" style={elementStyleByField(section, "headline", "desktop", { fontFamily: settings.fontFamily, fontWeight: 800 })}>{settings.headline}</h2> : null}
      {settings.bodyText ? <p className="mt-4 text-lg leading-8 opacity-75" style={elementStyleByField(section, "bodyText", "desktop", { fontFamily: settings.fontFamily, lineHeight: 1.6 })}>{settings.bodyText}</p> : null}
      {settings.ctaText ? <div className="mt-7 flex justify-center"><CTAButton text={settings.ctaText} href={settings.ctaUrl} variant={settings.buttonStyle || "primary"} /></div> : null}
    </div>
  );
}

function FaqPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  const items = Array.isArray(settings.faqItems) ? settings.faqItems : [];
  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="break-words text-3xl font-extrabold">{settings.headline || "FAQ"}</h2>
      <div className="mt-5 grid gap-3">{items.map((item, index) => <ListCard key={index} title={item.question} items={[item.answer]} />)}</div>
    </div>
  );
}

function BenefitsPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  const items = Array.isArray(settings.benefitItems) ? settings.benefitItems : [];
  return <div className="grid gap-4 md:grid-cols-3">{items.map((item, index) => <ListCard key={index} title={item.title} items={[item.text]} />)}</div>;
}

function ImagePreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  if (!settings.imageUrl) return null;
  return <img src={settings.imageUrl} alt={settings.imageAlt || ""} className="w-full rounded-[20px] object-cover shadow-panel" />;
}

function TemplateVideoPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  return <LandingVideo settings={settings} compact />;
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-5 text-slate-950 shadow-panel">
      <h3 className="font-extrabold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {safeItems.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}
