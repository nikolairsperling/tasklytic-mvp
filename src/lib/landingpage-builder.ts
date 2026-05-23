import {
  addLandingpageSection,
  deleteLandingpageSection,
  moveLandingpageSection,
  reorderLandingpageSections,
  toggleLandingpageSection,
  updateLandingpageSection,
  normalizeAddressForm,
  type AddressForm,
  type BuilderContainer,
  type BuilderElement,
  type BuilderElementType,
  type BuilderElementStyle,
  type GlobalLandingpageDesign,
  type LandingpageSectionType,
  type LandingpageSection,
  type LandingpageSectionSettings,
  type ResponsiveStyle
} from "@/lib/landingpage-templates";

export type BuilderDevice = "desktop" | "tablet" | "mobile";
export type BuilderElementKind = "section" | "text" | "button" | "video" | "link" | "list_item";

export type ActiveBuilderElement = {
  sectionId: string;
  elementId?: string;
  field?: keyof LandingpageSectionSettings;
  kind: BuilderElementKind;
  itemList?: "beforeItems" | "afterItems" | "leftItems" | "rightItems" | "faqItems" | "benefitItems";
  itemIndex?: number;
  itemKey?: "question" | "answer" | "title" | "text";
};

export type BuilderElementPatch = {
  props?: Record<string, unknown>;
  style?: BuilderElementStyle;
};

export function selectBuilderElement(element: ActiveBuilderElement): ActiveBuilderElement {
  return element;
}

export function resolveBuilderElement(sections: LandingpageSection[], element: ActiveBuilderElement): ActiveBuilderElement {
  if (element.elementId) return element;
  const section = sections.find((item) => item.id === element.sectionId);
  const match = section ? findBuilderElementForActive(section, element) : undefined;
  return match ? { ...element, elementId: match.id } : element;
}

export function patchBuilderElement(
  sections: LandingpageSection[],
  activeElement: ActiveBuilderElement,
  patch: Partial<LandingpageSectionSettings>
): LandingpageSection[] {
  const section = sections.find((item) => item.id === activeElement.sectionId);
  if (!section) return sections;
  const withSettings = updateLandingpageSection(sections, section.id, { settings: { ...section.settings, ...patch } });
  const propsPatch = settingsPatchToElementProps(activeElement, patch);
  const stylePatch = settingsPatchToElementStyle(patch);
  const withProps = propsPatch ? patchBuilderElementProps(withSettings, activeElement, propsPatch) : withSettings;
  return stylePatch ? patchBuilderElementStyle(withProps, activeElement, stylePatch) : withProps;
}

export function patchBuilderElementProps(
  sections: LandingpageSection[],
  activeElement: ActiveBuilderElement,
  patch: Record<string, unknown>
): LandingpageSection[] {
  const section = sections.find((item) => item.id === activeElement.sectionId);
  if (!section) return sections;
  const elementId = activeElement.elementId ?? findBuilderElementForActive(section, activeElement)?.id;
  if (!elementId) return sections;
  return updateElement(sections, elementId, { props: patch });
}

export function patchBuilderElementStyle(
  sections: LandingpageSection[],
  activeElement: ActiveBuilderElement,
  patch: BuilderElementStyle
): LandingpageSection[] {
  const section = sections.find((item) => item.id === activeElement.sectionId);
  if (!section) return sections;
  const elementId = activeElement.elementId ?? findBuilderElementForActive(section, activeElement)?.id;
  if (!elementId) return sections;
  return updateElement(sections, elementId, { style: patch });
}

export function updateElement(
  sections: LandingpageSection[],
  elementId: string,
  patch: BuilderElementPatch
): LandingpageSection[] {
  console.log("UPDATE ELEMENT CALLED", elementId, patch);
  let changed = false;
  const next = sections.map((section) => {
    let sectionChanged = false;
    const containers = (section.containers ?? []).map((container) => {
      let containerChanged = false;
      const columns = container.columns.map((column) => {
        const result = updateElementsRecursive(column.elements, elementId, patch);
        if (!result.changed) return column;
        containerChanged = true;
        return { ...column, elements: result.elements };
      });
      if (!containerChanged) return container;
      sectionChanged = true;
      return { ...container, columns };
    });
    if (!sectionChanged) return section;
    changed = true;
    return { ...section, containers };
  });
  return changed ? next : sections;
}

