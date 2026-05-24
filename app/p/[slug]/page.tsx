import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  getActiveTemplate,
  getGlobalLandingpageDesign,
  renderLandingpageSections,
  type GlobalLandingpageDesign,
  type RenderedLandingpageSection
} from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";
import { ProspectActivityTracker } from "@/components/landing/prospect-activity-tracker";
import { CookieBanner } from "@/components/landing/cookie-banner";
import { ReportDownloadButton } from "@/components/landing/report-download-button";
import { BeforeAfterSection } from "@/components/landing/BeforeAfterSection";
import { CTAButton } from "@/components/landing/CTAButton";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingPageLayout } from "@/components/landing/LandingPageLayout";
import { LandingVideo } from "@/components/landing/LandingVideo";
import { backgroundStyleFromSettings, elementStyleByField, elementStyleByListItem } from "@/lib/landingpage-style";
import { getLegalLink, getLegalSettings } from "@/lib/legal-settings";
import { landingDesignTokens } from "@/styles/landing-design";

export const dynamic = "force-dynamic";

type LandingpageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LandingpageProps): Promise<Metadata> {
  const { slug } = await params;
  const prospect = await prisma.prospect.findUnique({ where: { slug } });
  if (!prospect) return { title: "Nicht gefunden", robots: { index: false, follow: false } };
  return {
    title: `${prospect.companyName} | Tasklytic`,
    description: `Personalisierte Tasklytic-Landingpage fuer ${prospect.companyName}.`,
    robots: { index: false, follow: false, nocache: true }
  };
}

export default async function Landingpage({ params }: LandingpageProps) {
  const { slug } = await params;
  const prospect = await prisma.prospect.findUnique({ where: { slug } });
  if (!prospect) notFound();

  try {
    const template = await getActiveTemplate(prospect);
    const design = getGlobalLandingpageDesign(template);
    const sections = renderLandingpageSections(template, prospect);
    const reportAsset = await prisma.reportAsset.findFirst({
      where: { prospectId: prospect.id },
      orderBy: { createdAt: "desc" }
    });
    const legalSettings = await getLegalSettings();
    const legalLinks = {
      imprint: getLegalLink(legalSettings, "impressum"),
      privacy: getLegalLink(legalSettings, "datenschutz"),
      cookies: getLegalLink(legalSettings, "cookies")
    };

    return (
      <LandingPageLayout design={design}>
        <ProspectActivityTracker slug={slug} page="landingpage" />
        {sections.filter((section) => section.type !== "personal_video").map((section) => (
          <LandingpageSection
            key={section.id}
            section={section}
            design={design}
            landingpageId={slug}
            slug={slug}
            reportUrl={reportAsset?.reportUrl ?? null}
          />
        ))}
        <LandingpageLegalFooter links={legalLinks} />
        <CookieBanner privacyHref={legalLinks.privacy.href} cookiesHref={legalLinks.cookies.href} />
      </LandingPageLayout>
    );
  } catch (error) {
    console.error("Landingpage render failed", error);
    return <LandingpageError title="Vorschau konnte nicht geladen werden." />;
  }
}

function LandingpageError({ title }: { title: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-950">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
    </main>
  );
}

function LandingpageLegalFooter({ links }: { links: Record<"imprint" | "privacy" | "cookies", { href: string; external: boolean }> }) {
  return (
    <footer className="px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
      <nav className="mx-auto flex flex-wrap items-center justify-center gap-4" style={{ maxWidth: landingDesignTokens.layout.maxWidth }}>
        <a href={links.imprint.href} target={links.imprint.external ? "_blank" : undefined} rel={links.imprint.external ? "noreferrer" : undefined}>Impressum</a>
        <a href={links.privacy.href} target={links.privacy.external ? "_blank" : undefined} rel={links.privacy.external ? "noreferrer" : undefined}>Datenschutz</a>
        <a href={links.cookies.href} target={links.cookies.external ? "_blank" : undefined} rel={links.cookies.external ? "noreferrer" : undefined}>Cookies</a>
      </nav>
    </footer>
  );
}

