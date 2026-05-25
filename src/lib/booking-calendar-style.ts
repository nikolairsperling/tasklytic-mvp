import type { CSSProperties } from "react";
import type { LandingpageSectionSettings } from "@/lib/landingpage-templates";

export function bookingCalendarShellStyle(settings: LandingpageSectionSettings): CSSProperties {
  return {
    backgroundColor: settings.bookingCalendarBackgroundColor || "#ffffff",
    borderColor: settings.bookingCalendarBorderColor || "#e5e7eb",
    borderRadius: cssLengthValue(settings.bookingCalendarBorderRadius) || 24,
    color: settings.bookingCalendarTextColor || "#111827",
    marginTop: cssLengthValue(settings.bookingCalendarSpacingTop) || 32,
    marginBottom: cssLengthValue(settings.bookingCalendarSpacingBottom) || 24,
    maxWidth: cssLengthValue(settings.bookingCalendarWidth) || 960
  };
}

export function bookingCalendarIframeStyle(settings: LandingpageSectionSettings): CSSProperties {
  return {
    backgroundColor: settings.bookingCalendarBackgroundColor || "#ffffff",
    height: cssLengthValue(settings.bookingCalendarHeight) || "min(680px, 80vh)",
    minHeight: 420
  };
}

export function bookingCalendarButtonStyle(settings: LandingpageSectionSettings): CSSProperties {
  return {
    backgroundColor: settings.bookingCalendarButtonColor || "#0f172a",
    borderRadius: cssLengthValue(settings.bookingCalendarInputRadius) || 12,
    color: settings.bookingCalendarButtonTextColor || "#ffffff"
  };
}

export function bookingCalendarPlaceholderTokens(settings: LandingpageSectionSettings) {
  return {
    activeDayColor: settings.bookingCalendarActiveDayColor || "#2563eb",
    activeTextColor: settings.bookingCalendarActiveTextColor || "#ffffff",
    borderColor: settings.bookingCalendarBorderColor || "#e5e7eb",
    inputRadius: cssLengthValue(settings.bookingCalendarInputRadius) || 12,
    inputBorderWidth: Number(settings.bookingCalendarInputBorderWidth ?? 1)
  };
}

export function cssLengthValue(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value}px` : value;
}

