import type { LandingpageTemplate, Prisma, Prospect } from "@prisma/client";
import { normalizeHeaderLogoSettings } from "@/lib/landingpage-logo";
import { prisma } from "@/lib/prisma";
import { landingDesignTokens } from "@/styles/landing-design";

export const templateVariables = [
  "vorname",
  "nachname",
  "firstName",
  "lastName",
  "firma",
  "stadt",
  "anrede",
  "du",
  "dein",
  "deine",
  "deinen",
  "deinem",
  "dir",
  "dich",
  "mitDir",
  "ihr",
  "euch",
  "euer",
  "eure",
  "euren",
  "anredeForm",
  "ansprache",
  "cta",
  "headline",
  "checkIntro",
  "watchPrompt",
  "youReceive",
  "entscheidungstraeger",
  "salutation",
  "fullName",
  "companyName",
  "city",
  "decisionMakerName",
  "decisionMakerRole",
  "landingpageUrl",
  "videoUrl",
  "calendarUrl",
  "Terminlink",
  "Calendly_Link",
  "Booking_URL",
  "painPoint",
  "painSummary",
  "businessField",
  "vehicleCount",
  "locationsCount"
];

export type ProspectForTemplate = LeadForTemplate & Partial<Prospect>;
export type LeadForTemplate = Partial<Pick<Prospect,
  "firstName" |
  "lastName" |
  "salutation" |
  "companyName" |
  "legalName" |
  "city" |
  "decisionMakerName" |
  "decisionMakerRole" |
  "slug" |
  "personalVideoUrl" |
  "videoUrl" |
  "calendarUrl" |
  "bookingUrl" |
  "customPainPoint" |
  "painSummary" |
  "businessFields" |
  "vehicleCount" |
  "locationsCount"
>> & {
  landingpageUrl?: string | null;
  name?: string | null;
};

export const previewLead = {
  firstName: "Max",
  lastName: "Mustermann",
  salutation: "Herr",
  companyName: "Muster Spedition GmbH",
  city: "Bremen",
  decisionMakerName: "Max Mustermann",
  calendarUrl: "https://example.com/termin",
  landingpageUrl: "https://example.com/max-mustermann"
} satisfies LeadForTemplate;

function withPreviewLead(lead: LeadForTemplate | null | undefined): LeadForTemplate {
  return {
    ...previewLead,
    ...(lead ?? {})
  };
}

const neutralTemplateFallbacks: Record<string, string> = {
  vorname: "",
  firstName: "",
  nachname: "",
  lastName: "",
  firma: "Ihr Unternehmen",
  companyName: "Ihr Unternehmen",
  stadt: "",
  city: "",
  anrede: "",
  salutation: "",
  entscheidungstraeger: "",
  decisionMakerName: "",
  landingpageUrl: "",
  calendarUrl: "",
  Terminlink: "",
  Calendly_Link: "",
  Booking_URL: ""
};
export type AddressForm = "du" | "sie";
export const landingpageSectionTypes = [
  "header",
  "hero",
  "personal_video",
  "explainer_video",
  "comparison",
  "cta",
  "approach",
  "faq",
  "textblock",
  "image",
  "video",
  "cta_button",
  "pdf_report_download",
  "print_report_cta",
  "roi_report",
  "benefits",
  "divider",
  "spacer",
  "image_text",
  "trust",
  "booking",
  "thank_you",
  "legal",
  "footer"
] as const;

export type LandingpageSectionType = (typeof landingpageSectionTypes)[number];
export type SectionWidth = "narrow" | "normal" | "wide";
export type SectionLayout = "left" | "right" | "centered" | "two_columns" | "two_column" | "full_width" | "two_cards";
export type BuilderDevice = "desktop" | "tablet" | "mobile";
export type ResponsiveStyleValue = string | number | boolean | undefined;
export type ResponsiveStyle = Partial<Record<BuilderDevice, Record<string, ResponsiveStyleValue>>>;
export type BuilderElementStyle = Record<string, ResponsiveStyleValue | Record<string, ResponsiveStyleValue>> & ResponsiveStyle;
export type BuilderElementType = "headline" | "text" | "button" | "image" | "video" | "icon" | "list" | "faq" | "cta" | "testimonial" | "steps" | "booking" | "spacer";

export type BuilderElement = {
  id: string;
  type: BuilderElementType;
  props: Record<string, unknown>;
  style?: BuilderElementStyle;
  editable: true;
};

export type ButtonBuilderElementProps = {
  type: "button";
  text: string;
  href: string;
  variant: "primary" | "secondary" | "outline";
  size: "sm" | "md" | "lg";
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
  paddingX: string;
  paddingY: string;
  fontSize: string;
  fontWeight: string;
  alignment: "left" | "center" | "right";
  widthMode: "auto" | "full" | "custom";
  shadow: boolean;
  hoverEffect: "none" | "lift" | "scale" | "brighten";
  animation: "none" | "lift" | "pulse" | "glow" | "slide" | "scale" | "bounce";
};

export type BuilderColumn = {
  id: string;
  width: number;
  elements: BuilderElement[];
  style?: ResponsiveStyle;
};

export type BuilderContainer = {
  id: string;
  settings: {
    maxWidth?: number;
    display?: "flex" | "grid";
    columns?: number;
    gap?: number;
    alignment?: "start" | "center" | "end" | "stretch";
    padding?: number;
    backgroundColor?: string;
    borderColor?: string;
  };
  columns: BuilderColumn[];
  style?: ResponsiveStyle;
};

export type LandingpageSectionSettings = {
  logoType?: "image" | "text";
  logoText?: string;
  logoImageUrl?: string;
  logoAlt?: string;
  logoWidth?: string;
  logoHeight?: string;
  logoUrl?: string;
  headerLogoUrl?: string;
  headerLogoAlt?: string;
  headerLogoWidth?: string;
  headerLogoHeight?: string;
  headerLogoPosition?: "left" | "center";
  headerShowTextFallback?: boolean;
  headerTextFallback?: string;
  menuItem1Text?: string;
  menuItem2Text?: string;
  menuItem3Text?: string;
  headerCtaText?: string;
  headerCtaUrl?: string;
  headerAlignment?: "left" | "center" | "right";
  headline?: string;
  subheadline?: string;
  bodyText?: string;
  textDu?: string;
  textSie?: string;
  headlineDu?: string;
  headlineSie?: string;
  bodyTextDu?: string;
  bodyTextSie?: string;
  ctaTextDu?: string;
  ctaTextSie?: string;
  ctaText?: string;
  ctaUrl?: string;
  reportTitle?: string;
  reportDescription?: string;
  reportButtonText?: string;
  reportShowIcon?: boolean;
  reportShowQrCode?: boolean;
  roiVehicles?: string;
  roiDispatchers?: string;
  roiOrdersPerDay?: string;
  roiManualEffort?: string;
  roiMonthlyLoss?: string;
  buttonTargetType?: "internal_booking" | "external_url" | "calendar" | "scroll_section";
  buttonLinkType?: "url" | "scroll" | "mail" | "phone" | "calendar";
  buttonTargetSection?: string;
  buttonStyle?: "primary" | "secondary" | "outline";
  buttonWidthMode?: "auto" | "full" | "custom";
  buttonCustomWidth?: string;
  buttonPaddingX?: string;
  buttonPaddingY?: string;
  buttonBorderRadius?: string;
  buttonBorderColor?: string;
  buttonBorderWidth?: string;
  buttonFontSize?: string;
  buttonFontWeight?: string;
  buttonShadow?: boolean;
  buttonHoverEffect?: "none" | "lift" | "scale" | "brighten";
  buttonAnimation?: "none" | "lift" | "pulse" | "glow" | "slide" | "scale" | "bounce";
  buttonAlignment?: "left" | "center" | "right";
  buttonMarginTop?: string;
  buttonMarginBottom?: string;
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
  iconStyle?: "x_check";
  showArrowEmoji?: boolean;
  videoAssetId?: string;
  videoUrl?: string;
  videoMobileUrl?: string;
  videoWebmUrl?: string;
  thumbnailUrl?: string;
  videoPreload?: "none" | "metadata" | "auto";
  videoWidthMode?: "full" | "auto" | "custom";
  videoCustomWidth?: string;
  videoMaxWidth?: string;
  videoHeightMode?: "auto" | "custom";
  videoCustomHeight?: string;
  videoAspectRatio?: "16 / 9" | "4 / 5" | "1 / 1" | "9 / 16";
  videoObjectFit?: "cover" | "contain";
  videoBorderRadius?: string;
  videoShadow?: boolean;
  videoBackgroundColor?: string;
  videoPadding?: string;
  videoAlign?: "left" | "center" | "right";
  autoplay?: boolean;
  controls?: boolean;
  buttonText?: string;
  position?: string;
  fontFamily?: string;
  fontSize?: "small" | "normal" | "large";
  headlineSize?: "small" | "normal" | "large";
  textSize?: "small" | "normal" | "large";
  alignment?: "left" | "center" | "right";
  backgroundType?: "default" | "none" | "color" | "gradient" | "image";
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: "top-bottom" | "left-right" | "diagonal" | "radial";
  backgroundImageUrl?: string;
  backgroundSize?: "cover" | "contain" | "auto";
  backgroundPosition?: "center" | "top" | "bottom" | "left" | "right";
  backgroundRepeat?: "no-repeat" | "repeat";
  overlayColor?: string;
  overlayOpacity?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonHoverColor?: string;
  buttonHoverTextColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
  shadow?: string;
  animation?: string;
  lineHeight?: string;
  letterSpacing?: string;
  fontWeight?: string;
  muted?: boolean;
  loop?: boolean;
  visibleDesktop?: boolean;
  visibleTablet?: boolean;
  visibleMobile?: boolean;
  style?: ResponsiveStyle;
  spacingTop?: string;
  spacingBottom?: string;
  width?: SectionWidth;
  layout?: SectionLayout;
  videoPosition?: "left" | "right";
  videoLabel?: string;
  legalMode?: "external_link" | "text";
  legalTab?: "impressum" | "datenschutz" | "cookies";
  legalUrl?: string;
  legalText?: string;
  bookingUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  spacerHeight?: string;
  benefitItems?: Array<{ title: string; text: string }>;
  faqItems?: Array<{ question: string; answer: string }>;
  beforeItems?: string[];
  afterItems?: string[];
};