function LandingpageSection({ section, design, landingpageId, slug, reportUrl }: { section: RenderedLandingpageSection; design: GlobalLandingpageDesign; landingpageId: string; slug: string; reportUrl?: string | null }) {
  const settings = section.settings;
  const responsive = section.responsive?.desktop ?? {};
  const sectionDomId = `lp-${section.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const defaultPadding = landingDefaultSectionPadding(section.type);
  const style = {
    ...backgroundStyleFromSettings(settings, settings.backgroundColor || "transparent"),
    color: settings.textColor || design.textColor,
    paddingTop: Number(responsive.paddingTop ?? settings.paddingTop ?? settings.spacingTop ?? defaultPadding.y),
    paddingBottom: Number(responsive.paddingBottom ?? settings.paddingBottom ?? settings.spacingBottom ?? defaultPadding.y),
    paddingLeft: Number(responsive.paddingLeft ?? settings.paddingLeft ?? defaultPadding.x),
    paddingRight: Number(responsive.paddingRight ?? settings.paddingRight ?? defaultPadding.x),
    marginTop: Number(responsive.marginTop ?? settings.marginTop ?? 0),
    marginBottom: Number(responsive.marginBottom ?? settings.marginBottom ?? 0),
    width: cssLengthValue(responsive.moduleWidth) ?? "100%",
    minHeight: cssLengthValue(responsive.moduleHeight),
    borderRadius: cssLengthValue(responsive.borderRadius) ?? settings.borderRadius,
    borderColor: settings.borderColor,
    borderWidth: Number(settings.borderWidth ?? 0),
    boxShadow: settings.shadow && settings.shadow !== "none" ? settings.shadow : undefined
  };
  const visibilityClass = `${settings.visibleDesktop === false ? "lg:hidden" : ""} ${settings.visibleTablet === false ? "md:max-lg:hidden" : ""} ${settings.visibleMobile === false ? "max-md:hidden" : ""}`;

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: responsiveSectionCss(sectionDomId, section) }} />
    <section id={section.type === "comparison" ? "vergleich" : section.type === "faq" ? "faq" : sectionDomId} className={`landing-section ${visibilityClass}`} style={style}>
      {section.type === "header" ? <HeaderSection section={section} design={design} /> : null}
      {section.type === "hero" ? <HeroSection section={section} design={design} /> : null}
      {section.type === "explainer_video" ? <ExplainerSection section={section} design={design} /> : null}
      {section.type === "comparison" ? <ComparisonSection section={section} design={design} /> : null}
      {section.type === "cta" || section.type === "textblock" || section.type === "cta_button" ? <CtaSection section={section} design={design} /> : null}
      {section.type === "image" ? <ImageSection section={section} /> : null}
      {section.type === "video" ? <StandaloneVideoSection section={section} design={design} /> : null}
      {section.type === "pdf_report_download" || section.type === "print_report_cta" || section.type === "roi_report" ? <ReportSection section={section} design={design} landingpageId={landingpageId} slug={slug} reportUrl={reportUrl} /> : null}
      {section.type === "benefits" ? <BenefitsSection section={section} design={design} /> : null}
      {section.type === "divider" ? <div className="mx-auto h-px max-w-6xl bg-slate-200" /> : null}
      {section.type === "spacer" ? <div style={{ height: Number(settings.spacerHeight ?? 48) }} /> : null}
      {section.type === "approach" ? <TextSection section={section} /> : null}
      {section.type === "faq" ? <FaqSection section={section} /> : null}
      {section.type === "footer" ? <footer className="text-center text-sm opacity-70">{settings.bodyText || "Tasklytic"}</footer> : null}
    </section>
    </>
  );
}

function responsiveSectionCss(id: string, section: RenderedLandingpageSection) {
  const tablet = section.responsive?.tablet ?? {};
  const mobile = section.responsive?.mobile ?? {};
  return `
@media (max-width: 1023px) and (min-width: 768px) { #${id} { ${responsiveCssDeclarations(tablet)} } }
@media (max-width: 767px) { #${id} { ${responsiveCssDeclarations(mobile)} } }
`;
}

function responsiveCssDeclarations(values: Record<string, unknown>) {
  return [
    cssDecl("padding-top", values.paddingTop),
    cssDecl("padding-bottom", values.paddingBottom),
    cssDecl("padding-left", values.paddingLeft),
    cssDecl("padding-right", values.paddingRight),
    cssDecl("margin-top", values.marginTop),
    cssDecl("margin-bottom", values.marginBottom),
    cssDecl("width", values.moduleWidth),
    cssDecl("min-height", values.moduleHeight),
    cssDecl("border-radius", values.borderRadius)
  ].filter(Boolean).join("");
}

function cssDecl(name: string, value: unknown) {
  const normalized = cssLengthValue(value);
  return normalized ? `${name}:${normalized};` : "";
}

function cssLengthValue(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return `${value}px`;
  if (typeof value !== "string") return undefined;
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value}px` : value;
}

function landingDefaultSectionPadding(type: RenderedLandingpageSection["type"]) {
  if (type === "header") return { x: 20, y: 0 };
  if (type === "hero") return { x: 20, y: 56 };
  if (type === "spacer" || type === "divider") return { x: 20, y: 24 };
  return { x: 20, y: 48 };
}

type PublicSectionProps = {
  section: RenderedLandingpageSection;
  design: GlobalLandingpageDesign;
};

function HeaderSection({ section, design }: PublicSectionProps) {
  return <LandingNavbar settings={section.settings} design={design} />;
}

function HeroSection({ section, design }: PublicSectionProps) {
  return <LandingHero section={section} design={design} ctaHref={resolveButtonHref(section.settings)} />;
}

function ExplainerSection({ section, design }: PublicSectionProps) {
  const settings = section.settings;
  const twoColumn = settings.layout === "two_column" || settings.layout === "two_columns";
  return (
    <div className={`${twoColumn ? "grid items-center gap-8 md:grid-cols-2" : "text-center"} mx-auto`} style={{ maxWidth: landingDesignTokens.layout.maxWidth }}>
      <div className={twoColumn ? "min-w-0" : "mx-auto max-w-3xl"}>
        <h2 className="break-words text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl">{settings.headline}</h2>
        {settings.subheadline ? <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{settings.subheadline}</p> : null}
        {settings.buttonText ? <span className="mt-5 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">{settings.buttonText}</span> : null}
      </div>
      <div className={twoColumn ? "min-w-0" : "mx-auto mt-8 w-full max-w-3xl"}><LandingVideo settings={settings} compact={!twoColumn} /></div>
      {settings.ctaText ? (
        <div className={twoColumn ? "md:col-span-2 md:text-center" : "mt-8"}>
          <CTAButton href={resolveButtonHref(settings)} text={settings.ctaText} variant={settings.buttonStyle || "primary"} />
        </div>
      ) : null}
    </div>
  );
}

function ComparisonSection({ section }: PublicSectionProps) {
  return <BeforeAfterSection section={section} />;
}

function CtaSection({ section, design }: PublicSectionProps) {
  const settings = section.settings;
  const backgroundColor = settings.backgroundColor && settings.backgroundColor !== "transparent"
    ? settings.backgroundColor
    : landingDesignTokens.colors.surfaceDark;
  const textColor = settings.textColor && settings.textColor !== landingDesignTokens.colors.ink ? settings.textColor : "#ffffff";
  const headlineStyle = elementStyleByField(section, "headline", "desktop", { textColor, fontFamily: settings.fontFamily, fontWeight: 800, lineHeight: 1.15 });
  const bodyStyle = elementStyleByField(section, "bodyText", "desktop", { textColor, fontFamily: settings.fontFamily, lineHeight: 1.6 });
  return (
    <div className="mx-auto rounded-[24px] border border-slate-800/10 p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.13)] md:p-10" style={{ maxWidth: landingDesignTokens.layout.narrowWidth, backgroundColor, color: textColor, borderRadius: design.cardRadius }}>
      {settings.headline ? <h2 className="break-words text-3xl font-extrabold leading-tight md:text-4xl" style={headlineStyle}>{settings.headline}</h2> : null}
      {settings.bodyText ? <p className="mx-auto mt-4 max-w-2xl text-base leading-7 opacity-80 md:text-lg" style={bodyStyle}>{settings.bodyText}</p> : null}
      {settings.ctaText ? <div className="mt-7 flex justify-center"><CTAButton href={resolveButtonHref(settings)} text={settings.ctaText} variant={settings.buttonStyle || "secondary"} shadow={false} /></div> : null}
    </div>
  );
}

function ImageSection({ section }: { section: RenderedLandingpageSection }) {
  const settings = section.settings;
  if (!settings.imageUrl) return null;
  return <div className="mx-auto" style={{ maxWidth: landingDesignTokens.layout.maxWidth }}>{settings.headline ? <h2 className="mb-6 break-words text-3xl font-extrabold md:text-4xl" style={elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: settings.fontFamily, fontWeight: 800 })}>{settings.headline}</h2> : null}<img src={settings.imageUrl} alt={settings.imageAlt || ""} loading="lazy" decoding="async" className="w-full rounded-[20px] object-cover shadow-panel" /></div>;
}