function updateElementsRecursive(
  elements: BuilderElement[],
  elementId: string,
  patch: BuilderElementPatch
): { elements: BuilderElement[]; changed: boolean } {
  let changed = false;
  const next = elements.map((element) => {
    let nextElement = element;
    if (element.id === elementId) {
      changed = true;
      nextElement = {
        ...element,
        props: patch.props ? { ...(element.props ?? {}), ...patch.props } : element.props,
        style: patch.style ? { ...(element.style ?? {}), ...patch.style } : element.style
      };
      console.log("ELEMENT AFTER UPDATE", nextElement);
    }

    const nested = nestedBuilderElements(nextElement);
    if (!nested) return nextElement;
    const result = updateElementsRecursive(nested.elements, elementId, patch);
    if (!result.changed) return nextElement;
    changed = true;
    return {
      ...nextElement,
      [nested.key]: result.elements
    } as BuilderElement;
  });
  return { elements: next, changed };
}

function nestedBuilderElements(element: BuilderElement): { key: "elements" | "children"; elements: BuilderElement[] } | null {
  const source = element as BuilderElement & { elements?: unknown; children?: unknown };
  if (Array.isArray(source.elements)) return { key: "elements", elements: source.elements as BuilderElement[] };
  if (Array.isArray(source.children)) return { key: "children", elements: source.children as BuilderElement[] };
  return null;
}

export function patchBuilderText(
  sections: LandingpageSection[],
  activeElement: ActiveBuilderElement,
  value: string
): LandingpageSection[] {
  const section = sections.find((item) => item.id === activeElement.sectionId);
  if (!section) return sections;
  const settings = section.settings;

  if (activeElement.itemList === "beforeItems" || activeElement.itemList === "afterItems" || activeElement.itemList === "leftItems" || activeElement.itemList === "rightItems") {
    const current = settings[activeElement.itemList] ?? [];
    const next = current.map((item, index) => index === activeElement.itemIndex ? value : item);
    return updateLandingpageSection(sections, section.id, { settings: { ...settings, [activeElement.itemList]: next } });
  }

  if (activeElement.itemList === "faqItems") {
    const current = settings.faqItems ?? [];
    const next = current.map((item, index) => {
      if (index !== activeElement.itemIndex) return item;
      return { ...item, [activeElement.itemKey ?? "question"]: value };
    });
    const withSettings = updateLandingpageSection(sections, section.id, { settings: { ...settings, faqItems: next } });
    return patchBuilderElementProps(withSettings, activeElement, { text: value });
  }

  if (activeElement.itemList === "benefitItems") {
    const current = settings.benefitItems ?? [];
    const next = current.map((item, index) => {
      if (index !== activeElement.itemIndex) return item;
      const key = activeElement.itemKey === "text" ? "text" : "title";
      return { ...item, [key]: value };
    });
    return updateLandingpageSection(sections, section.id, { settings: { ...settings, benefitItems: next } });
  }

  if (!activeElement.field) return sections;
  const withSettings = updateLandingpageSection(sections, section.id, { settings: { ...settings, [activeElement.field]: value } });
  return patchBuilderElementProps(withSettings, activeElement, { text: value });
}