export type LandingpageSection = {
  id: string;
  type: LandingpageSectionType;
  name: string;
  enabled: boolean;
  order: number;
  settings: LandingpageSectionSettings;
  containers?: BuilderContainer[];
  style?: ResponsiveStyle;
  responsive?: ResponsiveStyle;
};

export type GlobalLandingpageDesign = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  fontFamily: string;
  headlineSize: string;
  buttonRadius: string;
  cardRadius: string;
  shadow: "soft" | "strong";
  pageWidth: SectionWidth;
};

export type RenderedLandingpageSection = LandingpageSection & {
  settings: LandingpageSectionSettings;
};

const sectionLabels: Record<LandingpageSectionType, string> = {
  header: "Header",
  hero: "Hero",
  personal_video: "Persönliches Video",
  explainer_video: "Erklärvideo",
  comparison: "Vergleich",
  cta: "CTA",
  approach: "Vorgehen",
  faq: "FAQ",
  textblock: "Textblock",
  image: "Bild",
  video: "Video",
  cta_button: "CTA Button",
  pdf_report_download: "PDF Report Download",
  print_report_cta: "Print Report CTA",
  roi_report: "ROI Report",
  benefits: "Vorteilskarten",
  divider: "Trennlinie",
  spacer: "Spacer",
  image_text: "Bild/Text",
  trust: "Trust Elemente",
  booking: "Buchungsseite",
  thank_you: "Danke-Seite",
  legal: "Rechtliches",
  footer: "Footer"
};

export function defaultLandingpageTemplate(): Prisma.LandingpageTemplateCreateInput {
  return {
    name: "Tasklytic Standard",
    isDefault: true,
    logoUrl: null,
    headerLogoUrl: null,
    headerLogoAlt: "Tasklytic",
    headerLogoWidth: null,
    headerLogoHeight: null,
    headerLogoPosition: "left",
    headerShowTextFallback: true,
    headerTextFallback: "Tasklytic",
    primaryColor: landingDesignTokens.colors.primary,
    accentColor: landingDesignTokens.colors.accent,
    backgroundMode: "light",
    addressForm: "du",
    defaultCtaText: "Gratis Termin vereinbaren",
    defaultCtaUrl: "mailto:nikolai@tasklytic.de",
    bookingMode: "embedded_page",
    bookingHeadline: "Termin mit Tasklytic vereinbaren",
    bookingSubheadline: "Wähle einen passenden Zeitpunkt auf der eingebetteten externen Buchungsseite.",
    bookingBackText: "Zurück zur Landingpage",
    bookingExternalButtonText: "Termin extern öffnen",
    heroEnabled: true,
    heroEyebrow: "Tasklytic",
    heroHeadline: "Hey {{vorname}}, ich habe {{dir}} ein kurzes Video aufgenommen",
    heroSubheadline: "Für {{companyName}} in {{city}}",
    heroBodyText:
      "Ich habe mir {{companyName}} kurz angesehen und zeige {{dir}}, wo bei Aufträgen, Abstimmung und Übergaben unnötig Zeit verloren gehen kann.",
    heroCtaText: "Gratis Termin vereinbaren",
    heroCtaUrl: "{{calendarUrl}}",
    heroSecondaryCtaText: "Video ansehen",
    heroSecondaryCtaUrl: "{{videoUrl}}",
    heroVideoPosition: "right",
    heroLayout: "video_right",
    personalVideoEnabled: true,
    personalVideoUrl: null,
    personalVideoThumbnailUrl: null,
    personalVideoTitle: "Hey {{vorname}}, ich habe {{dir}} ein kurzes Video aufgenommen",
    personalVideoButtonText: "Persönliches Video ansehen",
    explainerVideoEnabled: true,
    explainerVideoUrl: null,
    explainerVideoThumbnailUrl: null,
    explainerVideoTitle:
      "Wo bei {{euch}} täglich Zeit durch manuelle Abläufe verloren geht und wie {{ihr}} das in den Griff bekommt. In 90 Sekunden.",
    explainerVideoSubline: "Ein kurzer Überblick, wie Tasklytic operative Abläufe in Dispo und Backoffice entlastet.",
    explainerVideoButtonText: "Erklärvideo ansehen",
    explainerCtaText: "Termin vereinbaren",
    explainerCtaUrl: "{{calendarUrl}}",
    comparisonEnabled: true,
    comparisonHeadline: "Vorher und nachher",
    beforeItems: [
      "Rückfragen laufen verteilt über Telefon, E-Mail und einzelne Personen.",
      "Dokumente und Status müssen manuell nachgefasst werden.",
      "Dispo und Backoffice verlieren Zeit durch wiederkehrende Übergaben."
    ],
    afterItems: [
      "Rückfragen, Status und Dokumente laufen strukturierter zusammen.",
      "Wiederkehrende Schritte werden sauber vorbereitet.",
      "Teams gewinnen Zeit für Entscheidungen statt Nacharbeit."
    ],
    approachEnabled: true,
    approachHeadline: "Unser Ansatz",
    approachText:
      "Tasklytic identifiziert wiederkehrende manuelle Abläufe und baut daraus schlanke Automatisierungen, die zu bestehenden Prozessen passen.",
    faqEnabled: true,
    faqJson: [
      {
        question: "Ist das eine Standardlösung?",
        answer: "Nein. Der erste Schritt ist ein kurzer Blick auf {{eure}} konkreten Abläufe und vorhandenen Systeme."
      },
      {
        question: "Muss direkt ein großes Projekt gestartet werden?",
        answer: "Nein. Sinnvoll ist ein kleiner, messbarer Startpunkt mit klarem Nutzen für Disposition oder Backoffice."
      }
    ],
    sectionsJson: [],
    globalDesignJson: {},
    finalCtaEnabled: true,
    finalCtaHeadline: "{{checkIntro}}, ob sich das für {{companyName}} lohnt.",
    finalCtaText: "Gratis Termin vereinbaren",
    finalCtaUrl: "{{calendarUrl}}",
    footerText: "Tasklytic"
  };
}

export function defaultGlobalDesign(template?: Pick<LandingpageTemplate, "primaryColor" | "accentColor"> | null): GlobalLandingpageDesign {
  return {
    primaryColor: template?.primaryColor ?? landingDesignTokens.colors.primary,
    accentColor: template?.accentColor ?? landingDesignTokens.colors.accent,
    backgroundColor: landingDesignTokens.colors.background,
    textColor: landingDesignTokens.colors.ink,
    buttonColor: template?.primaryColor ?? landingDesignTokens.colors.primary,
    fontFamily: landingDesignTokens.typography.fontFamily,
    headlineSize: "48",
    buttonRadius: landingDesignTokens.radius.button,
    cardRadius: landingDesignTokens.radius.card,
    shadow: "soft",
    pageWidth: "normal"
  };
}

export function getGlobalLandingpageDesign(template: LandingpageTemplate | null | undefined): GlobalLandingpageDesign {
  const raw = parseJsonValue(template?.globalDesignJson, {});
  const design = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Partial<GlobalLandingpageDesign> : {};
  return {
    ...defaultGlobalDesign(template),
    ...design
  };
}

