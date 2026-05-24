export const landingDesignTokens = {
  colors: {
    background: "#F6F8FB",
    surface: "#FFFFFF",
    surfaceMuted: "#EEF2F7",
    surfaceDark: "#111827",
    ink: "#0F172A",
    primary: "#0F172A",
    secondary: "#1E3A8A",
    secondaryMuted: "#243B63",
    accent: "#2563EB",
    success: "#059669",
    muted: "#6B7280",
    border: "#E5E7EB",
    borderStrong: "#CBD5E1"
  },
  spacing: {
    pageX: "clamp(1rem, 3vw, 2rem)",
    sectionY: "clamp(2rem, 5vw, 4.5rem)",
    sectionYCompact: "clamp(1.5rem, 4vw, 3rem)",
    heroY: "clamp(2rem, 6vw, 5rem)",
    cardPadding: "clamp(1.25rem, 2.8vw, 2rem)"
  },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    hero: "clamp(2rem, 5vw, 3.6rem)",
    sectionHeadline: "clamp(1.75rem, 3.5vw, 2.75rem)",
    body: "1rem"
  },
  radius: {
    button: "14px",
    card: "20px",
    video: "22px",
    section: "28px"
  },
  shadow: {
    button: "0 12px 28px rgba(15, 23, 42, 0.18)",
    card: "0 18px 48px rgba(15, 23, 42, 0.08)",
    cardStrong: "0 24px 70px rgba(15, 23, 42, 0.13)",
    video: "0 28px 80px rgba(15, 23, 42, 0.18)"
  },
  layout: {
    maxWidth: "1180px",
    narrowWidth: "880px",
    videoWidth: "620px"
  },
  breakpoints: {
    mobile: "767px",
    tablet: "1023px",
    desktop: "1024px"
  },
  video: {
    aspectRatio: "16 / 9",
    desktopMaxHeight: "390px",
    mobileMaxHeight: "235px"
  }
} as const;

export const landingBrandName = "Tasklytic";
export const defaultPublicLogoPath = "/logo.png";

export type LandingButtonVariant = "primary" | "secondary" | "outline";

export function landingCssLength(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return `${value}px`;
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value}px` : value;
}

export function landingClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
