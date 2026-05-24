import type { GlobalLandingpageDesign, RenderedLandingpageSection } from "@/lib/landingpage-templates";
import { elementStyleByField } from "@/lib/landingpage-style";
import { landingClassNames, landingDesignTokens } from "@/styles/landing-design";
import { CTAButton } from "./CTAButton";
import { LandingVideo } from "./LandingVideo";

type LandingHeroProps = {
  section: RenderedLandingpageSection;
  design: GlobalLandingpageDesign;
  ctaHref?: string;
};

export function LandingHero({ section, ctaHref }: LandingHeroProps) {
  const settings = section.settings;
  const videoFirst = settings.videoPosition === "left";
  const isCentered = settings.layout === "centered";
  const headlineStyle = elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: settings.fontFamily, fontWeight: 800, lineHeight: 1.08 });
  const bodyStyle = elementStyleByField(section, "bodyText", "desktop", { textColor: landingDesignTokens.colors.muted, fontFamily: settings.fontFamily, lineHeight: 1.6 });
  const copy = (
    <div className={landingClassNames("min-w-0", isCentered && "mx-auto max-w-3xl text-center")}>
      {settings.subheadline ? (
        <p className="mb-4 text-sm font-bold uppercase tracking-normal text-blue-700">
          {settings.subheadline}
        </p>
      ) : null}
      <h1 className="max-w-3xl break-words text-[2rem] font-extrabold leading-[1.08] text-slate-950 sm:text-4xl lg:text-5xl xl:text-[3.6rem]" style={headlineStyle}>
        {settings.headline}
      </h1>
      {settings.bodyText ? (
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8" style={bodyStyle}>
          {settings.bodyText}
        </p>
      ) : null}
      {settings.ctaText ? (
        <div className={landingClassNames("mt-7 flex", isCentered ? "justify-center" : "justify-start")}>
          <CTAButton
            href={ctaHref}
            text={settings.ctaText}
            variant={settings.buttonStyle || "primary"}
            widthMode={settings.buttonWidthMode}
            customWidth={settings.buttonCustomWidth}
            radius={settings.buttonBorderRadius}
            paddingX={settings.buttonPaddingX}
            paddingY={settings.buttonPaddingY}
            fontSize={settings.buttonFontSize}
            fontWeight={settings.buttonFontWeight}
            borderWidth={settings.buttonBorderWidth}
            borderColor={settings.buttonBorderColor}
            shadow={settings.buttonShadow !== false}
            animation={settings.buttonAnimation}
          />
        </div>
      ) : null}
    </div>
  );
  const video = (
    <div className="min-w-0">
      <LandingVideo settings={settings} />
    </div>
  );

  if (isCentered) {
    return (
      <div className="mx-auto grid gap-8 text-center" style={{ maxWidth: landingDesignTokens.layout.narrowWidth }}>
        {copy}
        {video}
      </div>
    );
  }

  return (
    <div
      className="mx-auto grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-12"
      style={{ maxWidth: landingDesignTokens.layout.maxWidth }}
    >
      {videoFirst ? video : copy}
      {videoFirst ? copy : video}
    </div>
  );
}