export function createLandingpageSection(type: LandingpageSectionType, order = 1): LandingpageSection {
  const settings = defaultSectionSettings(type);
  return {
    id: `section_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    name: sectionLabels[type],
    enabled: true,
    order,
    settings,
    containers: defaultBuilderContainers(type, settings),
    responsive: defaultSectionResponsive(settings)
  };
}

function defaultSectionResponsive(settings: LandingpageSectionSettings): ResponsiveStyle {
  return {
    desktop: {
      paddingTop: numberOr(settings.paddingTop, 48),
      paddingBottom: numberOr(settings.paddingBottom, 48),
      paddingLeft: numberOr(settings.paddingLeft, 32),
      paddingRight: numberOr(settings.paddingRight, 32),
      marginTop: numberOr(settings.marginTop, 0),
      marginBottom: numberOr(settings.marginBottom, 0),
      moduleWidth: "100%",
      moduleHeight: "",
      maxWidth: 1200,
      gap: 40,
      borderRadius: settings.borderRadius ?? "0",
      alignment: settings.alignment ?? "left",
      videoCustomHeight: settings.videoCustomHeight ?? "",
      videoHeightMode: settings.videoHeightMode ?? "auto",
      videoObjectFit: settings.videoObjectFit ?? "cover",
      autoplay: settings.autoplay === true,
      muted: settings.muted === true
    },
    tablet: {
      paddingTop: Math.max(32, numberOr(settings.paddingTop, 48) - 8),
      paddingBottom: Math.max(32, numberOr(settings.paddingBottom, 48) - 8),
      paddingLeft: 24,
      paddingRight: 24,
      marginTop: numberOr(settings.marginTop, 0),
      marginBottom: numberOr(settings.marginBottom, 0),
      moduleWidth: "100%",
      moduleHeight: "",
      maxWidth: 768,
      gap: 28,
      borderRadius: settings.borderRadius ?? "0",
      alignment: settings.alignment ?? "left",
      videoCustomHeight: settings.videoCustomHeight ?? "",
      videoHeightMode: settings.videoHeightMode ?? "auto",
      videoObjectFit: settings.videoObjectFit ?? "cover",
      autoplay: settings.autoplay === true,
      muted: settings.muted === true
    },
    mobile: {
      paddingTop: Math.max(24, numberOr(settings.paddingTop, 48) - 16),
      paddingBottom: Math.max(24, numberOr(settings.paddingBottom, 48) - 16),
      paddingLeft: 16,
      paddingRight: 16,
      marginTop: numberOr(settings.marginTop, 0),
      marginBottom: numberOr(settings.marginBottom, 0),
      moduleWidth: "100%",
      moduleHeight: "",
      maxWidth: 390,
      gap: 20,
      borderRadius: settings.borderRadius ?? "0",
      alignment: settings.alignment ?? "left",
      videoCustomHeight: settings.videoCustomHeight ?? "",
      videoHeightMode: settings.videoHeightMode ?? "auto",
      videoObjectFit: settings.videoObjectFit ?? "cover",
      autoplay: settings.autoplay === true,
      muted: settings.muted === true
    }
  };
}

export function defaultSectionSettings(type: LandingpageSectionType): LandingpageSectionSettings {
  const base: LandingpageSectionSettings = {
    headline: sectionLabels[type],
    subheadline: "",
    bodyText: "",
    ctaText: "",
    ctaUrl: "",
    fontFamily: "Inter",
    fontSize: "normal",
    headlineSize: "large",
    textSize: "normal",
    alignment: "left",
    backgroundType: "default",
    backgroundColor: "transparent",
    gradientFrom: "",
    gradientTo: "",
    gradientDirection: "top-bottom",
    backgroundImageUrl: "",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    overlayColor: "#000000",
    overlayOpacity: "0",
    textColor: landingDesignTokens.colors.ink,
    buttonColor: landingDesignTokens.colors.primary,
    buttonTextColor: "#ffffff",
    buttonHoverColor: landingDesignTokens.colors.secondary,
    buttonHoverTextColor: "#ffffff",
    buttonLinkType: "url",
    buttonWidthMode: "auto",
    buttonCustomWidth: "220",
    buttonPaddingX: "22",
    buttonPaddingY: "14",
    buttonBorderRadius: landingDesignTokens.radius.button,
    buttonBorderColor: "transparent",
    buttonBorderWidth: "0",
    buttonFontSize: "14",
    buttonFontWeight: "700",
    buttonShadow: true,
    buttonHoverEffect: "lift",
    buttonAnimation: "none",
    buttonAlignment: "left",
    buttonMarginTop: "0",
    buttonMarginBottom: "0",
    borderColor: landingDesignTokens.colors.border,
    borderWidth: "0",
    borderRadius: "0",
    paddingTop: "48",
    paddingBottom: "48",
    paddingLeft: "32",
    paddingRight: "32",
    marginTop: "0",
    marginBottom: "0",
    marginLeft: "0",
    marginRight: "0",
    shadow: "none",
    animation: "none",
    lineHeight: "1.25",
    letterSpacing: "0",
    fontWeight: "600",
    muted: false,
    loop: false,
    videoWidthMode: "full",
    videoCustomWidth: landingDesignTokens.layout.videoWidth,
    videoMaxWidth: landingDesignTokens.layout.videoWidth,
    videoHeightMode: "auto",
    videoCustomHeight: "",
    videoAspectRatio: "16 / 9",
    videoObjectFit: "cover",
    videoPreload: "none",
    videoBorderRadius: landingDesignTokens.radius.video,
    videoShadow: true,
    videoBackgroundColor: "transparent",
    videoPadding: "0",
    videoAlign: "center",
    visibleDesktop: true,
    visibleTablet: true,
    visibleMobile: true,
    style: {
      desktop: { fontSize: 48 },
      tablet: { fontSize: 38 },
      mobile: { fontSize: 30 }
    },
    spacingTop: "48",
    spacingBottom: "48",
    width: "normal",
    layout: type === "comparison" ? "two_cards" : "left"
  };

  if (type === "faq") {
    return { ...base, faqItems: [{ question: "Frage", answer: "Antwort" }] };
  }
  if (type === "image") {
    return { ...base, headline: "", imageUrl: "", imageAlt: "", alignment: "center" };
  }
  if (type === "video") {
    return { ...base, headline: "Video", videoUrl: "", thumbnailUrl: "", autoplay: false, controls: true, buttonText: "Video ansehen", alignment: "center", layout: "centered", backgroundColor: "transparent" };
  }
  if (type === "cta_button") {
    return { ...base, headline: "", ctaText: "Gratis Termin vereinbaren", ctaUrl: "{{calendarUrl}}", buttonTargetType: "calendar", buttonLinkType: "calendar", buttonStyle: "primary", alignment: "center", buttonAlignment: "center" };
  }
  if (type === "pdf_report_download") {
    return {
      ...base,
      headline: "Kurzreport für {{companyName}} herunterladen",
      bodyText: "Die wichtigsten Beobachtungen, mögliche Zeitfresser und nächste Schritte als kompakter PDF-Report.",
      reportTitle: "Kurzreport für {{companyName}} herunterladen",
      reportDescription: "Die wichtigsten Beobachtungen, mögliche Zeitfresser und nächste Schritte als kompakter PDF-Report.",
      reportButtonText: "Kurzreport generieren",
      reportShowIcon: true,
      reportShowQrCode: false,
      alignment: "left",
      backgroundColor: landingDesignTokens.colors.background,
      borderRadius: "24",
      borderWidth: "1"
    };
  }
  if (type === "print_report_cta") {
    return {
      ...base,
      headline: "Analyse intern weitergeben",
      bodyText: "Diese Analyse können Sie auch als PDF speichern oder intern weitergeben.",
      reportButtonText: "PDF Kurzreport öffnen",
      reportShowIcon: true,
      reportShowQrCode: false,
      alignment: "center",
      backgroundColor: "#ffffff",
      borderRadius: "24",
      borderWidth: "1"
    };
  }
  if (type === "roi_report") {
    return {
      ...base,
      headline: "ROI-Kurzcheck für {{companyName}}",
      bodyText: "Eine grobe Einordnung, wie viel manuelle Abstimmung im Tagesgeschäft kosten kann.",
      reportButtonText: "PDF Kurzreport öffnen",
      roiVehicles: "25",
      roiDispatchers: "3",
      roiOrdersPerDay: "45",
      roiManualEffort: "12 Minuten pro Auftrag",
      roiMonthlyLoss: "8.100 EUR",
      alignment: "left",
      backgroundColor: "#ffffff",
      borderRadius: "24",
      borderWidth: "1"
    };
  }
  if (type === "benefits") {
    return {
      ...base,
      headline: "Vorteile",
      benefitItems: [
        { title: "Weniger Nacharbeit", text: "Wiederkehrende Abstimmung wird sauberer vorbereitet." },
        { title: "Mehr Überblick", text: "Status, Aufgaben und Übergaben sind schneller greifbar." },
        { title: "Schneller Start", text: "Der erste Schritt bleibt klein und messbar." }
      ]
    };
  }
  if (type === "divider") {
    return { ...base, headline: "", spacingTop: "24", spacingBottom: "24" };
  }
  if (type === "spacer") {
    return { ...base, headline: "", spacingTop: "0", spacingBottom: "0", spacerHeight: "48" };
  }
  if (type === "comparison") {
    return {
      ...base,
      headline: "Vorher und nachher",
      subheadline: "So verändert sich der operative Alltag, wenn wiederkehrende manuelle Schritte sauber vorbereitet werden.",
      leftTitle: "Vorher",
      rightTitle: "Nachher",
      iconStyle: "x_check",
      layout: "two_cards",
      beforeItems: ["Rückfragen laufen verteilt über Telefon, E-Mail und einzelne Personen.", "Dokumente und Status müssen manuell nachgefasst werden."],
      afterItems: ["Rückfragen, Status und Dokumente laufen strukturierter zusammen.", "Teams gewinnen Zeit für Entscheidungen statt Nacharbeit."],
      leftItems: ["Rückfragen laufen verteilt über Telefon, E-Mail und einzelne Personen.", "Dokumente und Status müssen manuell nachgefasst werden."],
      rightItems: ["Rückfragen, Status und Dokumente laufen strukturierter zusammen.", "Teams gewinnen Zeit für Entscheidungen statt Nacharbeit."]
    };
  }
  if (type === "header") {
    return {
      ...base,
      logoType: "text",
      logoText: "Tasklytic",
      logoImageUrl: "",
      logoAlt: "Tasklytic",
      logoWidth: "140",
      logoHeight: "",
      logoUrl: "",
      headerLogoUrl: "",
      headerLogoAlt: "Tasklytic",
      headerLogoWidth: "140",
      headerLogoHeight: "",
      headerLogoPosition: "left",
      headerShowTextFallback: true,
      headerTextFallback: "Tasklytic",
      menuItem1Text: "Warum wir?",
      menuItem2Text: "Unser Ansatz",
      menuItem3Text: "FAQ",
      headerCtaText: "{{cta}} {{vorname}}",
      headerCtaUrl: "{{calendarUrl}}",
      headerAlignment: "left",
      spacingTop: "0",
      spacingBottom: "0"
    };
  }
  if (type === "hero") {
    return {
      ...base,
      headline: "Hey {{vorname}}, ich habe {{dir}} ein kurzes Video aufgenommen",
      bodyText: "Ich habe mir {{companyName}} kurz angesehen und zeige {{dir}}, wo bei Aufträgen, Abstimmung und Übergaben unnötig Zeit verloren gehen kann.",
      ctaText: "Gratis Termin vereinbaren",
      ctaUrl: "{{calendarUrl}}",
      videoUrl: "",
      thumbnailUrl: "",
      autoplay: false,
      controls: true,
      videoLabel: "Persönliches Video ansehen!",
      videoPosition: "right",
      layout: "two_columns",
      backgroundColor: "transparent"
    };
  }
  if (type === "explainer_video") {
    return {
      ...base,
      headline: "Wo bei {{euch}} täglich Zeit durch manuelle Abläufe verloren geht und wie {{ihr}} das in den Griff bekommt. In 90 Sekunden.",
      subheadline: "{{watchPrompt}}",
      videoUrl: "",
      thumbnailUrl: "",
      autoplay: false,
      controls: true,
      buttonText: "Erklärvideo ansehen",
      ctaText: "Jetzt Abläufe gemeinsam durchgehen",
      ctaUrl: "{{calendarUrl}}",
      showArrowEmoji: true,
      alignment: "center",
      layout: "centered",
      backgroundColor: "transparent"
    };
  }
  if (type === "personal_video") {
    return { ...base, videoUrl: "", thumbnailUrl: "", buttonText: "Video ansehen", position: "right" };
  }
  if (type === "cta") {
    return {
      ...base,
      headline: "{{vorname}}, wie viel Zeit verliert {{ihr}} täglich durch unnötige manuelle Abläufe?",
      bodyText: "Lass uns gemeinsam prüfen, welche Abläufe schnell entlastet werden können.",
      ctaText: "{{vorname}}, jetzt Abläufe prüfen!",
      ctaUrl: "{{calendarUrl}}",
      alignment: "center"
    };
  }
  if (type === "textblock") {
    return {
      ...base,
      headline: "{{checkIntro}}, ob sich das für {{companyName}} lohnt.",
      bodyText: "",
      ctaText: "Gratis Termin vereinbaren",
      ctaUrl: "{{calendarUrl}}",
      backgroundColor: landingDesignTokens.colors.surfaceDark,
      textColor: "#ffffff",
      alignment: "center"
    };
  }
  if (type === "booking") {
    return { ...base, headline: "Termin vereinbaren", subheadline: "Wähle einen passenden Zeitpunkt aus.", bookingUrl: "{{calendarUrl}}", alignment: "center" };
  }
  if (type === "thank_you") {
    return { ...base, headline: "Termin erfolgreich gebucht, {{vorname}}!", bodyText: "Vielen Dank für {{deine}} Buchung. {{youReceive}} in Kürze eine Bestätigungsmail mit allen Details zu {{deinem}} Termin.", alignment: "center" };
  }
  if (type === "legal") {
    return { ...base, legalTab: "impressum", legalMode: "text", legalUrl: "", legalText: "Rechtstext hier einfügen.", alignment: "left" };
  }
  return base;
}

export function defaultBuilderContainers(type: LandingpageSectionType, settings = defaultSectionSettings(type)): BuilderContainer[] {
  const columns = type === "hero" || type === "comparison" ? 2 : type === "benefits" ? 3 : 1;
  return [
    {
      id: `container_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      settings: {
        maxWidth: 1200,
        display: "grid",
        columns,
        gap: columns > 1 ? 40 : 24,
        alignment: "stretch",
        padding: 0,
        backgroundColor: "transparent",
        borderColor: "transparent"
      },
      columns: Array.from({ length: columns }).map((_, index) => ({
        id: `column_${Date.now()}_${index + 1}_${Math.random().toString(36).slice(2, 6)}`,
        width: Math.round(100 / columns),
        elements: defaultBuilderElements(type, settings, index),
        style: {
          desktop: { width: Math.round(100 / columns) },
          tablet: { width: columns > 1 ? 50 : 100 },
          mobile: { width: 100 }
        }
      })),
      style: {
        desktop: { columns, gap: columns > 1 ? 40 : 24, maxWidth: 1200 },
        tablet: { columns: Math.min(columns, 2), gap: 28, maxWidth: 768 },
        mobile: { columns: 1, gap: 20, maxWidth: 390 }
      }
    }
  ];
}

