import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  getActiveTemplate,
  getGlobalLandingpageDesign,
  renderLandingpageSections,
  type BuilderElementStyle,
  type GlobalLandingpageDesign,
  type RenderedLandingpageSection
} from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";
import { ProspectActivityTracker } from "@/components/landing/prospect-activity-tracker";
import { CookieBanner } from "@/components/landing/cookie-banner";
import { ReportDownloadButton } from "@/components/landing/report-download-button";
import { VideoPreview } from "@/components/landing/video-preview";
import { videoPreviewPropsFromSettings } from "@/lib/landingpage/video-preview-props";
import { getLegalLink, getLegalSettings } from "@/lib/legal-settings";

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
      <main className="min-h-screen" style={{ backgroundColor: design.backgroundColor, color: design.textColor, fontFamily: design.fontFamily }}>
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
      </main>
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
    <footer className="px-4 py-8 text-center text-sm sm:px-6">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 opacity-75">
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
  const style = {
    backgroundColor: settings.backgroundColor || "transparent",
    color: settings.textColor || design.textColor,
    paddingTop: Number(responsive.paddingTop ?? settings.paddingTop ?? settings.spacingTop ?? (section.type === "header" ? 0 : 48)),
    paddingBottom: Number(responsive.paddingBottom ?? settings.paddingBottom ?? settings.spacingBottom ?? (section.type === "header" ? 0 : 48)),
    paddingLeft: Number(responsive.paddingLeft ?? settings.paddingLeft ?? 16),
    paddingRight: Number(responsive.paddingRight ?? settings.paddingRight ?? 16),
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
    <section id={section.type === "comparison" ? "vergleich" : section.type === "faq" ? "faq" : sectionDomId} className={`px-4 sm:px-6 ${visibilityClass}`} style={style}>
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

type PublicSectionProps = {
  section: RenderedLandingpageSection;
  design: GlobalLandingpageDesign;
};

function HeaderSection({ section, design }: PublicSectionProps) {
  const settings = section.settings;
  const centered = settings.headerLogoPosition === "center" || settings.headerAlignment === "center";
  return (
    <div className={`mx-auto flex max-w-6xl flex-wrap items-center gap-3 py-4 ${centered ? "justify-center" : "justify-between"}`}>
      <a href={settings.headerCtaUrl || "#"} className="min-w-0 text-lg font-semibold">
        {settings.headerLogoUrl || settings.logoUrl ? (
          <img src={settings.headerLogoUrl || settings.logoUrl || ""} alt={settings.headerLogoAlt || "Tasklytic"} loading="eager" decoding="async" className="max-h-10 max-w-[180px] object-contain sm:max-w-[240px]" style={{ width: settings.headerLogoWidth || undefined, height: settings.headerLogoHeight || undefined }} />
        ) : settings.headerShowTextFallback === false ? null : (
          <span>{settings.headerTextFallback || "Tasklytic"}</span>
        )}
      </a>
      <nav className="hidden items-center gap-6 text-sm font-medium opacity-75 md:flex">
        {settings.menuItem1Text ? <a href="#vergleich">{settings.menuItem1Text}</a> : null}
        {settings.menuItem2Text ? <a href="#vergleich">{settings.menuItem2Text}</a> : null}
        {settings.menuItem3Text ? <a href="#faq">{settings.menuItem3Text}</a> : null}
      </nav>
      {settings.headerCtaText ? <Button href={settings.headerCtaUrl} design={design} settings={settings} text={settings.headerCtaText} /> : null}
    </div>
  );
}

function HeroSection({ section, design }: PublicSectionProps) {
  const settings = section.settings;
  const videoFirst = settings.videoPosition === "left";
  const isCentered = settings.layout === "centered";
  const video = <VideoPreview {...videoPreviewPropsFromSettings(settings)} />;
  const copy = (
    <div className={isCentered ? "mx-auto max-w-3xl text-center" : ""}>
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-6xl">{settings.headline}</h1>
      {settings.subheadline ? <p className="mt-5 text-lg opacity-80 md:text-xl">{settings.subheadline}</p> : null}
      {settings.bodyText ? <p className="mt-6 max-w-2xl text-base leading-7 opacity-75 md:text-lg md:leading-8">{settings.bodyText}</p> : null}
      {settings.ctaText ? <div className="mt-8"><Button href={resolveButtonHref(settings)} design={design} settings={settings} text={settings.ctaText} variant={settings.buttonStyle} /></div> : null}
    </div>
  );
  return <div className={`mx-auto grid max-w-6xl gap-7 md:gap-10 ${isCentered ? "" : "lg:grid-cols-[1.05fr_0.95fr]"}`}>{videoFirst && !isCentered ? video : copy}{videoFirst && !isCentered ? copy : video}</div>;
}

function ExplainerSection({ section, design }: PublicSectionProps) {
  const settings = section.settings;
  const twoColumn = settings.layout === "two_column" || settings.layout === "two_columns";
  return (
    <div className={`mx-auto max-w-6xl ${twoColumn ? "grid items-center gap-8 md:grid-cols-2" : "text-center"}`}>
      <div className={twoColumn ? "" : "mx-auto max-w-5xl"}>
        <h2 className="text-2xl font-semibold leading-tight md:text-5xl">{settings.headline}</h2>
        {settings.subheadline ? <p className="mx-auto mt-4 max-w-3xl text-lg opacity-70">{settings.subheadline}</p> : null}
        {settings.buttonText ? <span className="mt-5 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">{settings.buttonText}</span> : null}
        {settings.showArrowEmoji === false ? null : <div className="mt-4 text-3xl">↓</div>}
      </div>
      <div className={twoColumn ? "" : "mx-auto mt-8 max-w-4xl"}><VideoPreview {...videoPreviewPropsFromSettings(settings)} /></div>
      {settings.ctaText ? <div className={twoColumn ? "md:col-span-2 md:text-center" : "mt-8"}><Button href={resolveButtonHref(settings)} design={design} settings={settings} text={settings.ctaText} variant={settings.buttonStyle} /></div> : null}
    </div>
  );
}

function ComparisonSection({ section }: PublicSectionProps) {
  const settings = section.settings;
  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="text-2xl font-semibold md:text-4xl">{settings.headline || "Vorher und nachher"}</h2>
      {settings.subheadline ? <p className="mt-3 max-w-3xl text-lg opacity-70">{settings.subheadline}</p> : null}
      <div className={comparisonGridClass()}>
        <CompareCard title={settings.leftTitle || "Vorher"} items={settings.leftItems ?? settings.beforeItems ?? []} />
        <CompareCard title={settings.rightTitle || "Nachher"} items={settings.rightItems ?? settings.afterItems ?? []} accent />
      </div>
    </div>
  );
}