function settingsPatchToElementProps(activeElement: ActiveBuilderElement, patch: Partial<LandingpageSectionSettings>) {
  if (!activeElement.field) return null;
  const next: Record<string, unknown> = {};
  if (activeElement.field in patch) next.text = patch[activeElement.field];
  if ("ctaUrl" in patch) next.href = patch.ctaUrl;
  if ("headerCtaUrl" in patch) next.href = patch.headerCtaUrl;
  if ("buttonColor" in patch) next.backgroundColor = patch.buttonColor;
  if ("buttonTextColor" in patch) next.textColor = patch.buttonTextColor;
  if ("buttonBorderRadius" in patch) next.borderRadius = patch.buttonBorderRadius;
  if ("buttonPaddingX" in patch) next.paddingX = patch.buttonPaddingX;
  if ("buttonPaddingY" in patch) next.paddingY = patch.buttonPaddingY;
  if ("buttonFontSize" in patch) next.fontSize = patch.buttonFontSize;
  if ("buttonFontWeight" in patch) next.fontWeight = patch.buttonFontWeight;
  if ("buttonAlignment" in patch) next.alignment = patch.buttonAlignment;
  if ("buttonWidthMode" in patch) next.widthMode = patch.buttonWidthMode;
  if ("buttonCustomWidth" in patch) next.customWidth = patch.buttonCustomWidth;
  if ("buttonShadow" in patch) next.shadow = patch.buttonShadow;
  if ("buttonHoverEffect" in patch) next.hoverEffect = patch.buttonHoverEffect;
  if ("buttonAnimation" in patch) next.animation = patch.buttonAnimation;
  if ("videoUrl" in patch) next.url = patch.videoUrl;
  if ("videoMobileUrl" in patch) next.mobileUrl = patch.videoMobileUrl;
  if ("videoWebmUrl" in patch) next.webmUrl = patch.videoWebmUrl;
  if ("thumbnailUrl" in patch) next.poster = patch.thumbnailUrl;
  if ("videoAssetId" in patch) next.assetId = patch.videoAssetId;
  if ("controls" in patch) next.controls = patch.controls;
  if ("autoplay" in patch) next.autoplay = patch.autoplay;
  if ("muted" in patch) next.muted = patch.muted;
  if ("loop" in patch) next.loop = patch.loop;
  return Object.keys(next).length > 0 ? next : null;
}

function settingsPatchToElementStyle(patch: Partial<LandingpageSectionSettings>): BuilderElementStyle | null {
  const next: BuilderElementStyle = {};
  if ("buttonColor" in patch) next.backgroundColor = patch.buttonColor;
  if ("buttonTextColor" in patch) next.color = patch.buttonTextColor;
  if ("buttonBorderRadius" in patch) next.borderRadius = patch.buttonBorderRadius;
  if ("buttonFontSize" in patch) next.fontSize = patch.buttonFontSize;
  if ("buttonFontWeight" in patch) next.fontWeight = patch.buttonFontWeight;
  if ("buttonCustomWidth" in patch) next.width = patch.buttonCustomWidth;
  if ("buttonWidthMode" in patch && patch.buttonWidthMode === "full") next.width = "100%";
  if ("buttonAlignment" in patch) next.textAlign = patch.buttonAlignment;
  if ("videoBorderRadius" in patch) next.borderRadius = patch.videoBorderRadius;
  if ("videoBackgroundColor" in patch) next.backgroundColor = patch.videoBackgroundColor;
  if ("videoPadding" in patch) next.padding = patch.videoPadding;
  return Object.keys(next).length > 0 ? next : null;
}

export function addBuilderSection(sections: LandingpageSection[], type: LandingpageSectionType) {
  const next = addLandingpageSection(sections, type);
  return {
    sections: next,
    activeElement: selectBuilderElement({ sectionId: next[next.length - 1]?.id ?? "", kind: "section" })
  };
}

export function deleteBuilderSection(sections: LandingpageSection[], sectionId: string) {
  return deleteLandingpageSection(sections, sectionId);
}

export function duplicateBuilderSection(sections: LandingpageSection[], sectionId: string) {
  const source = sections.find((section) => section.id === sectionId);
  if (!source) return { sections, activeElement: null };
  const copy = { ...source, id: `section_${Date.now()}`, name: `${source.name} Kopie`, order: sections.length + 1 };
  const next = [...sections, copy].map((section, index) => ({ ...section, order: index + 1 }));
  return { sections: next, activeElement: selectBuilderElement({ sectionId: copy.id, kind: "section" }) };
}

export function moveBuilderSection(sections: LandingpageSection[], sectionId: string, direction: "up" | "down") {
  return moveLandingpageSection(sections, sectionId, direction);
}