function StandaloneVideoSection({ section, design }: PublicSectionProps) {
  const settings = section.settings;
  return <div className="mx-auto max-w-3xl text-center">{settings.headline ? <h2 className="break-words text-3xl font-extrabold md:text-4xl" style={elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: settings.fontFamily, fontWeight: 800 })}>{settings.headline}</h2> : null}<div className="mt-6"><LandingVideo settings={settings} compact /></div>{settings.ctaText ? <div className="mt-7 flex justify-center"><CTAButton href={resolveButtonHref(settings)} text={settings.ctaText} variant={settings.buttonStyle || "primary"} /></div> : null}</div>;
}

function BenefitsSection({ section, design }: PublicSectionProps) {
  const items = section.settings.benefitItems ?? [];
  return <div className="mx-auto" style={{ maxWidth: landingDesignTokens.layout.maxWidth }}><h2 className="break-words text-3xl font-extrabold md:text-4xl" style={elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: section.settings.fontFamily, fontWeight: 800 })}>{section.settings.headline || "Vorteile"}</h2><div className="mt-6 grid gap-4 md:grid-cols-3">{items.map((item, index) => <article key={`${item.title}-${index}`} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-panel" style={{ borderRadius: design.cardRadius }}><h3 className="font-extrabold text-slate-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></article>)}</div></div>;
}

