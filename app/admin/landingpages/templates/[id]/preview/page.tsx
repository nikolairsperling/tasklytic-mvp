import type { Prospect } from "@prisma/client";
import React from "react";
import { VideoPreview as SharedVideoPreview } from "@/components/landing/video-preview";
import { videoPreviewPropsFromSettings } from "@/lib/landingpage/video-preview-props";
import { getGlobalLandingpageDesign, previewLead, renderLandingpageSections, type RenderedLandingpageSection } from "@/lib/landingpage-templates";
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
      <main className="min-h-screen" style={{ backgroundColor: design.backgroundColor, color: design.textColor, fontFamily: design.fontFamily }}>
        <div className="fixed left-4 top-4 z-50 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg">Vorschau</div>
        {sections.map((section) => <PreviewSection key={section.id} section={section} />)}
      </main>
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

function PreviewSection({ section }: { section: RenderedLandingpageSection }) {
  const settings = section.settings;
  const style = {
    backgroundColor: settings.backgroundColor || "transparent",
    color: settings.textColor,
    paddingTop: Number(settings.paddingTop ?? settings.spacingTop ?? 48),
    paddingBottom: Number(settings.paddingBottom ?? settings.spacingBottom ?? 48)
  };

  if (section.type === "spacer") return <div style={{ height: Number(settings.spacerHeight ?? 48) }} />;
  if (section.type === "divider") return <div className="mx-auto h-px max-w-6xl bg-slate-200" />;

  return (
    <section className="px-4 sm:px-6" style={style}>
      <div className="mx-auto max-w-6xl">
        {section.type === "header" ? <HeaderPreview settings={settings} /> : null}
        {section.type === "hero" ? <HeroPreview settings={settings} /> : null}
        {section.type === "comparison" ? <ComparisonPreview settings={settings} /> : null}
        {section.type === "faq" ? <FaqPreview settings={settings} /> : null}
        {section.type === "benefits" ? <BenefitsPreview settings={settings} /> : null}
        {section.type === "image" ? <ImagePreview settings={settings} /> : null}
        {section.type === "video" || section.type === "explainer_video" || section.type === "personal_video" ? <TemplateVideoPreview settings={settings} /> : null}
        {["cta", "textblock", "cta_button", "approach", "footer"].includes(section.type) ? <TextPreview settings={settings} /> : null}
      </div>
    </section>
  );
}

function HeaderPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="text-lg font-semibold">{settings.headerTextFallback || settings.headline || "Tasklytic"}</div>
      {settings.headerCtaText ? <PreviewButton text={settings.headerCtaText} href={settings.headerCtaUrl} /> : null}
    </div>
  );
}

function HeroPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  const eyebrow = "eyebrow" in settings && typeof settings.eyebrow === "string" ? settings.eyebrow : "";
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        {eyebrow ? <p className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-60">{eyebrow}</p> : null}
        <h1 className="text-4xl font-semibold leading-tight md:text-6xl">{settings.headline}</h1>
        {settings.subheadline ? <p className="mt-5 text-xl opacity-75">{settings.subheadline}</p> : null}
        {settings.bodyText ? <p className="mt-5 max-w-2xl text-lg leading-8 opacity-75">{settings.bodyText}</p> : null}
        {settings.ctaText ? <div className="mt-8"><PreviewButton text={settings.ctaText} href={settings.ctaUrl} /></div> : null}
      </div>
      <TemplateVideoPreview settings={settings} />
    </div>
  );
}

function TextPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      {settings.headline ? <h2 className="text-3xl font-semibold md:text-5xl">{settings.headline}</h2> : null}
      {settings.bodyText ? <p className="mt-4 text-lg leading-8 opacity-75">{settings.bodyText}</p> : null}
      {settings.ctaText ? <div className="mt-7"><PreviewButton text={settings.ctaText} href={settings.ctaUrl} /></div> : null}
    </div>
  );
}

function ComparisonPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  return (
    <div>
      <h2 className="text-3xl font-semibold md:text-5xl">{settings.headline || "Vorher und nachher"}</h2>
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <ListCard title={settings.leftTitle || "Vorher"} items={settings.leftItems ?? settings.beforeItems ?? []} />
        <ListCard title={settings.rightTitle || "Nachher"} items={settings.rightItems ?? settings.afterItems ?? []} />
      </div>
    </div>
  );
}

function FaqPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  const items = Array.isArray(settings.faqItems) ? settings.faqItems : [];
  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-3xl font-semibold">{settings.headline || "FAQ"}</h2>
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
  return <img src={settings.imageUrl} alt={settings.imageAlt || ""} className="w-full rounded-2xl object-cover shadow-panel" />;
}

function TemplateVideoPreview({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  return <SharedVideoPreview {...videoPreviewPropsFromSettings(settings)} />;
}

function PreviewButton({ text, href }: { text: string; href?: string | null }) {
  return <a href={href || "#"} className="inline-flex min-h-12 items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">{text}</a>;
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <article className="rounded-2xl bg-white p-5 text-slate-950 shadow-panel">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {safeItems.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}