function defaultBuilderElements(type: LandingpageSectionType, settings: LandingpageSectionSettings, columnIndex: number): BuilderElement[] {
  if (type === "hero") {
    return columnIndex === 0
      ? [
          builderElement("headline", { field: "headline", text: settings.headline, textDu: settings.headlineDu, textSie: settings.headlineSie }, defaultTextElementStyle("headline")),
          builderElement("text", { field: "bodyText", text: settings.bodyText, textDu: settings.bodyTextDu, textSie: settings.bodyTextSie }, defaultTextElementStyle("text")),
          builderElement("button", buttonElementProps(settings, "ctaText"))
        ]
      : [builderElement("video", { field: "videoUrl", url: settings.videoUrl, poster: settings.thumbnailUrl })];
  }
  if (type === "comparison") {
    return [builderElement("list", { title: columnIndex === 0 ? settings.leftTitle : settings.rightTitle, items: columnIndex === 0 ? settings.leftItems : settings.rightItems })];
  }
  if (type === "video" || type === "explainer_video") return [builderElement("video", { field: "videoUrl", url: settings.videoUrl, poster: settings.thumbnailUrl })];
  if (type === "image") return [builderElement("image", { field: "imageUrl", url: settings.imageUrl, alt: settings.imageAlt })];
  if (type === "cta" || type === "cta_button") return [builderElement("button", buttonElementProps(settings, "ctaText"))];
  if (type === "faq") {
    return [
      builderElement("headline", { field: "headline", text: settings.headline }, defaultTextElementStyle("headline")),
      ...(settings.faqItems ?? []).flatMap((item, index) => [
        builderElement("headline", { itemList: "faqItems", itemIndex: index, itemKey: "question", text: item.question }, faqTextElementStyle("question")),
        builderElement("text", { itemList: "faqItems", itemIndex: index, itemKey: "answer", text: item.answer }, faqTextElementStyle("answer"))
      ])
    ];
  }
  if (type === "spacer") return [builderElement("spacer", { height: settings.spacerHeight ?? "48" })];
  return [
    builderElement("headline", { field: "headline", text: settings.headline }, defaultTextElementStyle("headline")),
    builderElement("text", { field: "bodyText", text: settings.bodyText }, defaultTextElementStyle("text"))
  ];
}