export function reorderBuilderSections(sections: LandingpageSection[], activeId: string, overId: string) {
  return reorderLandingpageSections(sections, activeId, overId);
}

export function toggleBuilderSection(sections: LandingpageSection[], sectionId: string) {
  return toggleLandingpageSection(sections, sectionId);
}

export function devicePreviewClass(device: BuilderDevice) {
  if (device === "mobile") return "max-w-[390px]";
  if (device === "tablet") return "max-w-[768px]";
  return "max-w-[1200px]";
}

export function devicePreviewWidth(device: BuilderDevice) {
  if (device === "mobile") return 390;
  if (device === "tablet") return 768;
  return 1200;
}

export function addBuilderContainer(sections: LandingpageSection[], sectionId: string, columns = 1): LandingpageSection[] {
  const section = sections.find((item) => item.id === sectionId);
  if (!section) return sections;
  const container = createBuilderContainer(columns);
  return updateLandingpageSection(sections, sectionId, { containers: [...(section.containers ?? []), container] });
}

export function addBuilderElement(
  sections: LandingpageSection[],
  sectionId: string,
  containerId: string,
  columnId: string,
  type: BuilderElementType
): LandingpageSection[] {
  return updateBuilderColumns(sections, sectionId, containerId, (columns) => columns.map((column) => column.id === columnId
    ? { ...column, elements: [...column.elements, createBuilderElement(type)] }
    : column
  ));
}

export function moveBuilderElement(
  sections: LandingpageSection[],
  sectionId: string,
  containerId: string,
  columnId: string,
  elementId: string,
  direction: "up" | "down"
): LandingpageSection[] {
  return updateBuilderColumns(sections, sectionId, containerId, (columns) => columns.map((column) => {
    if (column.id !== columnId) return column;
    const index = column.elements.findIndex((element) => element.id === elementId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= column.elements.length) return column;
    const next = [...column.elements];
    [next[index], next[target]] = [next[target], next[index]];
    return { ...column, elements: next };
  }));
}

export function updateResponsiveStyle(style: ResponsiveStyle | undefined, device: BuilderDevice, key: string, value: string | number | boolean): ResponsiveStyle {
  return {
    ...style,
    [device]: {
      ...(style?.[device] ?? {}),
      [key]: value
    }
  };
}

export function updateBuilderElementResponsiveStyle(style: BuilderElementStyle | undefined, device: BuilderDevice, key: string, value: string | number | boolean): BuilderElementStyle {
  return {
    ...(style ?? {}),
    [device]: {
      ...((style?.[device] && typeof style[device] === "object" ? style[device] : {}) as Record<string, string | number | boolean | undefined>),
      [key]: value
    }
  };
}

export function findBuilderElementByField(section: LandingpageSection, field: keyof LandingpageSectionSettings): BuilderElement | undefined {
  for (const container of section.containers ?? []) {
    for (const column of container.columns) {
      const match = findElementByPredicate(column.elements, (element) => element.props?.field === field);
      if (match) return match;
    }
  }
  return undefined;
}

export function findBuilderElementForActive(section: LandingpageSection, element: ActiveBuilderElement): BuilderElement | undefined {
  if (element.elementId) return findElementByPredicate(flattenSectionElements(section), (item) => item.id === element.elementId);
  if (element.field) return findBuilderElementByField(section, element.field);
  if (!element.itemList) return undefined;
  return findElementByPredicate(
    flattenSectionElements(section),
    (item) => item.props?.itemList === element.itemList
      && item.props?.itemIndex === element.itemIndex
      && item.props?.itemKey === element.itemKey
  );
}

function flattenSectionElements(section: LandingpageSection): BuilderElement[] {
  return (section.containers ?? []).flatMap((container) => container.columns.flatMap((column) => column.elements));
}

function findElementByPredicate(elements: BuilderElement[], predicate: (element: BuilderElement) => boolean): BuilderElement | undefined {
  for (const element of elements) {
    if (predicate(element)) return element;
    const nested = nestedBuilderElements(element);
    const match = nested ? findElementByPredicate(nested.elements, predicate) : undefined;
    if (match) return match;
  }
  return undefined;
}

