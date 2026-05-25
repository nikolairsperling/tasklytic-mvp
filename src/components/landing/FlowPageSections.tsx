import type { CSSProperties } from "react";
import { BeforeAfterSection } from "@/components/landing/BeforeAfterSection";
import { CTAButton } from "@/components/landing/CTAButton";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingVideo } from "@/components/landing/LandingVideo";
import { landingpageOnlySections, sectionsForPageTab, type LandingpagePageTab } from "@/lib/landingpage-page-flow";
import { backgroundStyleFromSettings, elementStyleByField, elementStyleByListItem } from "@/lib/landingpage-style";
import type { GlobalLandingpageDesign, RenderedLandingpageSection } from "@/lib/landingpage-templates";
import { landingDesignTokens } from "@/styles/landing-design";

type FlowPageSectionsProps = {
  sections: RenderedLandingpageSection[];
  page: LandingpagePageTab;
  design: GlobalLandingpageDesign;
  excludeTypes?: string[];
};

export function FlowPageSections({ sections, page, design, excludeTypes = [] }: FlowPageSectionsProps) {
  const pageSections = (page === "landingpage" ? landingpageOnlySections(sections) : sectionsForPageTab(sections, page))
    .filter((section) => !excludeTypes.includes(section.type));
  if (pageSections.length === 0) return null;
  return (
    <>
      {pageSections.map((section) => (
        <section key={section.id} className="landing-section" style={sectionStyle(section, design)}>
          <FlowSectionContent section={section} design={design} />
        </section>
      ))}
    </>
  );
}

function FlowSectionContent({ section, design }: { section: RenderedLandingpageSection; design: GlobalLandingpageDesign }) {
  const settings = section.settings;
  if (section.type === "header") return <LandingNavbar settings={settings} design={design} />;
  if (section.type === "comparison") return <BeforeAfterSection section={section} />;
  if (section.type === "image") return <ImageFlowSection section={section} />;
  if (section.type === "video" || section.type === "explainer_video") return <VideoFlowSection section={section} />;
  if (section.type === "benefits") return <BenefitsFlowSection section={section} design={design} />;
  if (section.type === "faq") return <FaqFlowSection section={section} />;
  if (section.type === "divider") return <div className="mx-auto h-px max-w-6xl bg-slate-200" />;
  if (section.type === "spacer") return <div style={{ height: Number(settings.spacerHeight ?? 48) }} />;
  if (section.type === "footer") return <footer className="text-center text-sm opacity-70">{settings.bodyText || "Tasklytic"}</footer>;
  return <TextFlowSection section={section} design={design} />;
}

function TextFlowSection({ section, design }: { section: RenderedLandingpageSection; design: GlobalLandingpageDesign }) {
  const settings = section.settings;
  const dark = settings.textColor === "#ffffff" || settings.backgroundColor === landingDesignTokens.colors.surfaceDark;
  const textColor = dark ? "#ffffff" : landingDesignTokens.colors.ink;
  return (
    <div className="mx-auto rounded-[24px] border border-slate-800/10 p-6 text-center shadow-[0_18px_55px_rgba(15,23,42,0.1)] md:p-10" style={{ maxWidth: landingDesignTokens.layout.narrowWidth, borderRadius: design.cardRadius }}>
      {settings.headline ? <h2 className="break-words text-3xl font-extrabold leading-tight md:text-4xl" style={elementStyleByField(section, "headline", "desktop", { textColor, fontFamily: settings.fontFamily, fontWeight: 800 })}>{settings.headline}</h2> : null}
      {settings.bodyText ? <p className="mx-auto mt-4 max-w-2xl text-base leading-7 md:text-lg" style={elementStyleByField(section, "bodyText", "desktop", { textColor: dark ? "#e5e7eb" : landingDesignTokens.colors.muted, fontFamily: settings.fontFamily, lineHeight: 1.6 })}>{settings.bodyText}</p> : null}
      {settings.ctaText ? <div className="mt-7 flex justify-center"><CTAButton href={settings.ctaUrl || "#"} text={settings.ctaText} variant={settings.buttonStyle || "primary"} /></div> : null}
    </div>
  );
}

