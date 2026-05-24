import type { CSSProperties } from "react";
import type { BuilderDevice, BuilderElement, BuilderElementStyle, LandingpageSection, LandingpageSectionSettings, ResponsiveStyleValue } from "@/lib/landingpage-templates";

type BackgroundSource = Partial<Pick<
  LandingpageSectionSettings,
  | "backgroundType"
  | "backgroundColor"
  | "gradientFrom"
  | "gradientTo"
  | "gradientDirection"
  | "backgroundImageUrl"
  | "backgroundSize"
  | "backgroundPosition"
  | "backgroundRepeat"
  | "overlayColor"
  | "overlayOpacity"
>>;

export function backgroundStyleFromSettings(source: BackgroundSource | BuilderElementStyle | undefined, fallbackColor?: string): CSSProperties {
  if (!source) return fallbackColor ? { backgroundColor: fallbackColor } : {};
  const backgroundType = source.backgroundType;
  const legacyColor = stringValue(source.backgroundColor);
  const base: CSSProperties = {};

  if (!backgroundType || backgroundType === "default") {
    if (legacyColor) base.backgroundColor = legacyColor;
    else if (fallbackColor) base.backgroundColor = fallbackColor;
    return base;
  }

  if (backgroundType === "none") {
    return { backgroundColor: "transparent", backgroundImage: "none" };
  }

  if (backgroundType === "color") {
    return { backgroundColor: legacyColor || fallbackColor || "transparent", backgroundImage: "none" };
  }

  if (backgroundType === "gradient") {
    return {
      backgroundColor: legacyColor || fallbackColor,
      backgroundImage: gradientCss(source)
    };
  }

  const imageUrl = stringValue(source.backgroundImageUrl);
  if (backgroundType === "image" && imageUrl) {
    return {
      backgroundColor: legacyColor || fallbackColor,
      backgroundImage: imageBackgroundCss(source, imageUrl),
      backgroundPosition: backgroundPositionValue(source.backgroundPosition),
      backgroundSize: backgroundSizeValue(source.backgroundSize),
      backgroundRepeat: backgroundRepeatValue(source.backgroundRepeat)
    };
  }

  return fallbackColor ? { backgroundColor: fallbackColor } : {};
}

export function elementStyleToCss(style: BuilderElementStyle | undefined, device: BuilderDevice = "desktop", fallback?: { textColor?: string; fontFamily?: string; fontWeight?: string | number; lineHeight?: string | number }): CSSProperties {
  const responsive = responsiveStyle(style, device);
  const background = backgroundStyleFromSettings(style);
  return {
    ...background,
    color: stringValue(responsive.color) ?? stringValue(style?.color) ?? fallback?.textColor,
    fontFamily: stringValue(responsive.fontFamily) ?? stringValue(style?.fontFamily) ?? fallback?.fontFamily,
    fontSize: cssNumberOrLength(responsive.fontSize ?? style?.fontSize),
    fontWeight: cssNumberOrLength(responsive.fontWeight ?? style?.fontWeight ?? fallback?.fontWeight),
    lineHeight: cssNumberOrLength(responsive.lineHeight ?? style?.lineHeight ?? fallback?.lineHeight),
    letterSpacing: cssNumberOrLength(responsive.letterSpacing ?? style?.letterSpacing),
    fontStyle: (responsive.fontStyle ?? style?.fontStyle) === "italic" ? "italic" : undefined,
    textDecoration: stringValue(responsive.textDecoration) ?? stringValue(style?.textDecoration),
    textAlign: textAlignValue(responsive.textAlign ?? style?.textAlign),
    borderRadius: cssLength(responsive.borderRadius ?? style?.borderRadius),
    width: cssWidth(responsive.width ?? style?.width),
    maxWidth: cssWidth(responsive.maxWidth ?? style?.maxWidth),
    margin: cssLength(responsive.margin ?? style?.margin),
    marginTop: cssLength(responsive.marginTop ?? style?.marginTop),
    marginBottom: cssLength(responsive.marginBottom ?? style?.marginBottom),
    padding: cssLength(responsive.padding ?? style?.padding),
    overflow: responsive.borderRadius !== undefined || style?.borderRadius !== undefined ? "hidden" : undefined
  };
}

export function responsiveStyle(style: BuilderElementStyle | undefined, device: BuilderDevice): Record<string, ResponsiveStyleValue> {
  const deviceStyle = style?.[device];
  if (deviceStyle && typeof deviceStyle === "object" && !Array.isArray(deviceStyle)) return deviceStyle as Record<string, ResponsiveStyleValue>;
  return {};
}

