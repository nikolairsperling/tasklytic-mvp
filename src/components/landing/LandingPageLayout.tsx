import type { CSSProperties, ReactNode } from "react";
import type { GlobalLandingpageDesign } from "@/lib/landingpage-templates";
import { landingDesignTokens } from "@/styles/landing-design";

type LandingPageLayoutProps = {
  design: GlobalLandingpageDesign;
  children: ReactNode;
};

export function LandingPageLayout({ design, children }: LandingPageLayoutProps) {
  const style = {
    "--lp-bg": design.backgroundColor || landingDesignTokens.colors.background,
    "--lp-text": design.textColor || landingDesignTokens.colors.ink,
    "--lp-primary": design.primaryColor || landingDesignTokens.colors.primary,
    "--lp-accent": design.accentColor || landingDesignTokens.colors.accent,
    "--lp-card-radius": design.cardRadius || landingDesignTokens.radius.card,
    "--lp-button-radius": design.buttonRadius || landingDesignTokens.radius.button,
    backgroundColor: design.backgroundColor || landingDesignTokens.colors.background,
    color: design.textColor || landingDesignTokens.colors.ink,
    fontFamily: design.fontFamily || landingDesignTokens.typography.fontFamily
  } as CSSProperties;

  return (
    <main className="landing-page min-h-screen antialiased" style={style}>
      {children}
    </main>
  );
}