function comparisonGridClass() {
  return "mt-7 grid grid-cols-1 gap-5 md:grid-cols-2";
}

function CtaSection({ section, design }: PublicSectionProps) {
  const settings = section.settings;
  return (
    <div className="mx-auto max-w-5xl rounded-[2rem] p-6 text-center md:p-10" style={{ backgroundColor: settings.backgroundColor || design.primaryColor, color: settings.textColor || "white", borderRadius: design.cardRadius }}>
      {settings.headline ? <h2 className="text-2xl font-semibold leading-tight md:text-5xl">{settings.headline}</h2> : null}
      {settings.bodyText ? <p className="mx-auto mt-4 max-w-2xl text-base leading-7 opacity-75 md:text-lg">{settings.bodyText}</p> : null}
      {settings.ctaText ? <div className="mt-8"><Button href={resolveButtonHref(settings)} design={design} settings={settings} text={settings.ctaText} variant={settings.buttonStyle} /></div> : null}
    </div>
  );
}

function ImageSection({ section }: { section: RenderedLandingpageSection }) {
  const settings = section.settings;
  if (!settings.imageUrl) return null;
  return <div className="mx-auto max-w-6xl">{settings.headline ? <h2 className="mb-6 text-2xl font-semibold md:text-4xl">{settings.headline}</h2> : null}<img src={settings.imageUrl} alt={settings.imageAlt || ""} loading="lazy" decoding="async" className="w-full rounded-3xl object-cover shadow-panel" /></div>;
}

