import type { LandingpageSection, LandingpageSectionSettings, LandingpageSectionType } from "@/lib/landingpage-templates";

export type LandingpagePageTab = "landingpage" | "booking" | "thank_you" | "legal";
export type LandingpageLegalTab = NonNullable<LandingpageSectionSettings["legalTab"]>;

export const legalTabOptions: Array<{ value: LandingpageLegalTab; label: string; field: keyof LandingpageSectionSettings }> = [
  { value: "impressum", label: "Impressum", field: "legalImprintText" },
  { value: "datenschutz", label: "Datenschutz", field: "legalPrivacyText" },
  { value: "datenverarbeitung", label: "Datenverarbeitung", field: "legalProcessingText" },
  { value: "agb", label: "AGB", field: "legalTermsText" },
  { value: "disclaimer", label: "Disclaimer", field: "legalDisclaimerText" },
  { value: "cookies", label: "Cookies", field: "legalText" }
];

export function pageTabForSection(sectionOrType: LandingpageSectionType | (Pick<LandingpageSection, "type"> & Partial<Pick<LandingpageSection, "page">>)): LandingpagePageTab {
  const type = typeof sectionOrType === "string" ? sectionOrType : sectionOrType.type;
  const explicitPage = typeof sectionOrType === "string" ? undefined : sectionOrType.page;
  if (explicitPage === "booking" || explicitPage === "thank_you" || explicitPage === "legal") return explicitPage;
  if (type === "booking") return "booking";
  if (type === "thank_you") return "thank_you";
  if (type === "legal") return "legal";
  return "landingpage";
}

export function isFlowPageSection(type: LandingpageSectionType) {
  return type === "booking" || type === "thank_you" || type === "legal";
}

export function sectionsForPageTab<T extends Pick<LandingpageSection, "type"> & Partial<Pick<LandingpageSection, "page">>>(sections: T[], tab: LandingpagePageTab) {
  return sections.filter((section) => pageTabForSection(section) === tab);
}

export function landingpageOnlySections<T extends Pick<LandingpageSection, "type"> & Partial<Pick<LandingpageSection, "page">>>(sections: T[]) {
  return sections.filter((section) => pageTabForSection(section) === "landingpage" && section.type !== "personal_video");
}

export function legalTabLabel(tab: LandingpageSectionSettings["legalTab"]) {
  return legalTabOptions.find((option) => option.value === tab)?.label ?? "Impressum";
}

export function legalTextForSettings(settings: LandingpageSectionSettings, tab: LandingpageSectionSettings["legalTab"] = settings.legalTab) {
  const activeTab = tab ?? "impressum";
  if (activeTab === "impressum") return settings.legalImprintText || settings.legalText || "";
  if (activeTab === "datenschutz") return settings.legalPrivacyText || settings.legalText || "";
  if (activeTab === "datenverarbeitung") return settings.legalProcessingText || settings.legalText || "";
  if (activeTab === "agb") return settings.legalTermsText || settings.legalText || "";
  if (activeTab === "disclaimer") return settings.legalDisclaimerText || settings.legalText || "";
  return settings.legalText || "";
}