export function elementStyleByField(section: LandingpageSection, field: string, device: BuilderDevice = "desktop", fallback?: Parameters<typeof elementStyleToCss>[2]): CSSProperties {
  const element = section.containers
    ?.flatMap((container) => Array.isArray(container.columns) ? container.columns.flatMap((column) => Array.isArray(column.elements) ? flattenElements(column.elements) : []) : [])
    .find((item) => item.props?.field === field);
  return elementStyleToCss(element?.style, device, fallback);
}

export function elementStyleByListItem(section: LandingpageSection, target: { itemList: string; itemIndex?: number; itemKey?: string }, device: BuilderDevice = "desktop", fallback?: Parameters<typeof elementStyleToCss>[2]): CSSProperties {
  const element = section.containers
    ?.flatMap((container) => Array.isArray(container.columns) ? container.columns.flatMap((column) => Array.isArray(column.elements) ? flattenElements(column.elements) : []) : [])
    .find((item) => item.props?.itemList === target.itemList && item.props?.itemIndex === target.itemIndex && item.props?.itemKey === target.itemKey);
  return elementStyleToCss(element?.style, device, fallback);
}

function flattenElements(elements: BuilderElement[]): BuilderElement[] {
  return elements.flatMap((element) => {
    const nested = element as typeof element & { elements?: typeof elements; children?: typeof elements };
    const children = Array.isArray(nested.elements) ? nested.elements : Array.isArray(nested.children) ? nested.children : undefined;
    return children ? [element, ...flattenElements(children)] : [element];
  });
}

export function cssLength(value: ResponsiveStyleValue | Record<string, ResponsiveStyleValue>) {
  if (value === undefined || value === "" || typeof value === "boolean" || typeof value === "object") return undefined;
  if (typeof value === "number") return value;
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value}px` : value;
}

export function cssNumberOrLength(value: ResponsiveStyleValue | Record<string, ResponsiveStyleValue>) {
  if (value === undefined || value === "" || typeof value === "boolean" || typeof value === "object") return undefined;
  if (typeof value === "number") return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

export function cssWidth(value: ResponsiveStyleValue | Record<string, ResponsiveStyleValue>) {
  if (value === undefined || value === "" || typeof value === "boolean" || typeof value === "object") return undefined;
  if (typeof value === "number") return `${value}px`;
  return value;
}

export function textAlignValue(value: unknown): CSSProperties["textAlign"] | undefined {
  return value === "left" || value === "center" || value === "right" ? value : undefined;
}

function gradientCss(source: BackgroundSource | BuilderElementStyle) {
  const from = stringValue(source.gradientFrom) || stringValue(source.backgroundColor) || "#ffffff";
  const to = stringValue(source.gradientTo) || "#f1f5f9";
  if (source.gradientDirection === "radial") return `radial-gradient(circle at center, ${from}, ${to})`;
  const direction = source.gradientDirection === "left-right"
    ? "to right"
    : source.gradientDirection === "diagonal"
      ? "135deg"
      : "to bottom";
  return `linear-gradient(${direction}, ${from}, ${to})`;
}

function imageBackgroundCss(source: BackgroundSource | BuilderElementStyle, imageUrl: string) {
  const overlayOpacity = Number(source.overlayOpacity ?? 0);
  const overlayColor = rgbaColor(stringValue(source.overlayColor) || "#000000", Number.isFinite(overlayOpacity) ? overlayOpacity : 0);
  const image = `url("${imageUrl.replace(/"/g, "%22")}")`;
  return overlayOpacity > 0 ? `linear-gradient(${overlayColor}, ${overlayColor}), ${image}` : image;
}

function rgbaColor(color: string, opacity: number) {
  const clamped = Math.min(1, Math.max(0, opacity));
  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (short) {
    const [r, g, b] = short[1].split("").map((item) => parseInt(`${item}${item}`, 16));
    return `rgb(${r} ${g} ${b} / ${clamped})`;
  }
  if (full) {
    const value = full[1];
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgb(${r} ${g} ${b} / ${clamped})`;
  }
  return `rgb(0 0 0 / ${clamped})`;
}

function backgroundSizeValue(value: unknown): CSSProperties["backgroundSize"] {
  return value === "contain" || value === "auto" ? value : "cover";
}

function backgroundPositionValue(value: unknown): CSSProperties["backgroundPosition"] {
  if (value === "top" || value === "bottom" || value === "left" || value === "right") return value;
  return "center";
}

function backgroundRepeatValue(value: unknown): CSSProperties["backgroundRepeat"] {
  return value === "repeat" ? "repeat" : "no-repeat";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