function ReportSection({ section, design, landingpageId, slug, reportUrl }: PublicSectionProps & { landingpageId: string; slug: string; reportUrl?: string | null }) {
  const settings = section.settings;
  const isRoi = section.type === "roi_report";
  const title = settings.reportTitle || settings.headline || "Kurzreport herunterladen";
  const description = settings.reportDescription || settings.bodyText || "Diese Analyse können Sie auch als PDF speichern oder intern weitergeben.";
  const buttonStyle = {
    backgroundColor: landingDesignTokens.colors.primary,
    color: "#ffffff",
    borderRadius: cssLength(settings.buttonBorderRadius || landingDesignTokens.radius.button),
    padding: "14px 20px",
    boxShadow: landingDesignTokens.shadow.button
  };
  return (
    <div className="mx-auto rounded-[20px] border border-slate-200 bg-white p-5 shadow-panel md:p-8" style={{ maxWidth: landingDesignTokens.layout.narrowWidth, borderRadius: settings.borderRadius ? cssLength(settings.borderRadius) : design.cardRadius }}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {settings.reportShowIcon === false ? null : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-700" aria-hidden="true">PDF</span>}
            <h2 className="min-w-0 break-words text-2xl font-extrabold leading-tight md:text-4xl">{title}</h2>
          </div>
          {description ? <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{description}</p> : null}
          {isRoi ? <RoiSummary settings={settings} /> : null}
          <div className="mt-6">
            <ReportDownloadButton
              landingpageId={landingpageId}
              slug={slug}
              initialReportUrl={reportUrl}
              readyText="Kurzreport herunterladen"
              missingText={settings.reportButtonText || "Kurzreport generieren"}
              className="inline-flex min-h-12 w-full max-w-sm items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 sm:w-auto"
              style={buttonStyle}
            />
          </div>
        </div>
        {settings.reportShowQrCode ? (
          <div className="mx-auto grid h-32 w-32 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-950 text-[10px] font-semibold text-white">
            QR
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RoiSummary({ settings }: { settings: RenderedLandingpageSection["settings"] }) {
  const items = [
    ["Fahrzeuge", settings.roiVehicles || "25"],
    ["Disponenten", settings.roiDispatchers || "3"],
    ["Aufträge pro Tag", settings.roiOrdersPerDay || "45"],
    ["Manueller Aufwand", settings.roiManualEffort || "12 Minuten pro Auftrag"],
    ["Geschätzter Monatsverlust", settings.roiMonthlyLoss || "8.100 EUR"]
  ];
  return (
    <dl className="mt-5 grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TextSection({ section }: { section: RenderedLandingpageSection }) {
  const settings = section.settings;
  return <div className="mx-auto rounded-[20px] border border-slate-200 bg-white p-5 shadow-panel md:p-8" style={{ maxWidth: landingDesignTokens.layout.narrowWidth }}><h2 className="break-words text-2xl font-extrabold md:text-3xl" style={elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: settings.fontFamily, fontWeight: 800 })}>{settings.headline}</h2>{settings.bodyText ? <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg md:leading-8" style={elementStyleByField(section, "bodyText", "desktop", { textColor: landingDesignTokens.colors.muted, fontFamily: settings.fontFamily, lineHeight: 1.6 })}>{settings.bodyText}</p> : null}</div>;
}

function FaqSection({ section }: { section: RenderedLandingpageSection }) {
  const items = Array.isArray(section.settings.faqItems) ? section.settings.faqItems : [];
  if (items.length === 0) return null;
  const headlineStyle = faqElementStyle(section, { field: "headline" });
  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="break-words text-2xl font-extrabold md:text-3xl" style={headlineStyle}>{section.settings.headline || "FAQ"}</h2>
      <div className="mt-6 grid gap-4">{items.map((item, index) => (
        <div key={index} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-panel">
          <h3 className="font-extrabold text-slate-950" style={faqElementStyle(section, { itemIndex: index, itemKey: "question" })}>{item.question}</h3>
          <p className="mt-2 text-slate-600" style={faqElementStyle(section, { itemIndex: index, itemKey: "answer" })}>{item.answer}</p>
        </div>
      ))}</div>
    </div>
  );
}

function faqElementStyle(section: RenderedLandingpageSection, target: { field?: string; itemIndex?: number; itemKey?: "question" | "answer" }): CSSProperties {
  if (target.field) return elementStyleByField(section, target.field, "desktop", { fontFamily: section.settings.fontFamily });
  return elementStyleByListItem(section, { itemList: "faqItems", itemIndex: target.itemIndex, itemKey: target.itemKey }, "desktop", { fontFamily: section.settings.fontFamily });
}

function resolveButtonHref(settings: RenderedLandingpageSection["settings"]) {
  if (settings.buttonTargetType === "scroll_section" && settings.buttonTargetSection) return `#${settings.buttonTargetSection.replace(/^#/, "")}`;
  return settings.ctaUrl || "#";
}

function cssLength(value: string | number) {
  if (typeof value === "number") return value;
  if (/^\d+(\.\d+)?$/.test(value.trim())) return `${value}px`;
  return value;
}