function updateBuilderColumns(
  sections: LandingpageSection[],
  sectionId: string,
  containerId: string,
  updater: (columns: BuilderContainer["columns"]) => BuilderContainer["columns"]
) {
  const section = sections.find((item) => item.id === sectionId);
  if (!section) return sections;
  const containers = (section.containers ?? []).map((container) => container.id === containerId ? { ...container, columns: updater(container.columns) } : container);
  return updateLandingpageSection(sections, sectionId, { containers });
}

export function createBuilderContainer(columns = 1): BuilderContainer {
  const safeColumns = Math.max(1, Math.min(3, columns));
  return {
    id: `container_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    settings: {
      maxWidth: 1200,
      display: "grid",
      columns: safeColumns,
      gap: safeColumns > 1 ? 32 : 20,
      alignment: "stretch",
      padding: 0,
      backgroundColor: "transparent",
      borderColor: "transparent"
    },
    columns: Array.from({ length: safeColumns }).map((_, index) => ({
      id: `column_${Date.now()}_${index + 1}_${Math.random().toString(36).slice(2, 6)}`,
      width: Math.round(100 / safeColumns),
      elements: []
    })),
    style: {
      desktop: { maxWidth: 1200, columns: safeColumns },
      tablet: { maxWidth: 768, columns: Math.min(safeColumns, 2) },
      mobile: { maxWidth: 390, columns: 1 }
    }
  };
}

export function createBuilderElement(type: BuilderElementType): BuilderElement {
  const defaults: Record<BuilderElementType, Record<string, unknown>> = {
    headline: { text: "Neue Überschrift" },
    text: { text: "Neuer Text" },
    button: { text: "Button", href: "#" },
    image: { url: "", alt: "" },
    video: { url: "", poster: "", controls: true },
    icon: { name: "star" },
    list: { items: ["Neuer Punkt"] },
    faq: { items: [{ question: "Frage", answer: "Antwort" }] },
    cta: { text: "Jetzt starten", href: "#" },
    testimonial: { quote: "Kundenstimme", name: "" },
    steps: { items: ["Schritt 1", "Schritt 2", "Schritt 3"] },
    booking: { url: "{{calendarUrl}}" },
    spacer: { height: 48 }
  };
  return {
    id: `element_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    props: defaults[type],
    style: defaultBuilderElementStyle(type),
    editable: true
  };
}

function defaultBuilderElementStyle(type: BuilderElementType): BuilderElementStyle {
  if (type === "headline") {
    return {
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.1,
      color: "#111827",
      textAlign: "left",
      marginTop: 0,
      marginBottom: 24,
      desktop: { fontSize: 48 },
      tablet: { fontSize: 38 },
      mobile: { fontSize: 30 }
    };
  }
  if (type === "text") {
    return {
      fontFamily: "Inter",
      fontSize: 22,
      fontWeight: 400,
      lineHeight: 1.5,
      color: "#667085",
      textAlign: "left",
      marginTop: 0,
      marginBottom: 0,
      desktop: { fontSize: 22 },
      tablet: { fontSize: 20 },
      mobile: { fontSize: 17 }
    };
  }
  return { desktop: {}, tablet: {}, mobile: {} };
}

export function comparisonGridClass() {
  return "grid grid-cols-1 gap-5 md:grid-cols-2";
}

export function buildSavePayload(
  template: { name: string; isDefault: boolean; id?: string; addressForm?: string },
  sections: LandingpageSection[],
  globalDesign: GlobalLandingpageDesign,
  legacyPayload: Record<string, unknown>,
  addressForm?: AddressForm
) {
  const sanitizedSections = sanitizeLandingpageSections(sections);
  return {
    name: template.name,
    isDefault: template.isDefault,
    addressForm: normalizeAddressForm(addressForm ?? template.addressForm),
    primaryColor: globalDesign.primaryColor,
    accentColor: globalDesign.accentColor,
    sectionsJson: sanitizedSections,
    globalDesignJson: globalDesign,
    ...legacyPayload
  };
}

