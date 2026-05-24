import type { CSSProperties } from "react";
import {
  landingClassNames,
  landingCssLength,
  landingDesignTokens,
  type LandingButtonVariant
} from "@/styles/landing-design";

type CTAButtonProps = {
  href?: string | null;
  text: string;
  variant?: LandingButtonVariant;
  widthMode?: "auto" | "full" | "custom";
  customWidth?: string | number | null;
  radius?: string | number | null;
  paddingX?: string | number | null;
  paddingY?: string | number | null;
  fontSize?: string | number | null;
  fontWeight?: string | number | null;
  borderWidth?: string | number | null;
  borderColor?: string | null;
  shadow?: boolean;
  animation?: string | null;
  className?: string;
  style?: CSSProperties;
  trackLabel?: string;
};

export function CTAButton({
  href,
  text,
  variant = "primary",
  widthMode = "auto",
  customWidth,
  radius,
  paddingX,
  paddingY,
  fontSize,
  fontWeight,
  borderWidth,
  borderColor,
  shadow = true,
  animation,
  className,
  style,
  trackLabel
}: CTAButtonProps) {
  const resolvedHref = href || "#";
  const colorStyle = buttonColorStyle(variant, borderColor);
  const width = widthMode === "full" ? "100%" : widthMode === "custom" ? landingCssLength(customWidth || "220") : undefined;
  const buttonStyle: CSSProperties = {
    ...colorStyle,
    width,
    borderRadius: landingCssLength(radius) || landingDesignTokens.radius.button,
    borderWidth: Number(borderWidth ?? (variant === "outline" ? 1 : 0)),
    padding: `${Number(paddingY ?? 13)}px ${Number(paddingX ?? 20)}px`,
    fontSize: Number(fontSize ?? 14),
    fontWeight: Number(fontWeight ?? 800),
    boxShadow: shadow && variant !== "outline" ? landingDesignTokens.shadow.button : undefined,
    ...style
  };

  return (
    <a
      href={resolvedHref}
      data-track-event="cta_clicked"
      data-track-booking={resolvedHref.includes("/booking") ? "true" : undefined}
      data-track-label={trackLabel || text}
      data-variant={variant}
      className={landingClassNames(
        "landing-cta-button inline-flex min-h-11 max-w-full items-center justify-center whitespace-normal border text-center leading-tight no-underline transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-600/15",
        widthMode === "full" ? "w-full" : "w-full sm:w-auto",
        buttonAnimationClass(animation),
        className
      )}
      style={buttonStyle}
    >
      <span className="min-w-0">{text}</span>
    </a>
  );
}

function buttonColorStyle(variant: LandingButtonVariant, borderColor?: string | null): CSSProperties {
  if (variant === "outline") {
    return {
      color: landingDesignTokens.colors.primary,
      borderColor: borderColor || landingDesignTokens.colors.borderStrong,
      backgroundColor: "transparent"
    };
  }

  if (variant === "secondary") {
    return {
      color: landingDesignTokens.colors.ink,
      borderColor: landingDesignTokens.colors.border,
      backgroundColor: landingDesignTokens.colors.surface
    };
  }

  return {
    color: "#FFFFFF",
    borderColor: "transparent",
    backgroundColor: landingDesignTokens.colors.primary
  };
}

export function buttonAnimationClass(animation?: string | null) {
  return `button-animation-${animation || "lift"}`;
}