function ImageFlowSection({ section }: { section: RenderedLandingpageSection }) {
  const settings = section.settings;
  if (!settings.imageUrl) return null;
  return <div className="mx-auto" style={{ maxWidth: landingDesignTokens.layout.maxWidth }}>{settings.headline ? <h2 className="mb-6 break-words text-3xl font-extrabold md:text-4xl" style={elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: settings.fontFamily, fontWeight: 800 })}>{settings.headline}</h2> : null}<img src={settings.imageUrl} alt={settings.imageAlt || ""} loading="lazy" decoding="async" className="w-full rounded-[20px] object-cover shadow-panel" /></div>;
}

function VideoFlowSection({ section }: { section: RenderedLandingpageSection }) {
  const settings = section.settings;
  return <div className="mx-auto max-w-3xl text-center">{settings.headline ? <h2 className="break-words text-3xl font-extrabold md:text-4xl" style={elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: settings.fontFamily, fontWeight: 800 })}>{settings.headline}</h2> : null}<div className="mt-6"><LandingVideo settings={settings} compact /></div>{settings.ctaText ? <div className="mt-7 flex justify-center"><CTAButton href={settings.ctaUrl || "#"} text={settings.ctaText} variant={settings.buttonStyle || "primary"} /></div> : null}</div>;
}

function BenefitsFlowSection({ section, design }: { section: RenderedLandingpageSection; design: GlobalLandingpageDesign }) {
  const items = section.settings.benefitItems ?? [];
  return <div className="mx-auto" style={{ maxWidth: landingDesignTokens.layout.maxWidth }}><h2 className="break-words text-3xl font-extrabold md:text-4xl" style={elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: section.settings.fontFamily, fontWeight: 800 })}>{section.settings.headline || "Vorteile"}</h2><div className="mt-6 grid gap-4 md:grid-cols-3">{items.map((item, index) => <article key={`${item.title}-${index}`} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-panel" style={{ borderRadius: design.cardRadius }}><h3 className="font-extrabold text-slate-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></article>)}</div></div>;
}

function FaqFlowSection({ section }: { section: RenderedLandingpageSection }) {
  const items = section.settings.faqItems ?? [];
  return <div className="mx-auto max-w-5xl"><h2 className="break-words text-2xl font-extrabold md:text-3xl" style={elementStyleByField(section, "headline", "desktop", { fontFamily: section.settings.fontFamily })}>{section.settings.headline || "FAQ"}</h2><div className="mt-6 grid gap-4">{items.map((item, index) => <div key={index} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-panel"><h3 className="font-extrabold text-slate-950" style={elementStyleByListItem(section, { itemList: "faqItems", itemIndex: index, itemKey: "question" }, "desktop", { fontFamily: section.settings.fontFamily })}>{item.question}</h3><p className="mt-2 text-slate-600" style={elementStyleByListItem(section, { itemList: "faqItems", itemIndex: index, itemKey: "answer" }, "desktop", { fontFamily: section.settings.fontFamily })}>{item.answer}</p></div>)}</div></div>;
}

function sectionStyle(section: RenderedLandingpageSection, design: GlobalLandingpageDesign): CSSProperties {
  const settings = section.settings;
  const responsive = section.responsive?.desktop ?? {};
  return {
    ...backgroundStyleFromSettings(settings, settings.backgroundColor || "transparent"),
    color: settings.textColor || design.textColor,
    paddingTop: Number(responsive.paddingTop ?? settings.paddingTop ?? settings.spacingTop ?? 48),
    paddingBottom: Number(responsive.paddingBottom ?? settings.paddingBottom ?? settings.spacingBottom ?? 48),
    paddingLeft: Number(responsive.paddingLeft ?? settings.paddingLeft ?? 20),
    paddingRight: Number(responsive.paddingRight ?? settings.paddingRight ?? 20),
    marginTop: Number(responsive.marginTop ?? settings.marginTop ?? 0),
    marginBottom: Number(responsive.marginBottom ?? settings.marginBottom ?? 0),
    borderRadius: cssLengthValue(responsive.borderRadius) ?? settings.borderRadius,
    borderColor: settings.borderColor,
    borderWidth: Number(settings.borderWidth ?? 0),
    boxShadow: settings.shadow && settings.shadow !== "none" ? settings.shadow : undefined
  };
}

function cssLengthValue(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return `${value}px`;
  if (typeof value !== "string") return undefined;
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value}px` : value;
}