function StandaloneVideoSection({ section, design }: PublicSectionProps) {
  const settings = section.settings;
  return <div className="mx-auto max-w-4xl text-center">{settings.headline ? <h2 className="text-2xl font-semibold md:text-4xl">{settings.headline}</h2> : null}<div className="mt-6"><VideoPreview {...videoPreviewPropsFromSettings(settings)} /></div>{settings.ctaText ? <div className="mt-8"><Button href={resolveButtonHref(settings)} design={design} settings={settings} text={settings.ctaText} variant={settings.buttonStyle} /></div> : null}</div>;
}

function BenefitsSection({ section, design }: PublicSectionProps) {
  const items = section.settings.benefitItems ?? [];
  return <div className="mx-auto max-w-6xl"><h2 className="text-2xl font-semibold md:text-4xl">{section.settings.headline || "Vorteile"}</h2><div className="mt-6 grid gap-4 md:grid-cols-3">{items.map((item, index) => <article key={`${item.title}-${index}`} className="rounded-3xl bg-white p-6 shadow-panel" style={{ borderRadius: design.cardRadius }}><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></article>)}</div></div>;
}

function ReportSection({ section, design, landingpageId, slug, reportUrl }: PublicSectionProps & { landingpageId: string; slug: string; reportUrl?: string | null }) {
  const settings = section.settings;
  const isRoi = section.type === "roi_report";
  const title = settings.reportTitle || settings.headline || "Kurzreport herunterladen";
  const description = settings.reportDescription || settings.bodyText || "Diese Analyse können Sie auch als PDF speichern oder intern weitergeben.";
  const buttonStyle = {
    backgroundColor: settings.buttonColor || design.buttonColor,
    color: settings.buttonTextColor || "#ffffff",
    borderRadius: cssLength(settings.buttonBorderRadius || design.buttonRadius),
    padding: "14px 20px",
    boxShadow: settings.buttonShadow ? "0 10px 24px rgba(15,23,42,.16)" : undefined
  };
  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-5 shadow-panel md:p-8" style={{ borderRadius: settings.borderRadius ? cssLength(settings.borderRadius) : design.cardRadius }}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {settings.reportShowIcon === false ? null : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-xl" aria-hidden="true">PDF</span>}
            <h2 className="min-w-0 text-2xl font-semibold leading-tight md:text-4xl">{title}</h2>
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
  return <div className="mx-auto max-w-6xl rounded-3xl bg-white p-5 shadow-panel md:p-8"><h2 className="text-2xl font-semibold md:text-3xl">{section.settings.headline}</h2>{section.settings.bodyText ? <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg md:leading-8">{section.settings.bodyText}</p> : null}</div>;
}

function FaqSection({ section }: { section: RenderedLandingpageSection }) {
  const items = Array.isArray(section.settings.faqItems) ? section.settings.faqItems : [];
  if (items.length === 0) return null;
  const headlineStyle = faqElementStyle(section, { field: "headline" });
  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="text-2xl font-semibold md:text-3xl" style={headlineStyle}>{section.settings.headline || "FAQ"}</h2>
      <div className="mt-6 grid gap-4">{items.map((item, index) => (
        <div key={index} className="rounded-3xl bg-white p-6 shadow-panel">
          <h3 className="font-semibold" style={faqElementStyle(section, { itemIndex: index, itemKey: "question" })}>{item.question}</h3>
          <p className="mt-2 text-slate-600" style={faqElementStyle(section, { itemIndex: index, itemKey: "answer" })}>{item.answer}</p>
        </div>
      ))}</div>
    </div>
  );
}

function faqElementStyle(section: RenderedLandingpageSection, target: { field?: string; itemIndex?: number; itemKey?: "question" | "answer" }): CSSProperties {
  const element = section.containers
    ?.flatMap((container) => Array.isArray(container.columns) ? container.columns.flatMap((column) => Array.isArray(column.elements) ? column.elements : []) : [])
    .find((item) => {
      if (target.field) return item.props?.field === target.field;
      return item.props?.itemList === "faqItems" && item.props?.itemIndex === target.itemIndex && item.props?.itemKey === target.itemKey;
    });
  return elementStyleToCss(element?.style);
}