export function sanitizeLandingpageSections(sections: LandingpageSection[]): LandingpageSection[] {
  return sections.map((section) => ({
    ...section,
    name: sanitizeText(section.name),
    settings: sanitizeSectionSettings(section.settings)
    ,
    containers: section.containers
  }));
}

function sanitizeSectionSettings(settings: LandingpageSectionSettings): LandingpageSectionSettings {
  return {
    ...settings,
    headline: sanitizeText(settings.headline),
    headlineDu: sanitizeText(settings.headlineDu),
    headlineSie: sanitizeText(settings.headlineSie),
    textDu: sanitizeText(settings.textDu),
    textSie: sanitizeText(settings.textSie),
    subheadline: sanitizeText(settings.subheadline),
    bodyText: sanitizeText(settings.bodyText),
    bodyTextDu: sanitizeText(settings.bodyTextDu),
    bodyTextSie: sanitizeText(settings.bodyTextSie),
    ctaText: sanitizeText(settings.ctaText),
    ctaTextDu: sanitizeText(settings.ctaTextDu),
    ctaTextSie: sanitizeText(settings.ctaTextSie),
    ctaUrl: sanitizeUrl(settings.ctaUrl),
    headerCtaText: sanitizeText(settings.headerCtaText),
    headerCtaUrl: sanitizeUrl(settings.headerCtaUrl),
    menuItem1Text: sanitizeText(settings.menuItem1Text),
    menuItem2Text: sanitizeText(settings.menuItem2Text),
    menuItem3Text: sanitizeText(settings.menuItem3Text),
    headerTextFallback: sanitizeText(settings.headerTextFallback),
    headerLogoAlt: sanitizeText(settings.headerLogoAlt),
    headerLogoUrl: sanitizeUrl(settings.headerLogoUrl),
    logoUrl: sanitizeUrl(settings.logoUrl),
    videoUrl: sanitizeVideoUrl(settings.videoUrl),
    videoMobileUrl: sanitizeVideoUrl(settings.videoMobileUrl),
    videoWebmUrl: sanitizeVideoUrl(settings.videoWebmUrl),
    videoAssetId: sanitizeText(settings.videoAssetId),
    thumbnailUrl: sanitizeUrl(settings.thumbnailUrl),
    buttonText: sanitizeText(settings.buttonText),
    videoLabel: sanitizeText(settings.videoLabel),
    bookingUrl: sanitizeUrl(settings.bookingUrl),
    legalUrl: sanitizeUrl(settings.legalUrl),
    legalText: sanitizeText(settings.legalText),
    imageUrl: sanitizeUrl(settings.imageUrl),
    imageAlt: sanitizeText(settings.imageAlt),
    leftTitle: sanitizeText(settings.leftTitle),
    rightTitle: sanitizeText(settings.rightTitle),
    beforeItems: settings.beforeItems?.map(sanitizeText).filter(Boolean),
    afterItems: settings.afterItems?.map(sanitizeText).filter(Boolean),
    leftItems: settings.leftItems?.map(sanitizeText).filter(Boolean),
    rightItems: settings.rightItems?.map(sanitizeText).filter(Boolean),
    faqItems: settings.faqItems?.map((item) => ({
      question: sanitizeText(item.question),
      answer: sanitizeText(item.answer)
    })),
    benefitItems: settings.benefitItems?.map((item) => ({
      title: sanitizeText(item.title),
      text: sanitizeText(item.text)
    }))
  };
}

function sanitizeVideoUrl(value: string | undefined) {
  const url = sanitizeUrl(value);
  if (!url || url.startsWith("/uploads/images/")) return "";
  return url;
}

export function sanitizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export function sanitizeUrl(value: string | null | undefined): string {
  const sanitized = sanitizeText(value);
  if (!sanitized || sanitized.startsWith("#") || sanitized.startsWith("/") || sanitized.includes("{{")) return sanitized;
  try {
    const url = new URL(sanitized);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? sanitized : "";
  } catch {
    return "";
  }
}