function builderElement(type: BuilderElementType, props: Record<string, unknown>, style?: BuilderElementStyle): BuilderElement {
  return {
    id: `element_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    props,
    style: style ?? { desktop: {}, tablet: {}, mobile: {} },
    editable: true
  };
}

function buttonElementProps(settings: LandingpageSectionSettings, field: "ctaText" | "headerCtaText"): Record<string, unknown> & ButtonBuilderElementProps {
  return {
    type: "button",
    field,
    text: field === "headerCtaText" ? settings.headerCtaText ?? "" : settings.ctaText ?? "",
    href: field === "headerCtaText" ? settings.headerCtaUrl ?? "" : settings.ctaUrl ?? "",
    variant: settings.buttonStyle ?? "primary",
    size: "md",
    backgroundColor: settings.buttonColor ?? landingDesignTokens.colors.primary,
    textColor: settings.buttonTextColor ?? "#ffffff",
    borderRadius: settings.buttonBorderRadius ?? "14",
    paddingX: settings.buttonPaddingX ?? "22",
    paddingY: settings.buttonPaddingY ?? "14",
    fontSize: settings.buttonFontSize ?? "14",
    fontWeight: settings.buttonFontWeight ?? "700",
    alignment: settings.buttonAlignment ?? settings.alignment ?? "left",
    widthMode: settings.buttonWidthMode ?? "auto",
    shadow: settings.buttonShadow === true,
    hoverEffect: settings.buttonHoverEffect ?? "lift",
    animation: settings.buttonAnimation ?? "none"
  };
}

function defaultTextElementStyle(type: "headline" | "text"): BuilderElementStyle {
  if (type === "headline") {
    return {
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.1,
      color: landingDesignTokens.colors.ink,
      textAlign: "left",
      marginTop: 0,
      marginBottom: 24,
      desktop: { fontSize: 48 },
      tablet: { fontSize: 38 },
      mobile: { fontSize: 30 }
    };
  }
  return {
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: 400,
    lineHeight: 1.5,
    color: landingDesignTokens.colors.muted,
    textAlign: "left",
    marginTop: 0,
    marginBottom: 0,
    desktop: { fontSize: 22 },
    tablet: { fontSize: 20 },
    mobile: { fontSize: 17 }
  };
}

function faqTextElementStyle(type: "question" | "answer"): BuilderElementStyle {
  if (type === "question") {
    return {
      fontFamily: "Inter",
      fontSize: 20,
      fontWeight: 700,
      lineHeight: 1.3,
      color: landingDesignTokens.colors.ink,
      textAlign: "left",
      marginTop: 0,
      marginBottom: 8,
      desktop: { fontSize: 20 },
      tablet: { fontSize: 19 },
      mobile: { fontSize: 18 }
    };
  }
  return {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1.6,
    color: landingDesignTokens.colors.muted,
    textAlign: "left",
    marginTop: 8,
    marginBottom: 0,
    desktop: { fontSize: 15 },
    tablet: { fontSize: 15 },
    mobile: { fontSize: 14 }
  };
}

function normalizeBuilderContainers(input: unknown, type: LandingpageSectionType, settings: LandingpageSectionSettings): BuilderContainer[] {
  if (!Array.isArray(input) || input.length === 0) return defaultBuilderContainers(type, settings);
  return input.map((raw, index) => normalizeBuilderContainer(raw, index + 1)).filter((container): container is BuilderContainer => Boolean(container));
}

function normalizeBuilderContainer(raw: unknown, index: number): BuilderContainer | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Partial<BuilderContainer>;
  const columns = Array.isArray(source.columns) && source.columns.length > 0 ? source.columns : [{ id: `column_${index}_1`, width: 100, elements: [] }];
  return {
    id: typeof source.id === "string" && source.id ? source.id : `container_${index}`,
    settings: {
      maxWidth: numberOr(source.settings?.maxWidth, 1200),
      display: source.settings?.display === "flex" ? "flex" : "grid",
      columns: numberOr(source.settings?.columns, columns.length),
      gap: numberOr(source.settings?.gap, 24),
      alignment: source.settings?.alignment ?? "stretch",
      padding: numberOr(source.settings?.padding, 0),
      backgroundColor: source.settings?.backgroundColor ?? "transparent",
      borderColor: source.settings?.borderColor ?? "transparent"
    },
    columns: columns.map((column, columnIndex) => ({
      id: typeof column.id === "string" && column.id ? column.id : `column_${index}_${columnIndex + 1}`,
      width: numberOr(column.width, Math.round(100 / columns.length)),
      elements: Array.isArray(column.elements) ? column.elements.map((element, elementIndex) => normalizeBuilderElement(element, elementIndex + 1)).filter((element): element is BuilderElement => Boolean(element)) : [],
      style: isResponsiveStyle(column.style) ? column.style : undefined
    })),
    style: isBuilderElementStyle(source.style) ? source.style : undefined
  };
}

function normalizeBuilderElement(raw: unknown, index: number): BuilderElement | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Partial<BuilderElement>;
  if (!source.type) return null;
  return {
    id: typeof source.id === "string" && source.id ? source.id : `element_${index}`,
    type: source.type,
    props: source.props && typeof source.props === "object" ? source.props as Record<string, unknown> : {},
    style: isResponsiveStyle(source.style) ? source.style : { desktop: {}, tablet: {}, mobile: {} },
    editable: true
  };
}

function numberOr(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isResponsiveStyle(value: unknown): value is ResponsiveStyle {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBuilderElementStyle(value: unknown): value is BuilderElementStyle {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function legacyTemplateSections(template: LandingpageTemplate): LandingpageSection[] {
  const faqItems = Array.isArray(template.faqJson)
    ? (template.faqJson as Array<{ question?: string; answer?: string }>).map((item) => ({
        question: item.question ?? "",
        answer: item.answer ?? ""
      }))
    : [];
  return [
    {
      id: "section_header",
      type: "header",
      name: "Header",
      enabled: true,
      order: 1,
      settings: {
        ...defaultSectionSettings("header"),
        logoType: template.headerLogoUrl || template.logoUrl ? "image" : "text",
        logoText: template.headerTextFallback ?? "Tasklytic",
        logoImageUrl: template.headerLogoUrl ?? template.logoUrl ?? "",
        logoAlt: template.headerLogoAlt ?? "Tasklytic",
        logoWidth: template.headerLogoWidth?.toString() ?? "140",
        logoHeight: template.headerLogoHeight?.toString() ?? "",
        logoUrl: template.logoUrl ?? "",
        headerLogoUrl: template.headerLogoUrl ?? template.logoUrl ?? "",
        headerLogoAlt: template.headerLogoAlt ?? "Tasklytic",
        headerLogoWidth: template.headerLogoWidth?.toString() ?? "140",
        headerLogoHeight: template.headerLogoHeight?.toString() ?? "",
        headerLogoPosition: template.headerLogoPosition === "center" ? "center" : "left",
        headerShowTextFallback: template.headerShowTextFallback,
        headerTextFallback: template.headerTextFallback ?? "Tasklytic",
        headerCtaText: "{{cta}} {{vorname}}",
        headerCtaUrl: "{{calendarUrl}}"
      }
    },
    {
      id: "section_hero",
      type: "hero",
      name: "Hero",
      enabled: template.heroEnabled,
      order: 2,
      settings: {
        ...defaultSectionSettings("hero"),
        headline: template.heroHeadline,
        subheadline: template.heroSubheadline ?? "",
        bodyText: template.heroBodyText ?? "",
        ctaText: template.heroCtaText ?? template.defaultCtaText,
        ctaUrl: template.heroCtaUrl ?? "",
        videoUrl: template.personalVideoUrl ?? "",
        thumbnailUrl: template.personalVideoThumbnailUrl ?? "",
        videoLabel: template.personalVideoButtonText,
        videoPosition: template.heroVideoPosition === "left" ? "left" : "right",
        layout: template.heroLayout === "centered" ? "centered" : template.heroVideoPosition === "left" ? "right" : "left",
        backgroundColor: "transparent",
        textColor: landingDesignTokens.colors.ink,
        buttonColor: landingDesignTokens.colors.primary
      }
    },
    {
      id: "section_personal_video",
      type: "personal_video",
      name: "Persönliches Video",
      enabled: template.personalVideoEnabled,
      order: 3,
      settings: {
        ...defaultSectionSettings("personal_video"),
        headline: template.personalVideoTitle ?? "",
        videoUrl: template.personalVideoUrl ?? "",
        thumbnailUrl: template.personalVideoThumbnailUrl ?? "",
        buttonText: template.personalVideoButtonText
      }
    },
    {
      id: "section_explainer_video",
      type: "explainer_video",
      name: "Erklärvideo",
      enabled: template.explainerVideoEnabled,
      order: 4,
      settings: {
        ...defaultSectionSettings("explainer_video"),
        headline: template.explainerVideoTitle ?? "",
        subheadline: template.explainerVideoSubline ?? "",
        videoUrl: template.explainerVideoUrl ?? "",
        thumbnailUrl: template.explainerVideoThumbnailUrl ?? "",
        buttonText: template.explainerVideoButtonText,
        ctaText: template.explainerCtaText ?? template.defaultCtaText,
        ctaUrl: template.explainerCtaUrl ?? ""
      }
    },
    {
      id: "section_comparison",
      type: "comparison",
      name: "Vergleich",
      enabled: template.comparisonEnabled,
      order: 5,
      settings: {
        ...defaultSectionSettings("comparison"),
        headline: template.comparisonHeadline ?? "Vorher und nachher",
        leftTitle: "Vorher",
        rightTitle: "Nachher",
        beforeItems: template.beforeItems,
        afterItems: template.afterItems,
        leftItems: template.beforeItems,
        rightItems: template.afterItems,
        iconStyle: "x_check",
        layout: "two_cards"
      }
    },
    {
      id: "section_approach",
      type: "approach",
      name: "Vorgehen",
      enabled: template.approachEnabled,
      order: 6,
      settings: {
        ...defaultSectionSettings("approach"),
        headline: template.approachHeadline ?? "Unser Ansatz",
        bodyText: template.approachText ?? ""
      }
    },
    {
      id: "section_faq",
      type: "faq",
      name: "FAQ",
      enabled: template.faqEnabled,
      order: 7,
      settings: {
        ...defaultSectionSettings("faq"),
        headline: "FAQ",
        faqItems
      }
    },
    {
      id: "section_cta",
      type: "cta",
      name: "CTA",
      enabled: template.finalCtaEnabled,
      order: 8,
      settings: {
        ...defaultSectionSettings("cta"),
        headline: template.finalCtaHeadline ?? "",
        bodyText: "",
        ctaText: template.finalCtaText ?? template.defaultCtaText,
        ctaUrl: template.finalCtaUrl ?? "",
        backgroundColor: landingDesignTokens.colors.surfaceDark,
        textColor: "#ffffff",
        buttonColor: landingDesignTokens.colors.surface,
        buttonTextColor: landingDesignTokens.colors.primary,
        alignment: "center"
      }
    },
    {
      id: "section_booking",
      type: "booking",
      name: "Buchungsseite",
      enabled: true,
      order: 9,
      settings: {
        ...defaultSectionSettings("booking"),
        headline: template.bookingHeadline ?? "Termin vereinbaren",
        subheadline: template.bookingSubheadline ?? "",
        bookingUrl: "{{calendarUrl}}"
      }
    },
    {
      id: "section_thank_you",
      type: "thank_you",
      name: "Danke-Seite",
      enabled: true,
      order: 10,
      settings: defaultSectionSettings("thank_you")
    },
    {
      id: "section_legal",
      type: "legal",
      name: "Rechtliches",
      enabled: true,
      order: 11,
      settings: defaultSectionSettings("legal")
    },
    {
      id: "section_footer",
      type: "footer",
      name: "Footer",
      enabled: true,
      order: 12,
      settings: {
        ...defaultSectionSettings("footer"),
        bodyText: template.footerText ?? "Tasklytic",
        alignment: "center"
      }
    }
  ];
}

export function normalizeLandingpageSections(input: unknown, fallback?: LandingpageTemplate): LandingpageSection[] {
  const parsedInput = parseJsonValue(input, []);
  const rawSections = Array.isArray(parsedInput) && parsedInput.length > 0 ? parsedInput : fallback ? legacyTemplateSections(fallback) : [];
  return rawSections
    .map((raw, index) => normalizeLandingpageSection(raw, index + 1))
    .filter((section): section is LandingpageSection => Boolean(section))
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index + 1 }));
}

export function getLandingpageSections(template: LandingpageTemplate): LandingpageSection[] {
  return normalizeLandingpageSections(template.sectionsJson, template);
}

function parseJsonValue(input: unknown, fallback: unknown): unknown {
  if (typeof input !== "string") return input ?? fallback;
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

function normalizeLandingpageSection(raw: unknown, order: number): LandingpageSection | null {
  if (!raw || typeof raw !== "object") return null;
  const section = raw as Partial<LandingpageSection>;
  if (!section.type || !landingpageSectionTypes.includes(section.type)) return null;
  const settings = section.settings && typeof section.settings === "object" ? section.settings : {};
  const mergedSettings = {
    ...defaultSectionSettings(section.type),
    ...settings
  };
  if (
    section.type === "header"
    && !("logoType" in settings)
    && (typeof mergedSettings.logoImageUrl === "string" && mergedSettings.logoImageUrl
      || typeof mergedSettings.headerLogoUrl === "string" && mergedSettings.headerLogoUrl
      || typeof mergedSettings.logoUrl === "string" && mergedSettings.logoUrl)
  ) {
    mergedSettings.logoType = "image";
  }
  if (section.type === "comparison") {
    mergedSettings.leftItems = Array.isArray(mergedSettings.leftItems) ? mergedSettings.leftItems : mergedSettings.beforeItems;
    mergedSettings.rightItems = Array.isArray(mergedSettings.rightItems) ? mergedSettings.rightItems : mergedSettings.afterItems;
    mergedSettings.beforeItems = Array.isArray(mergedSettings.beforeItems) ? mergedSettings.beforeItems : mergedSettings.leftItems;
    mergedSettings.afterItems = Array.isArray(mergedSettings.afterItems) ? mergedSettings.afterItems : mergedSettings.rightItems;
  }
  const normalizedSettings = section.type === "header" ? normalizeHeaderLogoSettings(mergedSettings) : mergedSettings;

  return {
    id: typeof section.id === "string" && section.id ? section.id : `section_${order}`,
    type: section.type,
    name: typeof section.name === "string" && section.name ? section.name : sectionLabels[section.type],
    enabled: section.enabled !== false,
    order: typeof section.order === "number" ? section.order : order,
    settings: normalizedSettings,
    containers: normalizeBuilderContainers(section.containers, section.type, normalizedSettings),
    style: isResponsiveStyle(section.style) ? section.style : undefined,
    responsive: normalizeSectionResponsive(section, normalizedSettings)
  };
}

function normalizeSectionResponsive(section: Partial<LandingpageSection>, settings: LandingpageSectionSettings): ResponsiveStyle {
  const defaults = defaultSectionResponsive(settings);
  const source = isResponsiveStyle(section.responsive) ? section.responsive : isResponsiveStyle(section.style) ? section.style : {};
  return {
    desktop: { ...defaults.desktop, ...(source.desktop ?? {}) },
    tablet: { ...defaults.tablet, ...(source.tablet ?? {}) },
    mobile: { ...defaults.mobile, ...(source.mobile ?? {}) }
  };
}

export function addLandingpageSection(sections: LandingpageSection[], type: LandingpageSectionType): LandingpageSection[] {
  return normalizeLandingpageSections([...sections, createLandingpageSection(type, sections.length + 1)]);
}

export function deleteLandingpageSection(sections: LandingpageSection[], id: string): LandingpageSection[] {
  return normalizeLandingpageSections(sections.filter((section) => section.id !== id));
}

export function toggleLandingpageSection(sections: LandingpageSection[], id: string): LandingpageSection[] {
  return normalizeLandingpageSections(sections.map((section) => section.id === id ? { ...section, enabled: !section.enabled } : section));
}

export function moveLandingpageSection(sections: LandingpageSection[], id: string, direction: "up" | "down"): LandingpageSection[] {
  const ordered = normalizeLandingpageSections(sections);
  const index = ordered.findIndex((section) => section.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  const next = [...ordered];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((section, sectionIndex) => ({ ...section, order: sectionIndex + 1 }));
}

export function reorderLandingpageSections(sections: LandingpageSection[], activeId: string, overId: string): LandingpageSection[] {
  const ordered = normalizeLandingpageSections(sections);
  const from = ordered.findIndex((section) => section.id === activeId);
  const to = ordered.findIndex((section) => section.id === overId);
  if (from < 0 || to < 0 || from === to) return ordered;
  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((section, index) => ({ ...section, order: index + 1 }));
}

export function updateLandingpageSection(
  sections: LandingpageSection[],
  id: string,
  patch: Partial<LandingpageSection>
): LandingpageSection[] {
  return normalizeLandingpageSections(sections.map((section) => section.id === id ? { ...section, ...patch } : section));
}

export function renderLandingpageSections(template: LandingpageTemplate, prospect?: ProspectForTemplate | null, options: { isPreview?: boolean } = {}): RenderedLandingpageSection[] {
  const safeProspect = options.isPreview ? withPreviewLead(prospect) : normalizeTemplateLead(prospect);
  return getLandingpageSections(template)
    .filter((section) => section.enabled)
    .map((section) => ({
      ...section,
      settings: renderSectionSettings(applyProspectSectionOverrides(section, safeProspect), safeProspect, template)
    }));
}

function applyProspectSectionOverrides(section: LandingpageSection, prospect: ProspectForTemplate): LandingpageSectionSettings {
  const settings = { ...section.settings };
  if (section.type === "hero") {
    if (prospect.customHeroHeadline) settings.headline = prospect.customHeroHeadline;
    if (prospect.customHeroSubline) settings.subheadline = prospect.customHeroSubline;
    if (prospect.customHeroBodyText) settings.bodyText = prospect.customHeroBodyText;
    if (prospect.customHeroCtaText || prospect.individualCtaText) settings.ctaText = prospect.customHeroCtaText ?? prospect.individualCtaText ?? settings.ctaText;
    if (prospect.customHeroCtaUrl) settings.ctaUrl = prospect.customHeroCtaUrl;
    settings.videoUrl = prospect.personalVideoUrl || prospect.videoUrl || settings.videoUrl;
    settings.thumbnailUrl = prospect.personalVideoThumbnailUrl || settings.thumbnailUrl;
  }
  if (section.type === "explainer_video") {
    settings.videoUrl = prospect.explainerVideoUrl || settings.videoUrl;
  }
  return settings;
}

function renderSectionSettings(
  settings: LandingpageSectionSettings,
  prospect: ProspectForTemplate,
  template: Pick<LandingpageTemplate, "defaultCtaUrl" | "bookingMode" | "addressForm">
): LandingpageSectionSettings {
  const addressForm = normalizeAddressForm(template.addressForm);
  const render = (value: string | null | undefined) => renderText(value, prospect, { addressForm });
  const addressed = applyAddressFormVariants(settings, addressForm);
  return {
    ...addressed,
    headline: render(addressed.headline),
    subheadline: render(addressed.subheadline),
    bodyText: render(addressed.bodyText),
    ctaText: render(addressed.ctaText),
    ctaUrl: addressed.ctaUrl?.includes("{{calendarUrl}}")
      ? resolveBookingCtaUrl(addressed.ctaUrl, prospect, template)
      : render(addressed.ctaUrl),
    logoText: render(addressed.logoText),
    logoImageUrl: render(addressed.logoImageUrl),
    logoAlt: render(addressed.logoAlt),
    logoUrl: render(addressed.logoUrl),
    headerLogoUrl: render(addressed.headerLogoUrl),
    headerLogoAlt: render(addressed.headerLogoAlt),
    headerTextFallback: render(addressed.headerTextFallback),
    backgroundColor: render(addressed.backgroundColor),
    gradientFrom: render(addressed.gradientFrom),
    gradientTo: render(addressed.gradientTo),
    backgroundImageUrl: render(addressed.backgroundImageUrl),
    overlayColor: render(addressed.overlayColor),
    overlayOpacity: render(addressed.overlayOpacity),
    menuItem1Text: render(addressed.menuItem1Text),
    menuItem2Text: render(addressed.menuItem2Text),
    menuItem3Text: render(addressed.menuItem3Text),
    headerCtaText: render(addressed.headerCtaText),
    headerCtaUrl: addressed.headerCtaUrl?.includes("{{calendarUrl}}")
      ? resolveBookingCtaUrl(addressed.headerCtaUrl, prospect, template)
      : render(addressed.headerCtaUrl),
    buttonText: render(addressed.buttonText),
    videoUrl: render(addressed.videoUrl),
    videoMobileUrl: render(addressed.videoMobileUrl),
    videoWebmUrl: render(addressed.videoWebmUrl),
    thumbnailUrl: render(addressed.thumbnailUrl),
    videoLabel: render(addressed.videoLabel),
    bookingUrl: addressed.bookingUrl?.includes("{{calendarUrl}}") ? getBookingUrl(prospect) : render(addressed.bookingUrl),
    legalUrl: render(addressed.legalUrl),
    legalText: render(addressed.legalText),
    faqItems: safeArray(addressed.faqItems).map((item) => ({
      question: render(item.question),
      answer: render(item.answer)
    })),
    beforeItems: safeArray(addressed.beforeItems).map((item) => render(item)),
    afterItems: safeArray(addressed.afterItems).map((item) => render(item)),
    leftTitle: render(addressed.leftTitle),
    rightTitle: render(addressed.rightTitle),
    leftItems: safeArray(addressed.leftItems).map((item) => render(item)),
    rightItems: safeArray(addressed.rightItems).map((item) => render(item)),
    imageUrl: render(addressed.imageUrl),
    imageAlt: render(addressed.imageAlt),
    benefitItems: safeArray(addressed.benefitItems).map((item) => ({
      title: render(item.title),
      text: render(item.text)
    }))
  };
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

const addressCopyVariants: Record<string, Record<AddressForm, string>> = {
  "Hey {{vorname}}, ich habe {{dir}} ein kurzes Video aufgenommen": {
    du: "Hey {{vorname}}, ich habe {{dir}} ein kurzes Video aufgenommen",
    sie: "Hallo {{salutation}} {{lastName}}, ich habe Ihnen ein kurzes Video aufgenommen"
  },
  "Hey {{vorname}}, ich habe dir ein kurzes Video aufgenommen": {
    du: "Hey {{vorname}}, ich habe {{dir}} ein kurzes Video aufgenommen",
    sie: "Hallo {{salutation}} {{lastName}}, ich habe Ihnen ein kurzes Video aufgenommen"
  },
  "Ich habe mir {{companyName}} kurz angesehen und zeige dir, wo bei Aufträgen, Abstimmung und Übergaben unnötig Zeit verloren gehen kann.": {
    du: "Ich habe mir {{companyName}} kurz angesehen und zeige {{dir}}, wo bei Aufträgen, Abstimmung und Übergaben unnötig Zeit verloren gehen kann.",
    sie: "Ich habe mir {{companyName}} kurz angesehen und zeige Ihnen, wo bei Aufträgen, Abstimmung und Übergaben unnötig Zeit verloren gehen kann."
  },
  "Wo bei euch täglich Zeit durch manuelle Abläufe verloren geht und wie ihr das in den Griff bekommt. In 90 Sekunden.": {
    du: "Wo bei {{euch}} täglich Zeit durch manuelle Abläufe verloren geht und wie {{ihr}} das in den Griff bekommt. In 90 Sekunden.",
    sie: "Wo bei Ihnen täglich Zeit durch manuelle Abläufe verloren geht und wie Sie das in den Griff bekommen. In 90 Sekunden."
  },
  "Schau dir das kurz an!": {
    du: "{{watchPrompt}}",
    sie: "{{watchPrompt}}"
  },
  "Lass uns sprechen {{vorname}}": {
    du: "{{cta}} {{vorname}}",
    sie: "{{cta}}"
  },
  "{{cta}} {{vorname}}": {
    du: "{{cta}} {{vorname}}",
    sie: "{{cta}}"
  },
  "Lass uns kurz prüfen, ob sich das für {{companyName}} lohnt.": {
    du: "{{checkIntro}}, ob sich das für {{companyName}} lohnt.",
    sie: "{{checkIntro}}, ob sich das für {{companyName}} lohnt."
  },
  "Lass uns gemeinsam prüfen, welche Abläufe schnell entlastet werden können.": {
    du: "Lass uns gemeinsam prüfen, welche Abläufe schnell entlastet werden können.",
    sie: "Lassen Sie uns gemeinsam prüfen, welche Abläufe schnell entlastet werden können."
  },
  "{{vorname}}, wie viel Zeit verliert {{ihr}} täglich durch unnötige manuelle Abläufe?": {
    du: "{{vorname}}, wie viel Zeit verliert {{ihr}} täglich durch unnötige manuelle Abläufe?",
    sie: "Wie viel Zeit verliert {{companyName}} täglich durch unnötige manuelle Abläufe?"
  },
  "Nein. Der erste Schritt ist ein kurzer Blick auf eure konkreten Abläufe und vorhandenen Systeme.": {
    du: "Nein. Der erste Schritt ist ein kurzer Blick auf {{eure}} konkreten Abläufe und vorhandenen Systeme.",
    sie: "Nein. Der erste Schritt ist ein kurzer Blick auf Ihre konkreten Abläufe und vorhandenen Systeme."
  },
  "Vielen Dank für deine Buchung. Du erhältst in Kürze eine Bestätigungsmail mit allen Details zu deinem Termin.": {
    du: "Vielen Dank für {{deine}} Buchung. {{youReceive}} in Kürze eine Bestätigungsmail mit allen Details zu {{deinem}} Termin.",
    sie: "Vielen Dank für Ihre Buchung. Sie erhalten in Kürze eine Bestätigungsmail mit allen Details zu Ihrem Termin."
  }
};

function addressCopyVariant(value: string | undefined, addressForm: AddressForm): string | undefined {
  if (!value) return value;
  return addressCopyVariants[value.trim()]?.[addressForm] ?? value;
}

export function applyAddressFormVariants(settings: LandingpageSectionSettings, addressForm: AddressForm): LandingpageSectionSettings {
  const vars = addressFormVariables(addressForm);
  const replace = (value: string | undefined) => replaceAddressVariables(addressCopyVariant(value, addressForm), vars);
  const addressed: LandingpageSectionSettings = {
    ...settings,
    subheadline: replace(settings.subheadline),
    logoText: replace(settings.logoText),
    headerTextFallback: replace(settings.headerTextFallback),
    menuItem1Text: replace(settings.menuItem1Text),
    menuItem2Text: replace(settings.menuItem2Text),
    menuItem3Text: replace(settings.menuItem3Text),
    headerCtaText: replace(settings.headerCtaText),
    buttonText: replace(settings.buttonText),
    videoLabel: replace(settings.videoLabel),
    leftTitle: replace(settings.leftTitle),
    rightTitle: replace(settings.rightTitle),
    beforeItems: settings.beforeItems?.map((item) => replace(item) ?? ""),
    afterItems: settings.afterItems?.map((item) => replace(item) ?? ""),
    leftItems: settings.leftItems?.map((item) => replace(item) ?? ""),
    rightItems: settings.rightItems?.map((item) => replace(item) ?? ""),
    faqItems: settings.faqItems?.map((item) => ({
      question: replace(item.question) ?? "",
      answer: replace(item.answer) ?? ""
    })),
    benefitItems: settings.benefitItems?.map((item) => ({
      title: replace(item.title) ?? "",
      text: replace(item.text) ?? ""
    }))
  };
  if (addressForm === "sie") {
    return {
      ...addressed,
      headline: replace(settings.headlineSie || settings.textSie || settings.headline),
      bodyText: replace(settings.bodyTextSie || settings.textSie || settings.bodyText),
      ctaText: replace(settings.ctaTextSie || settings.ctaText)
    };
  }
  return {
    ...addressed,
    headline: replace(settings.headlineDu || settings.textDu || settings.headline),
    bodyText: replace(settings.bodyTextDu || settings.textDu || settings.bodyText),
    ctaText: replace(settings.ctaTextDu || settings.ctaText)
  };
}

export async function getActiveTemplate(prospect?: ProspectForTemplate | null): Promise<LandingpageTemplate> {
  if (prospect?.landingpageTemplateId) {
    const assigned = await prisma.landingpageTemplate.findUnique({ where: { id: prospect.landingpageTemplateId } });
    if (assigned) return assigned;
  }

  const existing = await prisma.landingpageTemplate.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" }
  });

  if (existing) return existing;

  return prisma.landingpageTemplate.create({ data: defaultLandingpageTemplate() });
}

export function buildTemplateVariables(prospect?: LeadForTemplate | null, landingpageUrl?: string, options: { isPreview?: boolean; addressForm?: AddressForm } = {}): Record<string, string> {
  const safeProspect = options.isPreview ? withPreviewLead(prospect) : normalizeTemplateLead(prospect);
  const nameParts = splitPersonName(safeProspect.decisionMakerName);
  const firstName = cleanTemplateValue(safeProspect.firstName) || nameParts.firstName || "";
  const lastName = cleanTemplateValue(safeProspect.lastName) || nameParts.lastName || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || cleanTemplateValue(safeProspect.decisionMakerName) || "";
  const companyName = cleanTemplateValue(safeProspect.companyName) || cleanTemplateValue(safeProspect.legalName) || cleanTemplateValue(safeProspect.name) || neutralTemplateFallbacks.companyName;
  const city = safeProspect.city ?? neutralTemplateFallbacks.city;
  const salutation = safeProspect.salutation ?? neutralTemplateFallbacks.salutation;
  const decisionMakerName = safeProspect.decisionMakerName ?? fullName;
  const resolvedLandingpageUrl = landingpageUrl ?? safeProspect.landingpageUrl ?? (safeProspect.slug ? `/p/${safeProspect.slug}` : neutralTemplateFallbacks.landingpageUrl);
  const calendarUrl = safeProspect.bookingUrl ?? safeProspect.calendarUrl ?? neutralTemplateFallbacks.calendarUrl;
  const addressVars = options.addressForm ? addressFormVariables(options.addressForm) : null;
  return {
    vorname: firstName,
    nachname: lastName,
    firstName,
    lastName,
    firma: companyName,
    companyName,
    stadt: city,
    city,
    anrede: salutation,
    salutation,
    cta: addressVars?.cta ?? "",
    headline: addressVars?.headline ?? "",
    fullName,
    entscheidungstraeger: decisionMakerName,
    decisionMakerName,
    decisionMakerRole: safeProspect.decisionMakerRole ?? "",
    landingpageUrl: resolvedLandingpageUrl,
    videoUrl: safeProspect.personalVideoUrl ?? safeProspect.videoUrl ?? "",
    calendarUrl,
    Terminlink: calendarUrl,
    Calendly_Link: calendarUrl,
    Booking_URL: calendarUrl,
    painPoint: safeProspect.customPainPoint ?? "",
    painSummary: safeProspect.painSummary ?? safeProspect.customPainPoint ?? "",
    businessField: safeProspect.businessFields?.[0] ?? "",
    vehicleCount: safeProspect.vehicleCount?.toString() ?? "",
    locationsCount: safeProspect.locationsCount?.toString() ?? "",
    ...(addressVars ?? {})
  };
}

export function normalizeAddressForm(value: unknown): AddressForm {
  return value === "sie" ? "sie" : "du";
}

export function addressGreetingTemplate(addressForm: AddressForm): string {
  return addressForm === "sie"
    ? "Hallo {{salutation}} {{lastName}}, ich habe Ihnen ein kurzes Video aufgenommen."
    : "Hallo {{firstName}}, ich habe dir ein kurzes Video aufgenommen.";
}

export function resolveTemplateVariables(text: string | null | undefined, context?: LeadForTemplate | { lead?: LeadForTemplate | null; isPreview?: boolean; addressForm?: AddressForm } | null): string {
  if (!text) return "";
  let lead: LeadForTemplate | null | undefined = context as LeadForTemplate | null | undefined;
  let isPreview = false;
  if (context && "lead" in context) {
    lead = context.lead;
    isPreview = Boolean(context.isPreview);
  }
  const values = buildTemplateVariables(lead, undefined, { isPreview, addressForm: context && "addressForm" in context ? context.addressForm : undefined });
  return normalizeRenderedText(text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key] ?? neutralTemplateFallbacks[key] ?? ""));
}

export function renderText(template: string | null | undefined, prospect: LeadForTemplate, options: { isPreview?: boolean; addressForm?: AddressForm } = {}): string {
  if (!template) return "";
  return resolveTemplateVariables(template, { lead: prospect, isPreview: options.isPreview, addressForm: options.addressForm });
}

function addressFormVariables(addressForm: AddressForm) {
  return addressForm === "sie"
    ? {
      anredeForm: "Sie",
      ansprache: "Sie",
      cta: "Lassen Sie uns sprechen",
      headline: "Lassen Sie uns kurz sprechen",
      checkIntro: "Lassen Sie uns kurz prüfen",
      watchPrompt: "Schauen Sie sich das kurz an!",
      youReceive: "Sie erhalten",
      du: "Sie",
      dein: "Ihr",
      deine: "Ihre",
      deinen: "Ihren",
      deinem: "Ihrem",
      dir: "Ihnen",
      dich: "Sie",
      mitDir: "mit Ihnen",
      ihr: "Sie",
      euch: "Ihnen",
      euer: "Ihr",
      eure: "Ihre",
      euren: "Ihren"
    }
    : {
      anredeForm: "du",
      ansprache: "du",
      cta: "Lass uns sprechen",
      headline: "Lass uns kurz sprechen",
      checkIntro: "Lass uns kurz prüfen",
      watchPrompt: "Schau dir das kurz an!",
      youReceive: "Du erhältst",
      du: "du",
      dein: "dein",
      deine: "deine",
      deinen: "deinen",
      deinem: "deinem",
      dir: "dir",
      dich: "dich",
      mitDir: "mit dir",
      ihr: "ihr",
      euch: "euch",
      euer: "euer",
      eure: "eure",
      euren: "euren"
    };
}

function replaceAddressVariables(value: string | undefined, vars: ReturnType<typeof addressFormVariables>) {
  return value?.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key: string) => vars[key as keyof typeof vars] ?? match);
}

export function splitPersonName(name: string | null | undefined): { firstName?: string; lastName?: string } {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined
  };
}

function normalizeRenderedText(value: string): string {
  return value
    .replace(/^Hey\s*,\s*/i, "Hallo, ")
    .replace(/^Hey\s+(?=(von|ich|wir|dir|Ihnen)\b)/i, "Hallo, ")
    .replace(/^Hey\s+$/i, "Hallo")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeTemplateLead(lead: LeadForTemplate | null | undefined): LeadForTemplate {
  return lead ?? {};
}

function cleanTemplateValue(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function resolveCtaUrl(
  preferred: string | null | undefined,
  prospect: ProspectForTemplate,
  template: Pick<LandingpageTemplate, "defaultCtaUrl">
): string {
  const rendered = renderText(preferred, prospect).trim();
  if (rendered) return rendered;
  if (prospect.calendarUrl) return prospect.calendarUrl;
  return template.defaultCtaUrl ?? "#";
}

export function getBookingUrl(prospect: ProspectForTemplate): string {
  return prospect.bookingUrl || prospect.calendarUrl || "";
}

export function resolveBookingCtaUrl(
  preferred: string | null | undefined,
  prospect: ProspectForTemplate,
  template: Pick<LandingpageTemplate, "defaultCtaUrl" | "bookingMode">
): string {
  if (preferred?.includes("{{calendarUrl}}")) {
    const bookingUrl = getBookingUrl(prospect);
    if (bookingUrl && template.bookingMode === "external_link") return bookingUrl;
    if (bookingUrl && prospect.slug) return `/p/${prospect.slug}/booking`;
  }

  const rendered = renderText(preferred, prospect).trim();
  if (rendered && rendered !== "{{calendarUrl}}") return rendered;
  const bookingUrl = getBookingUrl(prospect);
  if (bookingUrl && template.bookingMode === "external_link") return bookingUrl;
  if (bookingUrl && prospect.slug) return `/p/${prospect.slug}/booking`;
  if (bookingUrl) return bookingUrl;
  return template.defaultCtaUrl ?? "#";
}

export function renderLandingpageModel(template: LandingpageTemplate, prospect: ProspectForTemplate) {
  const addressForm = normalizeAddressForm(template.addressForm);
  const addressVars = addressFormVariables(addressForm);
  const render = (value: string | null | undefined) => renderText(replaceAddressVariables(addressCopyVariant(value ?? undefined, addressForm), addressVars), prospect, { addressForm });
  const heroHeadline = prospect.customHeroHeadline || template.heroHeadline;
  const heroSubheadline = prospect.customHeroSubline || template.heroSubheadline;
  const heroBodyText = prospect.customHeroBodyText || template.heroBodyText;
  const heroCtaText = prospect.customHeroCtaText || prospect.individualCtaText || template.heroCtaText || template.defaultCtaText;
  const heroCtaUrl = resolveBookingCtaUrl(prospect.customHeroCtaUrl || template.heroCtaUrl, prospect, template);
  const personalVideoUrl = prospect.personalVideoUrl || prospect.videoUrl || template.personalVideoUrl;
  const explainerVideoUrl = prospect.explainerVideoUrl || template.explainerVideoUrl;

  return {
    design: getGlobalLandingpageDesign(template),
    sections: renderLandingpageSections(template, prospect),
    hero: {
      enabled: template.heroEnabled,
      eyebrow: render(template.heroEyebrow),
      headline: render(heroHeadline),
      subheadline: render(heroSubheadline),
      bodyText: render(heroBodyText),
      ctaText: render(heroCtaText),
      ctaUrl: heroCtaUrl,
      secondaryCtaText: render(template.heroSecondaryCtaText),
      secondaryCtaUrl: resolveCtaUrl(template.heroSecondaryCtaUrl, prospect, template),
      layout: template.heroLayout,
      videoPosition: template.heroVideoPosition
    },
    personalVideo: {
      enabled: template.personalVideoEnabled && Boolean(personalVideoUrl),
      url: personalVideoUrl,
      thumbnailUrl: prospect.personalVideoThumbnailUrl || template.personalVideoThumbnailUrl,
      title: render(template.personalVideoTitle),
      buttonText: render(template.personalVideoButtonText)
    },
    explainerVideo: {
      enabled: template.explainerVideoEnabled && Boolean(explainerVideoUrl),
      url: explainerVideoUrl,
      thumbnailUrl: template.explainerVideoThumbnailUrl,
      title: render(template.explainerVideoTitle),
      subline: render(template.explainerVideoSubline),
      buttonText: render(template.explainerVideoButtonText),
      ctaText: render(template.explainerCtaText || template.defaultCtaText),
      ctaUrl: resolveBookingCtaUrl(template.explainerCtaUrl, prospect, template)
    },
    finalCta: {
      enabled: template.finalCtaEnabled,
      headline: render(template.finalCtaHeadline),
      text: render(template.finalCtaText || template.defaultCtaText),
      url: resolveBookingCtaUrl(template.finalCtaUrl, prospect, template)
    }
  };
}