function elementStyleToCss(style?: BuilderElementStyle): CSSProperties {
  const desktop = style?.desktop && typeof style.desktop === "object" ? style.desktop : {};
  const fontSize = numericCss(desktop.fontSize ?? style?.fontSize);
  return {
    color: stringCss(style?.color),
    fontFamily: stringCss(style?.fontFamily),
    fontSize,
    fontWeight: numericCss(style?.fontWeight),
    lineHeight: numericCss(style?.lineHeight),
    textAlign: textAlignCss(style?.textAlign),
    marginTop: numericCss(style?.marginTop),
    marginBottom: numericCss(style?.marginBottom),
    padding: numericCss(style?.padding)
  };
}

function resolveButtonHref(settings: RenderedLandingpageSection["settings"]) {
  if (settings.buttonTargetType === "scroll_section" && settings.buttonTargetSection) return `#${settings.buttonTargetSection.replace(/^#/, "")}`;
  return settings.ctaUrl || "#";
}

function Button({ href, text, design, settings, variant = "primary" }: { href?: string; text: string; design: GlobalLandingpageDesign; settings: RenderedLandingpageSection["settings"]; variant?: "primary" | "secondary" | "outline" }) {
  const resolvedHref = href || "#";
  const style = variant === "outline"
    ? { color: settings.buttonTextColor || design.buttonColor, borderColor: settings.buttonBorderColor || design.buttonColor, backgroundColor: "transparent" }
    : { backgroundColor: settings.buttonColor || (variant === "secondary" ? design.accentColor : design.buttonColor), color: settings.buttonTextColor || "#ffffff", borderColor: settings.buttonBorderColor || "transparent" };
  const width = settings.buttonWidthMode === "full" ? "100%" : settings.buttonWidthMode === "custom" ? cssLength(settings.buttonCustomWidth || "220") : undefined;
  return <a href={resolvedHref} data-track-event="cta_clicked" data-track-booking={resolvedHref.includes("/booking") ? "true" : undefined} data-track-label={text} className={`inline-flex min-h-12 max-w-full items-center justify-center border text-sm font-semibold transition-[background-color,color,box-shadow,transform] ${buttonAnimationClass(settings.buttonAnimation)}`} style={{ ...style, width, borderRadius: cssLength(settings.buttonBorderRadius || design.buttonRadius), borderWidth: Number(settings.buttonBorderWidth ?? 0), padding: `${Number(settings.buttonPaddingY ?? 12)}px ${Number(settings.buttonPaddingX ?? 20)}px`, fontSize: Number(settings.buttonFontSize ?? 14), fontWeight: Number(settings.buttonFontWeight ?? 700), boxShadow: settings.buttonShadow ? "0 10px 24px rgba(15,23,42,.16)" : undefined }}>{text}</a>;
}

function buttonAnimationClass(animation: RenderedLandingpageSection["settings"]["buttonAnimation"]) {
  return `button-animation-${animation ?? "none"}`;
}

function cssLength(value: string | number) {
  if (typeof value === "number") return value;
  if (/^\d+(\.\d+)?$/.test(value.trim())) return `${value}px`;
  return value;
}

function numericCss(value: BuilderElementStyle[string] | undefined) {
  if (value === undefined || value === "" || typeof value === "boolean" || typeof value === "object") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function stringCss(value: BuilderElementStyle[string] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function textAlignCss(value: BuilderElementStyle[string] | undefined): CSSProperties["textAlign"] {
  return value === "left" || value === "center" || value === "right" ? value : undefined;
}

function PlaceholderVideo({ title }: { title: string }) {
  return <div className="grid min-h-80 place-items-center rounded-[2rem] border border-white/20 bg-white/10 p-8 text-center text-white/70">{title} noch nicht hinterlegt</div>;
}

function CompareCard({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  const safeItems = Array.isArray(items) ? items : [];
  return <div className="w-full rounded-3xl bg-white p-5 shadow-panel md:p-6"><h3 className="text-lg font-semibold md:text-xl">{title}</h3><ul className="mt-4 space-y-3">{safeItems.map((item) => <li key={item} className={`flex items-start gap-3 text-sm leading-6 md:text-base ${accent ? "text-emerald-700" : "text-slate-600"}`}><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-xs">{accent ? "✓" : "x"}</span><span className="min-w-0">{item}</span></li>)}</ul></div>;
}
