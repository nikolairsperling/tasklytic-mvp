import type { GlobalLandingpageDesign, RenderedLandingpageSection } from "@/lib/landingpage-templates";
import { resolveHeaderLogo } from "@/lib/landingpage-logo";
import { landingClassNames, landingDesignTokens } from "@/styles/landing-design";
import { CTAButton } from "./CTAButton";
import { Logo } from "./Logo";

type LandingNavbarProps = {
  settings: RenderedLandingpageSection["settings"];
  design: GlobalLandingpageDesign;
};

export function LandingNavbar({ settings }: LandingNavbarProps) {
  const centered = settings.headerLogoPosition === "center" || settings.headerAlignment === "center";
  const logoHref = settings.headerCtaUrl || "#";
  const logo = resolveHeaderLogo(settings);

  return (
    <div className="mx-auto w-full" style={{ maxWidth: landingDesignTokens.layout.maxWidth }}>
      <div
        className={landingClassNames(
          "flex min-h-[64px] items-center gap-3 rounded-none py-3 sm:min-h-[72px]",
          centered ? "justify-center" : "justify-between"
        )}
      >
        <Logo
          type={logo.type}
          href={logoHref}
          src={logo.imageUrl}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          text={logo.text}
          fallbackToPublicLogo={false}
        />

        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex">
          {settings.menuItem1Text ? <a className="no-underline hover:text-slate-950" href="#vergleich">{settings.menuItem1Text}</a> : null}
          {settings.menuItem2Text ? <a className="no-underline hover:text-slate-950" href="#vergleich">{settings.menuItem2Text}</a> : null}
          {settings.menuItem3Text ? <a className="no-underline hover:text-slate-950" href="#faq">{settings.menuItem3Text}</a> : null}
        </nav>

        {settings.headerCtaText ? (
          <div className="hidden sm:block">
            <CTAButton
              href={settings.headerCtaUrl}
              text={settings.headerCtaText}
              variant="secondary"
              shadow={false}
              paddingX={16}
              paddingY={10}
              fontSize={13}
              radius={12}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
