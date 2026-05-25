"use client";

import type { LandingpageTemplate, Prospect, VideoAsset } from "@prisma/client";
import { Bold, ChevronLeft, ChevronRight, Eye, FileText, HelpCircle, Image as ImageIcon, Italic, Laptop, LayoutTemplate, Link as LinkIcon, MousePointerClick, Navigation, Plus, Save, Smartphone, Sparkles, SquarePlay, Strikethrough, Tablet, Type, Underline, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { AssetFilePicker } from "@/components/admin/asset-file-picker";
import { EditorControlLayer, SelectedElementOverlay } from "@/components/admin/editor-control-layer";
import { VideoAssetPicker } from "@/components/admin/video-asset-picker";
import { VideoPreview } from "@/components/landing/video-preview";
import { defaultBookingCalendar, resolveBookingEmbed, type BookingCalendarReference, type ResolvedBookingEmbed } from "@/lib/booking-embed";
import { bookingCalendarButtonStyle, bookingCalendarIframeStyle, bookingCalendarPlaceholderTokens, bookingCalendarShellStyle } from "@/lib/booking-calendar-style";
import { headerLogoCompatibilityPatch, resolveHeaderLogo } from "@/lib/landingpage-logo";
import { isFlowPageSection, landingpageOnlySections, legalTabLabel, legalTabOptions, legalTextForSettings, pageTabForSection, sectionsForPageTab, type LandingpagePageTab } from "@/lib/landingpage-page-flow";
import { backgroundStyleFromSettings, cssLength, elementStyleToCss, responsiveStyle, textAlignValue as styleTextAlignValue } from "@/lib/landingpage-style";
import { videoPreviewPropsFromSettings } from "@/lib/landingpage/video-preview-props";
import {
  buildSavePayload,
  devicePreviewWidth,
  duplicateBuilderSection,
  findBuilderElementByField,
  findBuilderElementForActive,
  patchBuilderElement,
  patchBuilderElementStyle,
  patchBuilderText,
  resolveBuilderElement,
  selectBuilderElement,
  updateResponsiveStyle,
  reorderBuilderSections,
  type ActiveBuilderElement,
  type BuilderDevice,
  type BuilderElementKind
} from "@/lib/landingpage-builder";
import {
  addLandingpageSection,
  addressGreetingTemplate,
  applyAddressFormVariants,
  deleteLandingpageSection,
  getGlobalLandingpageDesign,
  getLandingpageSections,
  moveLandingpageSection,
  normalizeAddressForm,
  previewLead,
  renderText,
  resolveTemplateVariables,
  toggleLandingpageSection,
  updateLandingpageSection,
  type GlobalLandingpageDesign,
  type AddressForm,
  type BuilderElement,
  type BuilderElementStyle,
  type LeadForTemplate,
  type LandingpageSection,
  type LandingpageSectionSettings,
  type LandingpageSectionType
} from "@/lib/landingpage-templates";

type PageTab = LandingpagePageTab;
type Device = BuilderDevice;
type EditingField = keyof LandingpageSectionSettings;
type InlinePopupMode = "settings" | null;

const builderElements: Array<{ label: string; type: LandingpageSectionType; description: string }> = [
  { label: "Überschrift", type: "textblock", description: "Headline mit optionalem Text" },
  { label: "Text", type: "textblock", description: "Freier Textabschnitt" },
  { label: "Button", type: "cta_button", description: "Call-to-Action Link" },
  { label: "Bild", type: "image", description: "Bild aus URL oder Asset" },
  { label: "Video", type: "video", description: "Upload oder Mediathek" },
  { label: "FAQ", type: "faq", description: "Fragen und Antworten" },
  { label: "Vorteile", type: "benefits", description: "Vorteilskarten" },
  { label: "Spacer", type: "spacer", description: "Vertikaler Abstand" },
];

const addSectionOptions: Array<{ label: string; type: LandingpageSectionType; description: string }> = [
  { label: "Hero", type: "hero", description: "Titel, Text, CTA und Video" },
  { label: "Video", type: "video", description: "Ein einzelner Videoblock" },
  { label: "Problem", type: "textblock", description: "Problem- oder Kontextabschnitt" },
  { label: "Vergleich", type: "comparison", description: "Vorher/Nachher Karten" },
  { label: "Vorteile", type: "benefits", description: "Mehrspaltige Nutzenkarten" },
  { label: "PDF Report", type: "pdf_report_download", description: "Personalisierter Kurzreport" },
  { label: "ROI Report", type: "roi_report", description: "ROI-Kurzcheck mit PDF CTA" },
  { label: "CTA", type: "cta", description: "Call-to-Action Abschnitt" },
  { label: "FAQ", type: "faq", description: "Fragen und Antworten" },
  { label: "Footer", type: "footer", description: "Abschluss und rechtliche Links" },
  { label: "Custom Section", type: "textblock", description: "Freier Text- und Buttonabschnitt" }
];

const sidebarSectionTypes: LandingpageSectionType[] = ["header", "hero", "explainer_video", "comparison", "pdf_report_download", "print_report_cta", "roi_report", "cta", "approach", "faq", "textblock", "footer"];
const sectionNames: Record<LandingpageSectionType, string> = {
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
  trust: "Trust",
  booking: "Buchungsseite",
  thank_you: "Danke-Seite",
  legal: "Rechtliches",
  footer: "Footer"
};

export function VisualLandingpageTemplateEditor({
  template,
  prospects,
  bookingCalendars = [],
  backHref = "/admin/landingpages/templates"
}: {
  template: LandingpageTemplate;
  prospects: Prospect[];
  bookingCalendars?: BookingCalendarReference[];
  backHref?: string;
}) {
  const normalizedInitialSections = useMemo(() => ensureEditorSections(getLandingpageSections(template)), [template]);
  const [sections, setSections] = useState(normalizedInitialSections);
  const [globalDesign, setGlobalDesign] = useState<GlobalLandingpageDesign>(() => getGlobalLandingpageDesign(template));
  const [addressForm, setAddressForm] = useState<AddressForm>(() => normalizeAddressForm(template.addressForm));
  const [activeId, setActiveId] = useState(normalizedInitialSections[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<PageTab>("landingpage");
  const [device, setDevice] = useState<Device>("desktop");
  const [elementQuery, setElementQuery] = useState("");
  const [designOpen, setDesignOpen] = useState(false);
  const [aiPreview, setAiPreview] = useState<Record<string, string> | null>(null);
  const [previewProspectId, setPreviewProspectId] = useState(prospects[0]?.id ?? "");
  const [editing, setEditing] = useState<{ sectionId: string; field: EditingField } | null>(null);
  const [activeElement, setActiveElement] = useState<ActiveBuilderElement | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useStoredBoolean("builderLeftPanelCollapsed", false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useStoredBoolean("builderRightPanelCollapsedInline", true);
  const [inlinePopup, setInlinePopup] = useState<InlinePopupMode>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => editorSnapshot(normalizedInitialSections, getGlobalLandingpageDesign(template), normalizeAddressForm(template.addressForm)));
  const [isPending, startTransition] = useTransition();
  const leftSidebarScrollRef = useRef<HTMLDivElement | null>(null);

  const previewProspect = prospects.find((prospect) => prospect.id === previewProspectId) ?? prospects[0];
  const activePreviewLead = previewProspect ?? previewLead;
  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0];
  const renderedSections = useMemo(() => {
    return sections
      .filter((section) => section.enabled)
      .map((section) => renderSectionForPreview(section, activePreviewLead, addressForm));
  }, [activePreviewLead, addressForm, sections]);
  const filteredBuilderElements = useMemo(() => {
    const query = elementQuery.trim().toLowerCase();
    if (!query) return builderElements;
    return builderElements.filter((element) => `${element.label} ${element.description}`.toLowerCase().includes(query));
  }, [elementQuery]);
  const activeElementStyle = useMemo(() => getActiveElementStyle(sections, activeElement), [activeElement, sections]);
  const dirty = editorSnapshot(sections, globalDesign, addressForm) !== savedSnapshot;
  const activeSectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) : -1;
  const selectedLabel = activeSection && activeElement ? elementSelectionLabel(activeSection, activeElement) : "";
  const selectedDetail = activeSection && activeElement ? sectionNames[activeSection.type] : undefined;
  const selectedAnchorKey = activeElement ? activeElementTreeKey(activeElement) : undefined;

  function replaceSections(next: LandingpageSection[]) {
    const ordered = next.map((section, index) => ({ ...section, order: index + 1 }));
    setSections(ordered);
    if (!ordered.some((section) => section.id === activeId)) setActiveId(ordered[0]?.id ?? "");
  }

  function patchSection(sectionId: string, patch: Partial<LandingpageSection>) {
    setSections((current) => updateLandingpageSection(current, sectionId, patch));
  }

  function patchSettings(sectionId: string, patch: Partial<LandingpageSectionSettings>) {
    const target = sections.find((section) => section.id === sectionId);
    if (!target) return;
    const nextPatch = headerLogoCompatibilityPatch(patch);
    setSections(updateLandingpageSection(sections, sectionId, { settings: { ...target.settings, ...nextPatch } }));
  }

  function selectElement(element: ActiveBuilderElement) {
    const resolved = resolveBuilderElement(sections, element);
    setActiveId(resolved.sectionId);
    setActiveElement(selectBuilderElement(resolved));
    const section = sections.find((item) => item.id === resolved.sectionId);
    if (section) setActiveTab(pageTabForSection(section));
    if (resolved.field) setEditing({ sectionId: resolved.sectionId, field: resolved.field });
    setDesignOpen(false);
  }

  function changeActiveTab(nextTab: PageTab) {
    setActiveTab(nextTab);
    setInlinePopup(null);
    const tabSection = firstSectionForTab(sections, nextTab);
    if (!tabSection) return;
    setActiveId(tabSection.id);
    setActiveElement({ sectionId: tabSection.id, kind: "section" });
    setEditing(null);
  }

  function openElementPopup(element: ActiveBuilderElement) {
    selectElement(element);
    setInlinePopup("settings");
  }

  function editActiveSelection() {
    if (!activeElement || !activeSection) return;
    if (activeElement.kind === "section") {
      setInlinePopup(null);
      setRightPanelCollapsed(false);
      return;
    }
    if (activeElement.kind === "video") {
      setInlinePopup(null);
      setRightPanelCollapsed(false);
      return;
    }
    openElementPopup(activeElement);
  }

  function openActiveSettings() {
    if (!activeSection) return;
    setRightPanelCollapsed(false);
    if (activeElement && activeElement.kind !== "section" && activeElement.kind !== "video") {
      setInlinePopup("settings");
      return;
    }
    setInlinePopup(null);
  }

  function clearCanvasSelection() {
    setActiveElement(null);
    setInlinePopup(null);
  }

function patchActiveElement(patch: Partial<LandingpageSectionSettings>) {
  if (!activeElement) return;
  const nextPatch = headerLogoCompatibilityPatch(patch);
  setSections((current) => patchBuilderElement(current, activeElement, nextPatch));
}

  function patchActiveVideoElement(patch: Partial<LandingpageSectionSettings>) {
    if (!activeElement) return;
    const next = patchBuilderElement(sections, activeElement, patch);
    setSections(next);
    if ("videoUrl" in patch || "videoAssetId" in patch) {
      persistSections(next, patch.videoUrl ? "Video gespeichert." : "Video entfernt.");
    }
  }

function patchActiveElementStyle(patch: BuilderElementStyle) {
  if (!activeElement) return;
  setSections((current) => patchBuilderElementStyle(current, resolveBuilderElement(current, activeElement), patch));
}

  function patchActiveText(value: string) {
    if (!activeElement) return;
    setSections((current) => {
      const resolved = resolveBuilderElement(current, activeElement);
      return patchBuilderText(current, resolved, value);
    });
  }

  function patchElementText(element: ActiveBuilderElement, value: string) {
    setSections((current) => {
      const resolved = resolveBuilderElement(current, element);
      return patchBuilderText(current, resolved, value);
    });
  }

  function duplicateSection(section: LandingpageSection) {
    const result = duplicateBuilderSection(sections, section.id);
    replaceSections(result.sections);
    if (result.activeElement?.sectionId) {
      setActiveId(result.activeElement.sectionId);
      setActiveElement(result.activeElement);
    }
  }

  function duplicateActiveElement() {
    if (!activeElement) return;
    if (activeElement.kind === "section") {
      const section = sections.find((item) => item.id === activeElement.sectionId);
      if (section) duplicateSection(section);
      return;
    }
    if (activeElement.itemList && activeElement.itemIndex !== undefined) {
      const section = sections.find((item) => item.id === activeElement.sectionId);
      if (!section) return;
      if (activeElement.itemList === "faqItems") {
        const items = section.settings.faqItems ?? [];
        const source = items[activeElement.itemIndex];
        if (!source) return;
        patchSettings(section.id, { faqItems: [...items.slice(0, activeElement.itemIndex + 1), { ...source }, ...items.slice(activeElement.itemIndex + 1)] });
        return;
      }
      if (activeElement.itemList === "benefitItems") {
        const items = section.settings.benefitItems ?? [];
        const source = items[activeElement.itemIndex];
        if (!source) return;
        patchSettings(section.id, { benefitItems: [...items.slice(0, activeElement.itemIndex + 1), { ...source }, ...items.slice(activeElement.itemIndex + 1)] });
        return;
      }
      if (activeElement.itemList === "leftItems" || activeElement.itemList === "rightItems" || activeElement.itemList === "beforeItems" || activeElement.itemList === "afterItems") {
        const items = section.settings[activeElement.itemList] ?? [];
        const source = items[activeElement.itemIndex];
        if (!source) return;
        patchSettings(section.id, { [activeElement.itemList]: [...items.slice(0, activeElement.itemIndex + 1), source, ...items.slice(activeElement.itemIndex + 1)] });
      }
      return;
    }
    const section = sections.find((item) => item.id === activeElement.sectionId);
    if (section) duplicateSection(section);
  }

  function deleteActiveElement() {
    if (!activeElement) return;
    if (activeElement.kind === "section") {
      deleteSectionById(activeElement.sectionId);
      return;
    }
    const section = sections.find((item) => item.id === activeElement.sectionId);
    if (!section) return;
    if (activeElement.itemList === "faqItems" && activeElement.itemIndex !== undefined) {
      patchSettings(section.id, { faqItems: (section.settings.faqItems ?? []).filter((_, index) => index !== activeElement.itemIndex) });
      setInlinePopup(null);
      return;
    }
    if (activeElement.itemList === "benefitItems" && activeElement.itemIndex !== undefined) {
      patchSettings(section.id, { benefitItems: (section.settings.benefitItems ?? []).filter((_, index) => index !== activeElement.itemIndex) });
      setInlinePopup(null);
      return;
    }
    if ((activeElement.itemList === "leftItems" || activeElement.itemList === "rightItems" || activeElement.itemList === "beforeItems" || activeElement.itemList === "afterItems") && activeElement.itemIndex !== undefined) {
      patchSettings(section.id, { [activeElement.itemList]: (section.settings[activeElement.itemList] ?? []).filter((_, index) => index !== activeElement.itemIndex) });
      setInlinePopup(null);
      return;
    }
    if (activeElement.field && window.confirm(`${elementSelectionLabel(section, activeElement)} löschen?`)) {
      patchSettings(section.id, { [activeElement.field]: "" });
      setInlinePopup(null);
    }
  }

  function deleteSectionById(sectionId: string) {
    const section = sections.find((item) => item.id === sectionId);
    if (!section || !window.confirm(`${sectionNames[section.type]} wirklich löschen?`)) return;
    replaceSections(deleteLandingpageSection(sections, section.id));
    setInlinePopup(null);
  }

  function moveSectionById(sectionId: string, direction: "up" | "down") {
    replaceSections(moveLandingpageSection(sections, sectionId, direction));
  }

  function addSection(type: LandingpageSectionType) {
    const next = addLandingpageSection(sections, type);
    const rawAdded = next[next.length - 1];
    const added = rawAdded ? ensureBuilderElementsForEditor({
      ...rawAdded,
      page: activeTab !== "landingpage" && !isFlowPageSection(type) ? activeTab : rawAdded.page
    }) : undefined;
    const withoutAdded = next.slice(0, -1);
    const activeIndex = withoutAdded.findIndex((section) => section.id === activeId);
    const insertIndex = activeIndex >= 0 ? activeIndex + 1 : withoutAdded.length;
    const ordered = added ? [...withoutAdded.slice(0, insertIndex), added, ...withoutAdded.slice(insertIndex)] : withoutAdded;
    replaceSections(ordered);
    setActiveId(added?.id ?? "");
    setActiveElement(added ? defaultActiveElementForSection(added) : null);
    setActiveTab(added ? pageTabForSection(added) : pageTabForSection(type));
    setAddModalOpen(false);
  }

  function reorderSection(overId: string) {
    if (!draggedSectionId || draggedSectionId === overId) return;
    replaceSections(reorderBuilderSections(sections, draggedSectionId, overId));
    setDraggedSectionId(null);
  }

  function persistSections(nextSections: LandingpageSection[], messageText = "Änderungen gespeichert.") {
    startTransition(async () => {
      const legacy = deriveLegacyPayload(nextSections, globalDesign);
      const payload = buildSavePayload(template, nextSections, globalDesign, legacy, addressForm);
      const response = await fetch(`/api/landingpage-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.ok) {
        setSavedSnapshot(editorSnapshot(nextSections, globalDesign, addressForm));
      }
      setMessage(response.ok ? messageText : data?.error ?? "Speichern fehlgeschlagen.");
    });
  }

  function save(messageText = "Änderungen gespeichert.") {
    persistSections(sections, messageText);
  }

  useEffect(() => {
    if (!inlinePopup) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setInlinePopup(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inlinePopup]);

  useEffect(() => {
    const scrollRoot = leftSidebarScrollRef.current;
    if (!scrollRoot || !activeElement) return;
    const activeTreeItem = scrollRoot.querySelector<HTMLElement>(`[data-builder-tree-key="${cssEscape(activeElementTreeKey(activeElement))}"]`);
    activeTreeItem?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeElement]);

  function generateAiCopy() {
    if (!previewProspect) {
      setMessage("Bitte zuerst einen Prospect für die Vorschau auswählen.");
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/ai/generate-landingpage-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: previewProspect.id, addressForm })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(data?.error ?? "KI-Vorschlag konnte nicht erzeugt werden.");
        return;
      }
      setAiPreview({
        headline: stripDashes(data.heroHeadline ?? data.headline ?? ""),
        bodyText: stripDashes(data.heroBodyText ?? data.bodyText ?? ""),
        ctaText: stripDashes(data.heroCtaText ?? data.ctaText ?? "")
      });
    });
  }

  return (
    <div className="landingpage-builder-editor flex h-screen min-w-0 flex-col overflow-hidden bg-[var(--editor-bg)] text-slate-950">
      <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--editor-border)] bg-[var(--editor-sidebar-bg)] px-4 text-[var(--editor-text)] sm:px-6">
        <Link href={backHref} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--editor-border)] px-3 text-sm font-semibold hover:bg-[var(--editor-card-hover-bg)]">← Zurück</Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-sm font-semibold sm:text-base">{template.name || "Landingpage Builder"}</h1>
          <p className={`mt-0.5 text-xs font-medium ${dirty ? "text-amber-300" : "text-emerald-300"}`}>{dirty ? "ungespeichert" : "gespeichert"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/admin/landingpages/templates/${template.id}/preview`}
            target="_blank"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--editor-border)] px-3 text-sm font-semibold hover:bg-[var(--editor-card-hover-bg)]"
          >
            <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Vorschau öffnen</span>
          </a>
          <button type="button" onClick={() => save()} disabled={isPending} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--editor-active-bg)] px-4 text-sm font-semibold text-[var(--editor-active-text)] disabled:opacity-60">
            <Save className="h-4 w-4" /> Speichern
          </button>
        </div>
      </div>
      <div className={`grid h-[calc(100vh-64px)] min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[var(--builder-left)_minmax(0,1fr)_var(--builder-right)] ${builderGridVars(leftPanelCollapsed, rightPanelCollapsed)}`}>
        <aside className={`flex h-full min-h-0 flex-col rounded-2xl border border-[var(--editor-border)] bg-[var(--editor-sidebar-bg)] text-[var(--editor-text)] shadow-sm transition-[width,padding] duration-200 ${leftPanelCollapsed ? "items-center overflow-visible px-2 py-3" : "overflow-hidden p-4"}`}>
          <div className={`flex items-center ${leftPanelCollapsed ? "justify-center" : "justify-between"} gap-3 px-1 py-2`}>
            {leftPanelCollapsed ? null : <h2 className="text-lg font-semibold">Vorlage bearbeiten</h2>}
            <button type="button" onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)} className="group relative grid h-10 w-10 place-items-center rounded-2xl bg-[var(--editor-card-bg)] text-[var(--editor-text)] shadow-sm transition hover:bg-[var(--editor-card-hover-bg)]" aria-label={leftPanelCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}>
              {leftPanelCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              {leftPanelCollapsed ? <Tooltip label="Ausklappen" /> : null}
            </button>
          </div>
          {leftPanelCollapsed ? (
            <div ref={leftSidebarScrollRef} className="mt-4 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto overflow-x-visible px-1 pb-5">
              {visibleBuilderSections(sections, activeTab).map((section) => (
                <CollapsedSidebarButton key={section.id} label={sectionNames[section.type]} active={section.id === activeId} onClick={() => selectElement({ sectionId: section.id, kind: "section" })} treeKey={`${section.id}-section`}>
                  {sectionIcon(section.type)}
                </CollapsedSidebarButton>
              ))}
              <CollapsedSidebarButton label="Element hinzufügen" active onClick={() => setAddModalOpen(true)}>
                <Plus className="h-5 w-5" />
              </CollapsedSidebarButton>
            </div>
          ) : (
            <div ref={leftSidebarScrollRef} className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 pb-24">
              <div className="space-y-2">
                {visibleBuilderSections(sections, activeTab).map((section) => (
                  <ElementTreeSection
                    key={section.id}
                    section={section}
                    activeElement={activeElement}
                    onSelect={(element) => {
                      selectElement(element);
                      setActiveTab(pageTabForSection(section));
                    }}
                    onDragStart={() => setDraggedSectionId(section.id)}
                    onDrop={() => reorderSection(section.id)}
                  />
                ))}
              </div>
              <button type="button" onClick={() => setAddModalOpen(true)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--editor-active-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--editor-active-text)] hover:opacity-95">
                <Plus className="h-4 w-4" /> Element hinzufügen
              </button>
              <button type="button" onClick={() => setDesignOpen((open) => !open)} className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[var(--editor-border)] px-4 py-2 text-sm font-semibold text-[var(--editor-text)] hover:bg-[var(--editor-card-hover-bg)]">Design</button>
            </div>
          )}
        </aside>

        <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-[var(--editor-bg)]">
          <EditorTopbar
            activeTab={activeTab}
            addressForm={addressForm}
            onAddressFormChange={setAddressForm}
            onTabChange={changeActiveTab}
          />
          {message ? <div className="mx-5 mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100">{message}</div> : null}
          <div className="relative min-h-0 flex-1 overflow-auto px-4 py-6 pb-24 lg:px-6">
            {activeElement && activeSection ? (
              <EditorControlLayer
                title={selectedLabel}
                detail={selectedDetail}
                anchorKey={selectedAnchorKey}
                onEdit={editActiveSelection}
                onSettings={openActiveSettings}
                onDuplicate={duplicateActiveElement}
                onDelete={deleteActiveElement}
                onMoveUp={() => moveSectionById(activeSection.id, "up")}
                onMoveDown={() => moveSectionById(activeSection.id, "down")}
                canMoveUp={activeSectionIndex > 0}
                canMoveDown={activeSectionIndex >= 0 && activeSectionIndex < sections.length - 1}
                canDuplicate={Boolean(activeElement)}
                canDelete={Boolean(activeElement)}
              />
            ) : null}
            {activeElement?.kind === "text" && activeElement.field ? (
              <FloatingTextToolbar
                style={activeElementStyle}
                device={device}
                onClose={() => setActiveElement(activeSection ? { sectionId: activeSection.id, kind: "section" } : null)}
                onStyleChange={patchActiveElementStyle}
              />
            ) : null}
            {activeElement?.kind === "video" && activeSection ? (
              <FloatingVideoPanel
                settings={activeSection.settings}
                onClose={() => setActiveElement({ sectionId: activeSection.id, kind: "section" })}
                onSettingsChange={patchActiveVideoElement}
              />
            ) : null}
            {designOpen && activeSection ? (
              <FloatingDesignPanel
                design={globalDesign}
                activeSection={activeSection}
                onClose={() => setDesignOpen(false)}
                onDesignChange={setGlobalDesign}
                onSectionChange={(patch) => patchSettings(activeSection.id, patch)}
              />
            ) : null}
            <div className="mx-auto mb-4 flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <DeviceSwitch device={device} onDeviceChange={setDevice} />
              <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--editor-muted-text)]">
                Beispiel-Lead
                <select className="h-9 rounded-xl border border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-3 text-xs text-[var(--editor-text)] outline-none" value={previewProspectId} onChange={(event) => setPreviewProspectId(event.target.value)}>
                  {prospects.length === 0 ? <option value="" className="text-slate-950">Muster Spedition GmbH</option> : null}
                  {prospects.map((prospect) => <option key={prospect.id} value={prospect.id} className="text-slate-950">{prospect.companyName}</option>)}
                </select>
              </label>
            </div>
            <PreviewCanvas
              activeId={activeId}
              activeTab={activeTab}
              device={device}
              editing={editing}
              globalDesign={globalDesign}
              prospect={previewProspect}
              bookingCalendars={bookingCalendars}
              sections={renderedSections}
              activeElement={activeElement}
              onEdit={(sectionId, field, kind = "text") => selectElement({ sectionId, field, kind })}
              onOpenPopup={(element) => openElementPopup(element)}
              onDuplicate={duplicateActiveElement}
              onDelete={deleteActiveElement}
              onMove={moveSectionById}
              onClearSelection={clearCanvasSelection}
              onSelect={(sectionId) => selectElement({ sectionId, kind: "section" })}
              onPatchSettings={patchSettings}
              onPatchElementText={patchElementText}
            />
          </div>
        </main>
        <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--editor-border)] bg-white p-4 text-slate-950 lg:min-w-[360px]">
          <div className={`flex items-center ${rightPanelCollapsed ? "justify-center" : "justify-between"} gap-3 px-1 py-2`}>
            {rightPanelCollapsed ? null : <h2 className="text-lg font-semibold">Eigenschaften</h2>}
            <button type="button" onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200" aria-label="Eigenschaften einklappen">
              {rightPanelCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
          {rightPanelCollapsed || !activeSection ? null : (
            <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1 pb-24">
              <SectionProperties
                activeElement={activeElement}
                section={activeSection}
                bookingCalendars={bookingCalendars}
                aiPreview={aiPreview}
                device={device}
                onAcceptAi={() => {
                  if (!aiPreview || !activeSection) return;
                  patchSettings(activeSection.id, aiPreview);
                  setAiPreview(null);
                }}
                onRejectAi={() => setAiPreview(null)}
                onElementSettingsChange={patchActiveElement}
                onElementStyleChange={patchActiveElementStyle}
                onElementTextChange={patchActiveText}
                onSectionChange={(patch) => activeSection ? patchSection(activeSection.id, patch) : undefined}
                onSettingsChange={(patch) => activeSection ? patchSettings(activeSection.id, patch) : undefined}
              />
            </div>
          )}
        </aside>
      </div>
      {inlinePopup && activeSection && activeElement && activeElement.kind !== "section" ? (
        <InlineElementPopup
          activeElement={activeElement}
          device={device}
          section={activeSection}
          settings={activeSection.settings}
          bookingCalendars={bookingCalendars}
          onClose={() => setInlinePopup(null)}
          onSettingsChange={patchActiveElement}
          onStyleChange={patchActiveElementStyle}
          onTextChange={patchActiveText}
        />
      ) : null}
      {addModalOpen ? <AddSectionModal onAdd={addSection} onClose={() => setAddModalOpen(false)} /> : null}
    </div>
  );
}

function EditorTopbar({
  activeTab,
  addressForm,
  onAddressFormChange,
  onTabChange
}: {
  activeTab: PageTab;
  addressForm: AddressForm;
  onAddressFormChange: (addressForm: AddressForm) => void;
  onTabChange: (tab: PageTab) => void;
}) {
  return (
    <div className="flex min-h-14 min-w-0 items-center justify-between gap-3 border-b border-[var(--editor-border)] bg-[var(--editor-sidebar-bg)] px-4 py-2 text-[var(--editor-text)]">
      <div className="admin-tab-scroll min-w-0 flex-1">
        <Segmented items={["landingpage", "booking", "thank_you", "legal"]} labels={["Landingpage", "Buchungsseite", "Danke-Seite", "Rechtliches"]} value={activeTab} onChange={(value) => onTabChange(value as PageTab)} />
      </div>
        <label className="flex min-h-10 shrink-0 items-center gap-2 text-xs font-semibold text-[var(--editor-muted-text)]">
          Anrede
          <select className="h-9 rounded-full border border-[var(--editor-border)] bg-[var(--editor-card-bg)] px-3 text-xs font-semibold text-[var(--editor-text)]" value={addressForm} onChange={(event) => onAddressFormChange(event.target.value as AddressForm)}>
            <option value="du">Du-Form</option>
            <option value="sie">Sie-Form</option>
          </select>
        </label>
    </div>
  );
}

function Segmented({ items, labels, value, onChange }: { items: string[]; labels: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex shrink-0 flex-nowrap rounded-xl bg-[var(--editor-card-bg)] p-1">
      {items.map((item, index) => (
        <button key={item} type="button" onClick={() => onChange(item)} className={`min-h-9 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${value === item ? "bg-[var(--editor-active-bg)] text-[var(--editor-active-text)] shadow-sm" : "text-[var(--editor-muted-text)]"}`}>
          {labels[index]}
        </button>
      ))}
    </div>
  );
}

function PanelCollapseButton({ collapsed, expandedLabel, collapsedLabel, onToggle }: { collapsed: boolean; expandedLabel: string; collapsedLabel: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={collapsed ? collapsedLabel : expandedLabel}
      className={`mb-4 inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:border-[#6556ff] ${collapsed ? "w-10" : "w-full gap-2 px-3"}`}
    >
      <span aria-hidden>{collapsed ? ">" : "<"}</span>
      {collapsed ? null : <span>{expandedLabel}</span>}
    </button>
  );
}

function PanelGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function BuilderActionTile({ label, description, onAdd }: { label: string; description: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm outline-none transition hover:border-[#6556ff] hover:bg-[#f7f6ff] focus-visible:ring-2 focus-visible:ring-[#6556ff]"
    >
      <span className="block text-sm font-semibold text-slate-900">{label}</span>
      <span className="mt-1 block text-xs text-slate-500">{description}</span>
    </button>
  );
}

function BuilderElementTile({ element, onAdd }: { element: { label: string; type: LandingpageSectionType; description: string }; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm outline-none transition hover:border-[#6556ff] hover:bg-[#f7f6ff] focus-visible:ring-2 focus-visible:ring-[#6556ff]"
    >
      <span className="block text-sm font-semibold text-slate-900">{element.label}</span>
      <span className="mt-1 block text-xs text-slate-500">{element.description}</span>
      <span className="mt-3 inline-flex rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white">Hinzufügen</span>
    </button>
  );
}

function CollapsedSidebarButton({ label, active, treeKey, onClick, children }: { label: string; active?: boolean; treeKey?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      data-builder-tree-key={treeKey}
      title={label}
      onClick={onClick}
      className={`group relative grid h-12 w-12 place-items-center rounded-2xl transition ${active ? "bg-[var(--editor-active-bg)] text-[var(--editor-active-text)] shadow-sm" : "bg-[var(--editor-card-bg)] text-[var(--editor-muted-text)] hover:bg-blue-50 hover:text-[#4f46e5]"}`}
      aria-label={label}
    >
      <span className="grid h-6 w-6 place-items-center [&>svg]:h-5 [&>svg]:w-5">{children}</span>
      <Tooltip label={label} />
    </button>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 opacity-0 shadow-lg transition group-hover:block group-hover:opacity-100">
      {label}
    </span>
  );
}

function ElementTreeSection({
  section,
  activeElement,
  onSelect,
  onDragStart,
  onDrop
}: {
  section: LandingpageSection;
  activeElement: ActiveBuilderElement | null;
  onSelect: (element: ActiveBuilderElement) => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const sectionElement: ActiveBuilderElement = { sectionId: section.id, kind: "section" };
  const items = elementTreeItems(section);
  const active = activeElement?.sectionId === section.id;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={`rounded-xl border p-2 transition ${active ? "border-[var(--editor-active-bg)] bg-[var(--editor-active-bg)]/10" : "border-[var(--editor-border)] bg-[var(--editor-card-bg)] hover:bg-[var(--editor-card-hover-bg)]"}`}
    >
      <div className="flex items-center gap-2">
        <button type="button" data-builder-tree-key={activeElementTreeKey(sectionElement)} onClick={() => onSelect(section.type === "faq" ? defaultActiveElementForSection(section) : sectionElement)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isSameElement(activeElement, sectionElement) ? "bg-[var(--editor-active-bg)] text-[var(--editor-active-text)]" : "bg-[var(--editor-card-bg)] text-[var(--editor-muted-text)]"}`}>{sectionIcon(section.type)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--editor-text)]">{sectionNames[section.type]}</span>
            <span className="block truncate text-xs text-[var(--editor-muted-text)]">{section.enabled ? "Section" : "Section, inaktiv"}</span>
          </span>
        </button>
      </div>
      <div className="ml-5 mt-1 grid gap-1 border-l border-[var(--editor-border)] pl-3">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            data-builder-tree-key={activeElementTreeKey(item.element)}
            onClick={() => onSelect(item.element)}
            className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left ${isSameElement(activeElement, item.element) ? "bg-[var(--editor-active-bg)] text-[var(--editor-active-text)]" : "text-[var(--editor-text)] hover:bg-[var(--editor-card-hover-bg)]"}`}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-black/5">{item.icon}</span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{item.label}</span>
              <span className={`block truncate text-[10px] ${isSameElement(activeElement, item.element) ? "text-current/75" : "text-[var(--editor-muted-text)]"}`}>{item.type}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewCanvas({
  activeId,
  activeElement,
  activeTab,
  bookingCalendars,
  device,
  editing,
  globalDesign,
  prospect,
  sections,
  onEdit,
  onOpenPopup,
  onDuplicate,
  onDelete,
  onMove,
  onClearSelection,
  onPatchElementText,
  onPatchSettings,
  onSelect
}: {
  activeId: string;
  activeElement: ActiveBuilderElement | null;
  activeTab: PageTab;
  bookingCalendars: BookingCalendarReference[];
  device: Device;
  editing: { sectionId: string; field: EditingField } | null;
  globalDesign: GlobalLandingpageDesign;
  prospect?: Prospect;
  sections: LandingpageSection[];
  onEdit: (sectionId: string, field: EditingField, kind?: BuilderElementKind) => void;
  onOpenPopup: (element: ActiveBuilderElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
  onClearSelection: () => void;
  onPatchElementText: (element: ActiveBuilderElement, value: string) => void;
  onPatchSettings: (sectionId: string, patch: Partial<LandingpageSectionSettings>) => void;
  onSelect: (sectionId: string) => void;
}) {
  const width = devicePreviewWidth(device);
  const selectedSection = sections.find((section) => section.id === activeId);
  return (
    <div className="min-h-[520px] overflow-x-auto rounded-[28px] bg-[#dfe4ed] p-4 shadow-inner transition sm:min-h-[680px] sm:p-8" onClick={onClearSelection}>
      <div className="mx-auto mb-4 flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm" style={{ maxWidth: width }}>
        <span className="min-w-0 truncate">
          {selectedSection ? `${sectionNames[selectedSection.type]} ausgewählt` : "Element anklicken zum Bearbeiten"}
        </span>
        <span>{width}px</span>
      </div>
      <div className="mx-auto overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 transition-all duration-200" style={{ width, maxWidth: "100%", fontFamily: globalDesign.fontFamily }}>
        {sectionsForTab(sections, activeTab)
            .map((section) => (
              <CanvasSection
                key={section.id}
                section={section}
                active={activeElement?.kind === "section" && activeId === section.id}
                activeElement={activeElement}
                device={device}
                editing={editing}
                globalDesign={globalDesign}
                bookingCalendars={bookingCalendars}
                prospect={prospect}
                onEdit={onEdit}
                onOpenPopup={onOpenPopup}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onMove={onMove}
                onPatchElementText={onPatchElementText}
                onPatchSettings={onPatchSettings}
                onSelect={onSelect}
              />
            ))}
      </div>
    </div>
  );
}

function CanvasSection({
  section,
  active,
  activeElement,
  bookingCalendars,
  prospect,
  device,
  editing,
  globalDesign,
  onEdit,
  onOpenPopup,
  onDuplicate,
  onDelete,
  onMove,
  onPatchElementText,
  onPatchSettings,
  onSelect
}: {
  section: LandingpageSection;
  active: boolean;
  activeElement: ActiveBuilderElement | null;
  bookingCalendars: BookingCalendarReference[];
  prospect?: Prospect;
  device: Device;
  editing: { sectionId: string; field: EditingField } | null;
  globalDesign: GlobalLandingpageDesign;
  onEdit: (sectionId: string, field: EditingField, kind?: BuilderElementKind) => void;
  onOpenPopup: (element: ActiveBuilderElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
  onPatchElementText: (element: ActiveBuilderElement, value: string) => void;
  onPatchSettings: (sectionId: string, patch: Partial<LandingpageSectionSettings>) => void;
  onSelect: (sectionId: string) => void;
}) {
  const settings = section.settings;
  const responsive = section.responsive?.[device] ?? settings.style?.[device] ?? {};
  const style = {
    ...backgroundStyleFromSettings(settings, settings.backgroundColor || "white"),
    color: settings.textColor || globalDesign.textColor,
    paddingTop: Number(responsive.paddingTop ?? settings.paddingTop ?? settings.spacingTop ?? (section.type === "header" ? 0 : 56)),
    paddingBottom: Number(responsive.paddingBottom ?? settings.paddingBottom ?? settings.spacingBottom ?? (section.type === "header" ? 0 : 56)),
    paddingLeft: Number(responsive.paddingLeft ?? settings.paddingLeft ?? (device === "mobile" ? 16 : 32)),
    paddingRight: Number(responsive.paddingRight ?? settings.paddingRight ?? (device === "mobile" ? 16 : 32)),
    marginTop: Number(settings.marginTop ?? 0),
    marginBottom: Number(settings.marginBottom ?? 0),
    borderRadius: settings.borderRadius,
    boxShadow: settings.shadow && settings.shadow !== "none" ? settings.shadow : undefined,
    borderColor: settings.borderColor,
    borderWidth: Number(settings.borderWidth ?? 0),
    textAlign: settings.alignment,
    fontFamily: settings.fontFamily || globalDesign.fontFamily
  } as const;
  const hidden = (device === "desktop" && settings.visibleDesktop === false) || (device === "tablet" && settings.visibleTablet === false) || (device === "mobile" && settings.visibleMobile === false);

  return (
    <SelectedElementOverlay active={active} anchorKey={active ? activeElementTreeKey({ sectionId: section.id, kind: "section" }) : undefined} hidden={hidden} onClick={() => onSelect(section.id)} style={style}>
      {section.type === "header" ? <HeaderSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "headerCtaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} device={device} /> : null}
      {section.type === "hero" ? <HeroSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} device={device} /> : null}
      {section.type === "explainer_video" ? <ExplainerSection section={section} activeElement={activeElement} globalDesign={globalDesign} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
      {section.type === "comparison" ? <ComparisonSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: "text", elementId: findBuilderElementByField(section, field)?.id }, value)} onPatchSettings={onPatchSettings} device={device} /> : null}
      {section.type === "cta" || section.type === "cta_button" ? <CtaSection section={section} activeElement={activeElement} globalDesign={globalDesign} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
      {section.type === "image" || section.type === "video" || section.type === "benefits" || section.type === "divider" || section.type === "spacer" ? <ElementSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: "text", elementId: findBuilderElementByField(section, field)?.id }, value)} device={device} /> : null}
      {section.type === "approach" || section.type === "faq" || section.type === "textblock" || section.type === "footer" ? <SimpleSection section={section} activeElement={activeElement} globalDesign={globalDesign} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onPatchElementText={onPatchElementText} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
      {section.type === "booking" ? <BookingPageSection section={section} activeElement={activeElement} globalDesign={globalDesign} prospect={prospect} bookingCalendars={bookingCalendars} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
      {section.type === "thank_you" ? <ThankYouPageSection section={section} activeElement={activeElement} globalDesign={globalDesign} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
      {section.type === "legal" ? <LegalPageSection section={section} activeElement={activeElement} globalDesign={globalDesign} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
    </SelectedElementOverlay>
  );
}

function HeaderSection({ section, activeElement, globalDesign, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange, device }: CanvasChildProps & { device: Device }) {
  const settings = section.settings;
  const centered = settings.headerLogoPosition === "center" || settings.headerAlignment === "center";
  const justify = centered ? "justify-center" : settings.headerAlignment === "right" ? "justify-end" : "justify-between";
  const logo = resolveHeaderLogo(settings);
  const headerButtonSelected = isActiveButton(activeElement, section.id, "headerCtaText");
  const logoElement: ActiveBuilderElement = {
    sectionId: section.id,
    field: "logoText",
    kind: "logo",
    elementId: findBuilderElementByField(section, "logoText")?.id ?? findBuilderElementByField(section, "headerLogoUrl")?.id
  };
  return (
    <div className={`mx-auto flex max-w-6xl ${device === "mobile" ? "flex-wrap gap-3 py-3" : "items-center gap-6 py-5"} ${justify}`}>
      <ElementChrome selected={isSameElement(activeElement, logoElement)} element={logoElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}>
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(section.id, "logoText", "logo"); }} className="text-left text-xl font-bold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#6556ff]">
          {logo.type === "image" && logo.imageUrl ? (
            <img
              src={logo.imageUrl}
              alt={logo.alt}
              className="block max-h-10 max-w-[210px] object-contain"
              style={{ width: logoCssSize(logo.width), height: logoCssSize(logo.height) }}
            />
          ) : settings.headerShowTextFallback === false ? null : logo.text}
        </button>
      </ElementChrome>
      <nav className={`${device === "mobile" ? "hidden" : "hidden items-center gap-6 md:flex"}`}>
        {(["menuItem1Text", "menuItem2Text", "menuItem3Text"] as EditingField[]).map((field) => {
          const builderElement = findBuilderElementByField(section, field);
          const navElement: ActiveBuilderElement = { sectionId: section.id, field, kind: "link", elementId: builderElement?.id };
          return (
            <ElementChrome key={field} selected={isSameElement(activeElement, navElement)} element={navElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}>
              <span
                role="textbox"
                tabIndex={0}
                contentEditable
                suppressContentEditableWarning
                style={textInlineStyle(settings, builderElement?.style, device)}
                onClick={(event) => { event.stopPropagation(); onEdit(section.id, field, "link"); }}
                onInput={(event) => onInlineChange(field, event.currentTarget.textContent ?? "")}
                className="block rounded-lg px-1 outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff]"
              >
                {textValueForElement(builderElement, settings[field])}
              </span>
            </ElementChrome>
          );
        })}
      </nav>
      <ButtonBlock section={section} field="headerCtaText" selected={headerButtonSelected} text={settings.headerCtaText || "Termin vereinbaren"} globalDesign={globalDesign} activeElement={activeElement} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
    </div>
  );
}

function HeroSection({ section, activeElement, globalDesign, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange, device }: CanvasChildProps & { device: Device }) {
  const settings = section.settings;
  const videoFirst = settings.videoPosition === "left";
  const buttonSelected = isActiveButton(activeElement, section.id, "ctaText");
  const videoBuilderElement = findBuilderElementByField(section, "videoUrl");
  const videoElement: ActiveBuilderElement = { sectionId: section.id, field: "videoUrl", kind: "video", elementId: videoBuilderElement?.id };
  const video = <ElementChrome selected={isSameElement(activeElement, videoElement)} element={videoElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}><div role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onEdit(section.id, "videoUrl", "video"); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onEdit(section.id, "videoUrl", "video"); }} className="block w-full rounded-[28px] text-left outline-none"><VideoBox settings={settings} elementStyle={videoBuilderElement?.style} globalDesign={globalDesign} label={settings.videoLabel || "Persönliches Video ansehen!"} /></div></ElementChrome>;
  const copy = (
    <div className="flex flex-col justify-center">
      <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      <EditableText section={section} activeElement={activeElement} field="bodyText" device={device} className="mt-5 break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.bodyText}</EditableText>
      <ButtonAlign settings={settings} className="mt-7">
        <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText || "Gratis Termin vereinbaren"} globalDesign={globalDesign} activeElement={activeElement} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
      </ButtonAlign>
    </div>
  );
  return <div className={`mx-auto grid max-w-6xl ${device === "mobile" ? "gap-6 py-5" : "gap-10 py-8 lg:grid-cols-[1fr_0.9fr]"}`}>{videoFirst && device !== "mobile" ? video : copy}{videoFirst && device !== "mobile" ? copy : video}</div>;
}

function ExplainerSection({ section, activeElement, globalDesign, device, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange }: CanvasChildProps & { device: Device }) {
  const settings = section.settings;
  const buttonSelected = isActiveButton(activeElement, section.id, "ctaText");
  return (
    <div className="mx-auto max-w-5xl py-4 text-center">
      <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="mx-auto max-w-4xl break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      <EditableText section={section} activeElement={activeElement} field="subheadline" device={device} className="mx-auto mt-5 inline-block rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.subheadline || "Kurzer Überblick"}</EditableText>
        {settings.showArrowEmoji === false ? null : <div className="mt-4 text-3xl">↓</div>}
      <ElementChrome selected={isSameElement(activeElement, { sectionId: section.id, field: "videoUrl", kind: "video", elementId: findBuilderElementByField(section, "videoUrl")?.id })} element={{ sectionId: section.id, field: "videoUrl", kind: "video", elementId: findBuilderElementByField(section, "videoUrl")?.id }} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}><div role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onEdit(section.id, "videoUrl", "video"); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onEdit(section.id, "videoUrl", "video"); }} className="mx-auto mt-7 block max-w-4xl rounded-[28px] text-left outline-none"><VideoBox settings={settings} elementStyle={findBuilderElementByField(section, "videoUrl")?.style} globalDesign={globalDesign} label={settings.buttonText || "Video ansehen"} large /></div></ElementChrome>
      <ButtonAlign settings={settings} className="mt-7">
        <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText || "Jetzt Abläufe gemeinsam durchgehen"} globalDesign={globalDesign} activeElement={activeElement} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
      </ButtonAlign>
    </div>
  );
}

function ComparisonSection({ section, activeElement, globalDesign, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange, onPatchSettings, device }: CanvasChildProps & { onPatchSettings: (sectionId: string, patch: Partial<LandingpageSectionSettings>) => void; device: Device }) {
  const settings = section.settings;
  const beforeItems = settings.leftItems ?? settings.beforeItems ?? [];
  const afterItems = settings.rightItems ?? settings.afterItems ?? [];
  return (
    <div className="mx-auto max-w-6xl">
      <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      {settings.subheadline ? <EditableText section={section} activeElement={activeElement} field="subheadline" device={device} className="mt-3 break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.subheadline}</EditableText> : null}
      <div className={`mt-7 grid gap-5 ${device === "mobile" ? "" : "md:grid-cols-2"}`}>
        <CompareCard section={section} activeElement={activeElement} listName="leftItems" title={settings.leftTitle || "Vorher"} tone="bad" items={beforeItems} globalDesign={globalDesign} device={device} onOpenPopup={onOpenPopup} onEdit={onEdit} onDuplicate={onDuplicate} onDeleteElement={onDelete} onMove={onMove} onAdd={() => onPatchSettings(section.id, { leftItems: [...beforeItems, "Neuer Punkt"], beforeItems: [...beforeItems, "Neuer Punkt"] })} onChange={(index, value) => onPatchSettings(section.id, { leftItems: beforeItems.map((item, itemIndex) => itemIndex === index ? value : item), beforeItems: beforeItems.map((item, itemIndex) => itemIndex === index ? value : item) })} />
        <CompareCard section={section} activeElement={activeElement} listName="rightItems" title={settings.rightTitle || "Nachher"} tone="good" items={afterItems} globalDesign={globalDesign} device={device} onOpenPopup={onOpenPopup} onEdit={onEdit} onDuplicate={onDuplicate} onDeleteElement={onDelete} onMove={onMove} onAdd={() => onPatchSettings(section.id, { rightItems: [...afterItems, "Neuer Punkt"], afterItems: [...afterItems, "Neuer Punkt"] })} onChange={(index, value) => onPatchSettings(section.id, { rightItems: afterItems.map((item, itemIndex) => itemIndex === index ? value : item), afterItems: afterItems.map((item, itemIndex) => itemIndex === index ? value : item) })} />
      </div>
    </div>
  );
}

function CtaSection({ section, activeElement, globalDesign, device, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange }: CanvasChildProps & { device: Device }) {
  const settings = section.settings;
  const buttonSelected = isActiveButton(activeElement, section.id, "ctaText");
  return (
    <div className="mx-auto max-w-5xl rounded-[28px] bg-slate-950 px-8 py-10 text-center text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
      <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      <EditableText section={section} activeElement={activeElement} field="bodyText" device={device} className="mx-auto mt-4 max-w-2xl break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.bodyText}</EditableText>
      <div className="mx-auto my-7 h-px max-w-lg bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <ButtonAlign settings={settings}>
        <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText || "Gratis Termin vereinbaren"} globalDesign={globalDesign} activeElement={activeElement} device={device} fallbackColor={globalDesign.accentColor} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
      </ButtonAlign>
    </div>
  );
}

function SimpleSection({ section, activeElement, globalDesign, device = "desktop", onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onPatchSettings, onPatchElementText, onInlineChange }: CanvasChildProps & { device?: Device }) {
  const settings = section.settings;
  const buttonSelected = isActiveButton(activeElement, section.id, "ctaText");
  if (section.type === "footer") {
    return <FooterPreview bodyText={settings.bodyText || "Tasklytic"} onEdit={() => onEdit(section.id, "bodyText")} />;
  }
  if (section.type === "faq") {
    return (
      <div className="mx-auto max-w-5xl">
        <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "FAQ"}</EditableText>
        <div className="mt-5 grid gap-3">{(settings.faqItems ?? []).map((item, index) => {
          const questionElement: ActiveBuilderElement = { sectionId: section.id, kind: "text", itemList: "faqItems", itemIndex: index, itemKey: "question" };
          const answerElement: ActiveBuilderElement = { sectionId: section.id, kind: "text", itemList: "faqItems", itemIndex: index, itemKey: "answer" };
          const questionBuilderElement = findBuilderElementForActive(section, questionElement);
          const answerBuilderElement = findBuilderElementForActive(section, answerElement);
          const resolvedQuestion = { ...questionElement, elementId: questionBuilderElement?.id };
          const resolvedAnswer = { ...answerElement, elementId: answerBuilderElement?.id };
          return (
          <div key={index} className="rounded-2xl bg-slate-50 p-5">
            <ElementChrome selected={isSameElement(activeElement, resolvedQuestion)} element={resolvedQuestion} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}>
              <h3
                role="textbox"
                tabIndex={0}
                contentEditable
                suppressContentEditableWarning
                style={textInlineStyle(settings, questionBuilderElement?.style, device)}
                className={`rounded-lg outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff] ${textAnimationClass(questionBuilderElement?.style?.animation)}`}
                onClick={(event) => { event.stopPropagation(); onOpenPopup(resolvedQuestion); }}
                onInput={(event) => {
                  onPatchElementText?.(resolvedQuestion, event.currentTarget.textContent ?? "");
                }}
              >
                {textValueForElement(questionBuilderElement, item.question)}
              </h3>
            </ElementChrome>
            <ElementChrome selected={isSameElement(activeElement, resolvedAnswer)} element={resolvedAnswer} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}>
              <p
                role="textbox"
                tabIndex={0}
                contentEditable
                suppressContentEditableWarning
                style={textInlineStyle(settings, answerBuilderElement?.style, device)}
                className={`rounded-lg outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff] ${textAnimationClass(answerBuilderElement?.style?.animation)}`}
                onClick={(event) => { event.stopPropagation(); onOpenPopup(resolvedAnswer); }}
                onInput={(event) => {
                  onPatchElementText?.(resolvedAnswer, event.currentTarget.textContent ?? "");
                }}
              >
                {textValueForElement(answerBuilderElement, item.answer)}
              </p>
            </ElementChrome>
          </div>
        );})}</div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl text-center">
      <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      <EditableText section={section} activeElement={activeElement} field="bodyText" device={device} className="mt-4 break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.bodyText}</EditableText>
      {settings.ctaText ? (
        <ButtonAlign settings={settings} className="mt-5">
          <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText} globalDesign={globalDesign} activeElement={activeElement} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
        </ButtonAlign>
      ) : null}
    </div>
  );
}

function ElementSection({ section, activeElement, globalDesign, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onPatchSettings, onInlineChange, device }: CanvasChildProps & { device: Device }) {
  const settings = section.settings;
  if (section.type === "divider") return <div className="mx-auto h-px max-w-5xl bg-slate-200" />;
  if (section.type === "spacer") return <div style={{ height: Number(settings.spacerHeight ?? 48) }} />;
  if (section.type === "image") {
    return (
      <div className="mx-auto max-w-5xl text-center">
        {settings.headline ? <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="mb-5 break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText> : null}
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(section.id, "imageUrl", "link"); }} className="block w-full overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#6556ff]">
          {settings.imageUrl ? <img src={settings.imageUrl} alt={settings.imageAlt || ""} className="h-auto w-full object-cover" /> : <span className="grid min-h-56 place-items-center text-sm font-semibold text-slate-500">Bild auswählen</span>}
        </button>
      </div>
    );
  }
  if (section.type === "video") {
    return (
      <div className="mx-auto max-w-4xl text-center">
        <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "Video"}</EditableText>
        <ElementChrome selected={isSameElement(activeElement, { sectionId: section.id, field: "videoUrl", kind: "video", elementId: findBuilderElementByField(section, "videoUrl")?.id })} element={{ sectionId: section.id, field: "videoUrl", kind: "video", elementId: findBuilderElementByField(section, "videoUrl")?.id }} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}><div role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onEdit(section.id, "videoUrl", "video"); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onEdit(section.id, "videoUrl", "video"); }} className="mt-6 block w-full rounded-[28px] text-left outline-none"><VideoBox settings={settings} elementStyle={findBuilderElementByField(section, "videoUrl")?.style} globalDesign={globalDesign} label={settings.buttonText || "Video ansehen"} large /></div></ElementChrome>
      </div>
    );
  }
  if (section.type === "benefits") {
    return (
      <div className="mx-auto max-w-6xl">
        <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "Vorteile"}</EditableText>
        <div className={`mt-6 grid gap-4 ${device === "mobile" ? "" : "md:grid-cols-3"}`}>
          {(settings.benefitItems ?? []).map((item, index) => {
            const titleElement: ActiveBuilderElement = { sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: "title" };
            const textElement: ActiveBuilderElement = { sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: "text" };
            const titleBuilderElement = findBuilderElementForActive(section, titleElement);
            const textBuilderElement = findBuilderElementForActive(section, textElement);
            const resolvedTitle = { ...titleElement, elementId: titleBuilderElement?.id };
            const resolvedText = { ...textElement, elementId: textBuilderElement?.id };
            return (
            <ElementChrome key={`${item.title}-${index}`} selected={isSameElement(activeElement, resolvedTitle)} element={resolvedTitle} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}>
              <div className="rounded-2xl bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.09)]" style={{ borderRadius: globalDesign.cardRadius }}>
                <h3
                  role="textbox"
                  tabIndex={0}
                  contentEditable
                  suppressContentEditableWarning
                  style={textInlineStyle(settings, titleBuilderElement?.style, device)}
                  className="rounded-lg outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff]"
                  onClick={(event) => { event.stopPropagation(); onOpenPopup(resolvedTitle); }}
                  onInput={(event) => {
                    const items = settings.benefitItems ?? [];
                    onPatchSettings?.(section.id, { benefitItems: items.map((benefit, itemIndex) => itemIndex === index ? { ...benefit, title: event.currentTarget.textContent ?? "" } : benefit) });
                  }}
                >
                  {item.title}
                </h3>
                <p
                  role="textbox"
                  tabIndex={0}
                  contentEditable
                  suppressContentEditableWarning
                  style={textInlineStyle(settings, textBuilderElement?.style, device)}
                  className="mt-2 rounded-lg outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff]"
                  onClick={(event) => { event.stopPropagation(); onOpenPopup(resolvedText); }}
                  onInput={(event) => {
                    const items = settings.benefitItems ?? [];
                    onPatchSettings?.(section.id, { benefitItems: items.map((benefit, itemIndex) => itemIndex === index ? { ...benefit, text: event.currentTarget.textContent ?? "" } : benefit) });
                  }}
                >
                  {item.text}
                </p>
              </div>
            </ElementChrome>
          );})}
        </div>
      </div>
    );
  }
  return null;
}

type CanvasChildProps = {
  section: LandingpageSection;
  activeElement?: ActiveBuilderElement | null;
  globalDesign: GlobalLandingpageDesign;
  onEdit: (sectionId: string, field: EditingField, kind?: BuilderElementKind) => void;
  onOpenPopup: (element: ActiveBuilderElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
  onPatchSettings?: (sectionId: string, patch: Partial<LandingpageSectionSettings>) => void;
  onPatchElementText?: (element: ActiveBuilderElement, value: string) => void;
  onInlineChange: (field: EditingField, value: string) => void;
};

function EditableText({
  section,
  activeElement,
  field,
  device = "desktop",
  className,
  children,
  onEdit,
  onOpenPopup,
  onDuplicate,
  onDelete,
  onMove,
  onInlineChange
}: {
  section: LandingpageSection;
  activeElement?: ActiveBuilderElement | null;
  field: EditingField;
  device?: Device;
  className: string;
  children?: string;
  onEdit: (sectionId: string, field: EditingField, kind?: BuilderElementKind) => void;
  onOpenPopup: (element: ActiveBuilderElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
  onInlineChange: (field: EditingField, value: string) => void;
}) {
  const element = findBuilderElementByField(section, field);
  const chromeElement: ActiveBuilderElement = { sectionId: section.id, field, kind: "text", elementId: element?.id };
  const text = typeof element?.props?.text === "string" ? element.props.text : children;
  return (
    <ElementChrome
      selected={isSameElement(activeElement, chromeElement)}
      element={chromeElement}
      onEdit={onEdit}
      onOpenPopup={onOpenPopup}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onMove={onMove}
    >
      <span
        role="textbox"
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        style={textInlineStyle(section.settings, element?.style, device)}
        onClick={(event) => { event.stopPropagation(); onEdit(section.id, field, "text"); }}
        onInput={(event) => onInlineChange(field, event.currentTarget.textContent ?? "")}
        className={`block w-full rounded-xl border border-transparent p-1 outline-none hover:border-[#6556ff] hover:bg-[#6556ff]/5 focus-visible:border-[#6556ff] focus-visible:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff] ${className}`}
      >
        {text || "Text bearbeiten"}
      </span>
    </ElementChrome>
  );
}

function ElementChrome({
  selected,
  element,
  children,
  onEdit,
  onOpenPopup
}: {
  selected: boolean;
  element: ActiveBuilderElement;
  children: ReactNode;
  onEdit: (sectionId: string, field: EditingField, kind?: BuilderElementKind) => void;
  onOpenPopup: (element: ActiveBuilderElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
}) {
  return (
    <span data-builder-control-anchor={activeElementTreeKey(element)} className={`builder-element-frame ${selected ? "builder-element-frame-active" : ""}`} onClick={(event) => {
      event.stopPropagation();
      if (element.field) onEdit(element.sectionId, element.field, element.kind);
      else onOpenPopup(element);
    }}>
      {children}
    </span>
  );
}

function VideoBox({ settings, elementStyle }: { settings: LandingpageSectionSettings; elementStyle?: BuilderElementStyle; globalDesign: GlobalLandingpageDesign; label: string; large?: boolean }) {
  return (
    <div onClick={(event) => event.stopPropagation()} style={elementInlineStyle(elementStyle)}>
      <VideoPreview {...videoPreviewPropsFromSettings(settings)} />
    </div>
  );
}

function ButtonAlign({ settings, className = "", children }: { settings: LandingpageSectionSettings; className?: string; children: ReactNode }) {
  const alignment = settings.buttonAlignment ?? settings.alignment ?? "left";
  return (
    <div className={`flex ${alignment === "center" ? "justify-center" : alignment === "right" ? "justify-end" : "justify-start"} ${className}`}>
      {children}
    </div>
  );
}

function ButtonBlock({
  section,
  field,
  selected,
  text,
  globalDesign,
  activeElement,
  device,
  fallbackColor,
  onEdit,
  onOpenPopup,
  onDuplicate,
  onDelete,
  onMove,
  onInlineChange
}: {
  section: LandingpageSection;
  field: EditingField;
  selected: boolean;
  text: string | undefined;
  globalDesign: GlobalLandingpageDesign;
  activeElement?: ActiveBuilderElement | null;
  device: Device;
  fallbackColor?: string;
  onEdit: (sectionId: string, field: EditingField, kind?: BuilderElementKind) => void;
  onOpenPopup: (element: ActiveBuilderElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
  onInlineChange: (field: EditingField, value: string) => void;
}) {
  const settings = section.settings;
  const [hovered, setHovered] = useState(false);
  const element = findBuilderElementByField(section, field);
  const style = buttonInlineStyle(settings, globalDesign, device, fallbackColor, element);
  const chromeElement: ActiveBuilderElement = { sectionId: section.id, field, kind: "button", elementId: element?.id };
  const buttonText = typeof element?.props?.text === "string" && element.props.text ? element.props.text : text;
  if (hovered) {
    style.backgroundColor = settings.buttonHoverColor || style.backgroundColor;
    style.color = settings.buttonHoverTextColor || style.color;
  }
  return (
    <ElementChrome selected={selected || isSameElement(activeElement, chromeElement)} element={chromeElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}>
    <ButtonFrame selected={false} widthMode={settings.buttonWidthMode ?? "auto"}>
      <button
        type="button"
        data-hover-effect={settings.buttonHoverEffect ?? "lift"}
        onClick={(event) => { event.stopPropagation(); onEdit(section.id, field, "button"); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onEdit(section.id, field, "button");
          const editable = event.currentTarget.querySelector("[contenteditable='true']") as HTMLElement | null;
          editable?.focus();
        }}
        className={`builder-button inline-flex max-w-full items-center justify-center outline-none transition-[background-color,color,box-shadow,filter,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[#6556ff] ${buttonHoverClass((element?.props?.hoverEffect as LandingpageSectionSettings["buttonHoverEffect"]) ?? settings.buttonHoverEffect)} ${buttonAnimationClass((element?.props?.animation as LandingpageSectionSettings["buttonAnimation"]) ?? settings.buttonAnimation)}`}
        style={style}
      >
        <span
          role="textbox"
          tabIndex={0}
          contentEditable
          suppressContentEditableWarning
          onClick={(event) => { event.stopPropagation(); onEdit(section.id, field, "button"); }}
          onInput={(event) => onInlineChange(field, event.currentTarget.textContent ?? "")}
          className="min-w-0 max-w-full whitespace-normal break-words text-center outline-none [overflow-wrap:anywhere]"
        >
          {buttonText || "Button"}
        </span>
      </button>
    </ButtonFrame>
    </ElementChrome>
  );
}

function buttonHoverClass(effect: LandingpageSectionSettings["buttonHoverEffect"]) {
  if (effect === "none") return "";
  if (effect === "scale") return "hover:scale-[1.015] hover:brightness-105 hover:shadow-lg";
  if (effect === "brighten") return "hover:brightness-110";
  return "hover:-translate-y-0.5 hover:brightness-105 hover:shadow-lg";
}

function buttonAnimationClass(animation: LandingpageSectionSettings["buttonAnimation"]) {
  return `button-animation-${animation ?? "none"}`;
}

function textAnimationClass(animation: BuilderElementStyle[string] | undefined) {
  if (animation === "fade") return "animate-[builderTextFade_420ms_ease-out]";
  if (animation === "slide") return "animate-[builderTextSlide_420ms_ease-out]";
  if (animation === "scale") return "animate-[builderTextScale_260ms_ease-out]";
  if (animation === "lift") return "transition-transform hover:-translate-y-0.5";
  return "";
}

function ButtonFrame({ selected, widthMode, children }: { selected: boolean; widthMode?: LandingpageSectionSettings["buttonWidthMode"]; children: ReactNode }) {
  return (
    <span className={`builder-element-frame inline-flex max-w-full ${widthMode === "full" ? "w-full" : ""} ${selected ? "builder-element-frame-active" : ""}`}>
      {children}
    </span>
  );
}

function buttonInlineStyle(settings: LandingpageSectionSettings, globalDesign: GlobalLandingpageDesign, device: Device, fallbackColor?: string, element?: ReturnType<typeof findBuilderElementByField>): CSSProperties {
  const props = element?.props ?? {};
  const elementStyle = element?.style ?? {};
  const responsiveCss = elementStyleToCss(elementStyle, device);
  const y = Number(props.paddingY ?? settings.buttonPaddingY ?? 12);
  const x = Number(props.paddingX ?? settings.buttonPaddingX ?? 24);
  const customWidth = Number(elementStyle.width ?? props.customWidth ?? settings.buttonCustomWidth ?? 220);
  const widthMode = props.widthMode ?? settings.buttonWidthMode ?? "auto";
  const borderWidth = Number(settings.buttonBorderWidth ?? settings.borderWidth ?? 0);
  const fontSize = Number(responsiveCss.fontSize ?? props.fontSize ?? settings.buttonFontSize ?? settings.style?.desktop?.buttonFontSize ?? 14);
  const fontWeight = Number(responsiveCss.fontWeight ?? props.fontWeight ?? settings.buttonFontWeight ?? settings.fontWeight ?? 700);
  const marginTop = Number(responsiveCss.marginTop ?? settings.buttonMarginTop ?? 0);
  const marginBottom = Number(responsiveCss.marginBottom ?? settings.buttonMarginBottom ?? 0);
  const elementBackground = backgroundStyleFromSettings(elementStyle);
  return {
    ...elementBackground,
    backgroundColor: styleStringOrUndefined(currentStyleValue(elementStyle, device, "backgroundColor")) || stringProp(props.backgroundColor) || settings.buttonColor || fallbackColor || globalDesign.buttonColor,
    color: styleStringOrUndefined(currentStyleValue(elementStyle, device, "color")) || stringProp(props.textColor) || settings.buttonTextColor || "#ffffff",
    width: styleWidth(currentStyleValue(elementStyle, device, "width")) ?? (widthMode === "full" ? "100%" : widthMode === "custom" && Number.isFinite(customWidth) ? customWidth : "auto"),
    minWidth: 0,
    maxWidth: styleWidth(currentStyleValue(elementStyle, device, "maxWidth")) ?? "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: numericCss(currentStyleValue(elementStyle, device, "borderRadius") ?? props.borderRadius as BuilderElementStyle[string] ?? settings.buttonBorderRadius) ?? (settings.borderRadius && settings.borderRadius !== "0" ? settings.borderRadius : globalDesign.buttonRadius || 14),
    borderColor: settings.buttonBorderColor || settings.borderColor || "transparent",
    borderWidth: Number.isFinite(borderWidth) ? borderWidth : 0,
    borderStyle: "solid" as const,
    padding: cssLength(currentStyleValue(elementStyle, device, "padding")) ?? `${Number.isFinite(y) ? y : 12}px ${Number.isFinite(x) ? x : 24}px`,
    fontSize: Number.isFinite(fontSize) ? fontSize : 14,
    fontWeight: Number.isFinite(fontWeight) ? fontWeight : 700,
    lineHeight: responsiveCss.lineHeight ?? 1.2,
    letterSpacing: responsiveCss.letterSpacing,
    boxShadow: (props.shadow ?? settings.buttonShadow) ? "0 10px 24px rgba(15, 23, 42, 0.16)" : undefined,
    marginTop: Number.isFinite(marginTop) ? marginTop : 0,
    marginBottom: Number.isFinite(marginBottom) ? marginBottom : 0,
    textAlign: textAlignValue(currentStyleValue(elementStyle, device, "textAlign"), "center"),
    overflowWrap: "anywhere",
    whiteSpace: "normal",
    textDecoration: "none"
  };
}

function textInlineStyle(settings: LandingpageSectionSettings, elementStyle: BuilderElementStyle | undefined, device: Device): CSSProperties {
  return {
    ...elementStyleToCss(elementStyle, device, {
      textColor: settings.textColor,
      fontFamily: settings.fontFamily,
      fontWeight: settings.fontWeight,
      lineHeight: settings.lineHeight
    }),
    textAlign: styleTextAlignValue(getResponsiveElementStyle(elementStyle, device).textAlign ?? elementStyle?.textAlign) ?? settings.alignment,
    marginTop: cssLength(getResponsiveElementStyle(elementStyle, device).marginTop ?? elementStyle?.marginTop ?? settings.marginTop),
    marginBottom: cssLength(getResponsiveElementStyle(elementStyle, device).marginBottom ?? elementStyle?.marginBottom ?? settings.marginBottom)
  };
}

function elementInlineStyle(elementStyle: BuilderElementStyle | undefined): CSSProperties {
  return elementStyleToCss(elementStyle);
}

function textAlignValue(value: BuilderElementStyle[string], fallback?: LandingpageSectionSettings["alignment"]): CSSProperties["textAlign"] {
  if (value === "left" || value === "center" || value === "right") return value;
  return fallback;
}

function getResponsiveElementStyle(style: BuilderElementStyle | undefined, device: Device): Record<string, string | number | boolean | undefined> {
  return responsiveStyle(style, device);
}

function responsiveElementPatch(style: BuilderElementStyle | undefined, device: Device, key: string, value: string | number | boolean): BuilderElementStyle {
  const deviceStyle = style?.[device] && typeof style[device] === "object" ? style[device] as Record<string, string | number | boolean | undefined> : {};
  const basePatch = rootSyncedElementStyleKeys.has(key) ? { [key]: value } : {};
  return { ...basePatch, [device]: { ...deviceStyle, [key]: value } };
}

const rootSyncedElementStyleKeys = new Set([
  "fontFamily",
  "fontSize",
  "color",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "margin",
  "marginTop",
  "marginBottom",
  "padding",
  "textAlign",
  "backgroundColor",
  "maxWidth"
]);

function currentStyleValue(style: BuilderElementStyle | undefined, device: Device, key: string) {
  return getResponsiveElementStyle(style, device)[key] ?? style?.[key];
}

function numericCss(value: string | number | boolean | Record<string, unknown> | undefined) {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "boolean" || typeof value === "object") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function stringProp(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function styleStringOrUndefined(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function styleWidth(value: unknown): string | number | undefined {
  if (value === undefined || value === "" || typeof value === "boolean" || typeof value === "object") return undefined;
  if (typeof value === "number") return value;
  return typeof value === "string" ? value : undefined;
}

function CompareCard({
  section,
  activeElement,
  listName,
  title,
  tone,
  items,
  globalDesign,
  device,
  onAdd,
  onChange,
  onDeleteElement,
  onDuplicate,
  onEdit,
  onMove,
  onOpenPopup
}: {
  section: LandingpageSection;
  activeElement?: ActiveBuilderElement | null;
  listName: "leftItems" | "rightItems";
  title: string;
  tone: "good" | "bad";
  items: string[];
  globalDesign: GlobalLandingpageDesign;
  device: Device;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onDeleteElement: () => void;
  onDuplicate: () => void;
  onEdit: (sectionId: string, field: EditingField, kind?: BuilderElementKind) => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
  onOpenPopup: (element: ActiveBuilderElement) => void;
}) {
  const good = tone === "good";
  return (
    <div className="bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.09)]" style={{ borderRadius: globalDesign.cardRadius }}>
      <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item, index) => {
          const listElement: ActiveBuilderElement = { sectionId: section.id, kind: "list_item", itemList: listName, itemIndex: index };
          const builderElement = findBuilderElementForActive(section, listElement);
          const resolvedElement = { ...listElement, elementId: builderElement?.id };
          return (
          <ElementChrome key={`${item}-${index}`} selected={isSameElement(activeElement, resolvedElement)} element={resolvedElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDeleteElement} onMove={onMove}>
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${good ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{good ? "✓" : "x"}</span>
              <span
                role="textbox"
                tabIndex={0}
                contentEditable
                suppressContentEditableWarning
                style={textInlineStyle(section.settings, builderElement?.style, device)}
                className="flex-1 rounded-lg outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff]"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenPopup(resolvedElement);
                }}
                onInput={(event) => onChange(index, event.currentTarget.textContent ?? "")}
              >
                {item}
              </span>
            </li>
          </ElementChrome>
        );})}
      </ul>
      <button type="button" onClick={(event) => { event.stopPropagation(); onAdd(); }} className="mt-4 text-sm font-semibold text-[#6556ff]">Eintrag hinzufügen</button>
    </div>
  );
}

function BookingPageSection({ section, activeElement, prospect, bookingCalendars, globalDesign, device, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onPatchSettings, onInlineChange }: CanvasChildProps & { prospect?: Prospect; bookingCalendars: BookingCalendarReference[]; device: Device }) {
  const settings = section.settings;
  const booking = resolveBookingEmbed(settings, prospect, defaultBookingCalendar(bookingCalendars));
  const buttonSelected = isActiveButton(activeElement, section.id, "ctaText");
  return (
    <div className="min-h-[760px] bg-slate-50">
      {settings.bookingShowBackButton === false ? null : (
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
          <span className="text-sm font-semibold text-slate-600">← Zurück</span>
          <span className="font-bold">Tasklytic</span>
        </header>
      )}
      <section className="px-8 py-12 text-center">
        <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "Termin vereinbaren"}</EditableText>
        <EditableText section={section} activeElement={activeElement} field="subheadline" device={device} className="mx-auto mt-4 max-w-2xl break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.subheadline || "Wähle einen passenden Zeitpunkt für unser Gespräch aus."}</EditableText>
        <BookingCalendarBlock
          section={section}
          activeElement={activeElement}
          booking={booking}
          bookingCalendars={bookingCalendars}
          globalDesign={globalDesign}
          onOpenPopup={onOpenPopup}
          onPatchSettings={onPatchSettings}
        />
        {settings.ctaText ? (
          <ButtonAlign settings={settings} className="mt-7">
            <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText} globalDesign={globalDesign} activeElement={activeElement} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
          </ButtonAlign>
        ) : null}
      </section>
      <FooterPreview bodyText="Impressum  Datenschutz  Cookies" />
    </div>
  );
}

function BookingCalendarBlock({
  section,
  activeElement,
  booking,
  bookingCalendars,
  globalDesign,
  onOpenPopup,
  onPatchSettings
}: {
  section: LandingpageSection;
  activeElement?: ActiveBuilderElement | null;
  booking: ResolvedBookingEmbed;
  bookingCalendars: BookingCalendarReference[];
  globalDesign: GlobalLandingpageDesign;
  onOpenPopup: (element: ActiveBuilderElement) => void;
  onPatchSettings?: (sectionId: string, patch: Partial<LandingpageSectionSettings>) => void;
}) {
  const settings = section.settings;
  const editElement: ActiveBuilderElement = { sectionId: section.id, kind: "booking", field: "bookingUrl" };
  const designElement: ActiveBuilderElement = { sectionId: section.id, kind: "booking", field: "bookingCalendarBorderColor" };
  const selected = isSameElement(activeElement, editElement) || isSameElement(activeElement, designElement);
  return (
    <div
      data-builder-control-anchor={activeElementTreeKey(editElement)}
      className={`group relative mx-auto overflow-hidden border shadow-[0_18px_55px_rgba(15,23,42,0.12)] ${selected ? "ring-2 ring-[#6556ff]" : "ring-1 ring-transparent"}`}
      style={bookingCalendarShellStyle(settings)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenPopup(editElement);
      }}
    >
      <div className={`absolute left-4 top-4 z-10 flex gap-2 transition ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpenPopup(editElement); }} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">Bearbeiten</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpenPopup(designElement); }} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">Design</button>
      </div>
      <BookingCalendarFrame booking={booking} settings={settings} globalDesign={globalDesign} onSetup={() => onPatchSettings?.(section.id, calendarPatchFromReference(defaultBookingCalendar(bookingCalendars)))} />
    </div>
  );
}

function BookingCalendarFrame({ booking, settings, globalDesign, onSetup }: { booking: ResolvedBookingEmbed; settings: LandingpageSectionSettings; globalDesign: GlobalLandingpageDesign; onSetup?: () => void }) {
  if (booking.active && booking.embedUrl) {
    return <iframe src={booking.embedUrl} title={booking.displayName} loading="lazy" className="w-full bg-white" style={bookingCalendarIframeStyle(settings)} allow="clipboard-write; fullscreen; payment" />;
  }
  if (booking.active && booking.externalUrl) {
    return (
      <div className="grid min-h-[360px] place-items-center p-8">
        <div className="max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-bold text-slate-950">{booking.displayName}</p>
          <p className="mt-2 break-all text-xs text-slate-500">{booking.externalUrl}</p>
          <a href={booking.externalUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-bold" style={bookingCalendarButtonStyle(settings)}>Kalender extern öffnen</a>
        </div>
      </div>
    );
  }
  return <CalendarPlaceholder settings={settings} globalDesign={globalDesign} onSetup={onSetup} />;
}

function CalendarPlaceholder({ settings, globalDesign, onSetup }: { settings: LandingpageSectionSettings; globalDesign: GlobalLandingpageDesign; onSetup?: () => void }) {
  const tokens = bookingCalendarPlaceholderTokens(settings);
  return (
    <div className="grid min-h-[420px] place-items-center p-8" style={{ color: settings.bookingCalendarTextColor || undefined }}>
      <div className="w-full max-w-2xl rounded-3xl border bg-slate-50 p-6 text-left" style={{ borderColor: tokens.borderColor }}>
        <p className="mb-2 text-sm font-semibold text-slate-800">Kein Buchungskalender hinterlegt.</p>
        <p className="text-xs leading-5 text-slate-500">Wähle einen globalen Kalender, TidyCal/Cal.com oder füge eine Embed-URL ein.</p>
        <div className="mt-5 h-6 w-44 rounded-full bg-slate-200" style={{ borderRadius: tokens.inputRadius }} />
        <div className="mt-6 grid grid-cols-7 gap-2">{Array.from({ length: 35 }).map((_, index) => <div key={index} className="aspect-square rounded-xl bg-white shadow-sm" style={index === 17 ? { backgroundColor: tokens.activeDayColor, color: tokens.activeTextColor, borderRadius: tokens.inputRadius, borderWidth: tokens.inputBorderWidth } : { borderRadius: tokens.inputRadius, borderWidth: tokens.inputBorderWidth }} />)}</div>
        <button type="button" onClick={(event) => { event.stopPropagation(); onSetup?.(); }} className="mt-6 rounded-full px-5 py-3 text-sm font-bold text-white" style={settings.bookingCalendarButtonColor ? bookingCalendarButtonStyle(settings) : { backgroundColor: globalDesign.buttonColor }}>
          Kalender einrichten
        </button>
      </div>
    </div>
  );
}

function ThankYouPageSection({ section, activeElement, globalDesign, device, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange }: CanvasChildProps & { device: Device }) {
  const settings = section.settings;
  const buttonSelected = isActiveButton(activeElement, section.id, "ctaText");
  return (
    <div className="grid min-h-[760px] place-items-center bg-white px-8 text-center">
      <div className="max-w-2xl">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div>
        <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="mt-8 break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "Termin erfolgreich gebucht!"}</EditableText>
        <EditableText section={section} activeElement={activeElement} field="bodyText" device={device} className="mt-5 break-words text-slate-600" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.bodyText || "Vielen Dank für die Buchung. Die Bestätigungsmail mit allen Termindetails wird in Kürze versendet."}</EditableText>
        {settings.ctaText ? (
          <ButtonAlign settings={settings} className="mt-8">
            <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText} globalDesign={globalDesign} activeElement={activeElement} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
          </ButtonAlign>
        ) : null}
      </div>
    </div>
  );
}

function LegalPageSection({ section, activeElement, device, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange }: CanvasChildProps & { device: Device }) {
  const settings = section.settings;
  const tabs = legalTabOptions;
  return (
    <div className="min-h-[760px] bg-slate-50 px-8 py-10">
      <div className="mx-auto max-w-4xl">
        <EditableText section={section} activeElement={activeElement} field="headline" device={device} className="mb-5 break-words" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "Rechtliches"}</EditableText>
        <div className="flex flex-wrap gap-2">{tabs.map((tab) => <span key={tab.value} className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm ${settings.legalTab === tab.value ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}>{tab.label}</span>)}</div>
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-[0_18px_55px_rgba(15,23,42,0.1)]">
          {settings.legalMode === "external_link" ? (
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">Externer Link hinterlegt</h1>
              <p className="mt-3 break-all text-slate-600">{settings.legalUrl || "https://example.com/rechtliches"}</p>
              <a href={settings.legalUrl || "#"} className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">Vorschau öffnen</a>
            </div>
          ) : (
            <article className="prose max-w-none text-slate-700">
              <h1 className="text-3xl font-semibold text-slate-950">{legalTabLabel(settings.legalTab)}</h1>
              <p className="mt-4 whitespace-pre-line leading-8">{legalTextForSettings(settings) || "Rechtstext im Preview anzeigen."}</p>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

function FooterPreview({ bodyText, onEdit }: { bodyText: string; onEdit?: () => void }) {
  return (
    <footer className="border-t border-slate-100 bg-white px-8 py-7 text-center text-sm text-slate-500">
      <button type="button" onClick={(event) => { event.stopPropagation(); onEdit?.(); }}>{bodyText}</button>
      <div className="mt-3 flex justify-center gap-5">
        <a href="#">Impressum</a>
        <a href="#">Datenschutz</a>
        <a href="#">Cookies</a>
      </div>
    </footer>
  );
}

function SectionProperties({
  activeElement,
  section,
  bookingCalendars,
  aiPreview,
  device,
  onAcceptAi,
  onRejectAi,
  onElementSettingsChange,
  onElementStyleChange,
  onElementTextChange,
  onSectionChange,
  onSettingsChange
}: {
  activeElement: ActiveBuilderElement | null;
  section: LandingpageSection;
  bookingCalendars: BookingCalendarReference[];
  aiPreview: Record<string, string> | null;
  device: Device;
  onAcceptAi: () => void;
  onRejectAi: () => void;
  onElementSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void;
  onElementStyleChange: (patch: BuilderElementStyle) => void;
  onElementTextChange: (value: string) => void;
  onSectionChange: (patch: Partial<LandingpageSection>) => void;
  onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void;
}) {
  const settings = section.settings;
  const isElementEdit = Boolean(activeElement && activeElement.kind !== "section");
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Editor</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">{editorTitle(activeElement, section)}</h2>
      </div>
      {aiPreview ? (
        <div className="rounded-2xl border border-[#d8d4ff] bg-[#f4f2ff] p-4">
          <p className="text-sm font-semibold text-slate-950">AI Vorschau</p>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-600">{JSON.stringify(aiPreview, null, 2)}</pre>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onAcceptAi} className="rounded-full bg-[#6556ff] px-3 py-2 text-xs font-bold text-white">Übernehmen</button>
            <button type="button" onClick={onRejectAi} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700">Verwerfen</button>
          </div>
        </div>
      ) : null}
      {activeElement && activeElement.kind !== "section" ? (
        <ActiveElementEditor
          element={activeElement}
          section={section}
          settings={settings}
          bookingCalendars={bookingCalendars}
          device={device}
          onSettingsChange={onElementSettingsChange}
          onStyleChange={onElementStyleChange}
          onTextChange={onElementTextChange}
        />
      ) : null}
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={section.enabled} onChange={(event) => onSectionChange({ enabled: event.target.checked })} /> Aktiv</label>
      {isElementEdit ? null : (
        <>
      <ResponsiveModuleControls section={section} device={device} onSectionChange={onSectionChange} />
      <BackgroundControls title="Hintergrund" value={settings} onChange={onSettingsChange} />
      {section.type === "header" ? <HeaderFields settings={settings} onChange={onSettingsChange} /> : null}
      {section.type === "hero" ? <HeroFields settings={settings} onChange={onSettingsChange} /> : null}
      {section.type === "explainer_video" ? <ExplainerFields settings={settings} onChange={onSettingsChange} /> : null}
      {section.type === "comparison" ? <ComparisonFields settings={settings} onChange={onSettingsChange} /> : null}
      {["image", "video", "cta_button", "benefits", "divider", "spacer"].includes(section.type) ? <ElementFields settings={settings} onChange={onSettingsChange} type={section.type} /> : null}
      {section.type === "booking" || section.type === "thank_you" || section.type === "legal" ? <SpecialPageFields settings={settings} onChange={onSettingsChange} type={section.type} bookingCalendars={bookingCalendars} /> : null}
      {!["header", "hero", "explainer_video", "comparison", "booking", "thank_you", "legal", "image", "video", "cta_button", "benefits", "divider", "spacer"].includes(section.type) ? <TextFields settings={settings} onChange={onSettingsChange} /> : null}
        </>
      )}
    </div>
  );
}

function HeaderFields({ settings, onChange }: FieldGroupProps) {
  return (
    <div className="space-y-3">
      <LogoElementEditor settings={settings} onSettingsChange={onChange} />
      <Select label="Logo Position" value={settings.headerLogoPosition ?? "left"} options={["left", "center"]} onChange={(value) => onChange({ headerLogoPosition: value as LandingpageSectionSettings["headerLogoPosition"] })} />
      <Field label="Menüpunkt 1 Text" value={settings.menuItem1Text ?? ""} onChange={(value) => onChange({ menuItem1Text: value })} />
      <Field label="Menüpunkt 2 Text" value={settings.menuItem2Text ?? ""} onChange={(value) => onChange({ menuItem2Text: value })} />
      <Field label="Menüpunkt 3 Text" value={settings.menuItem3Text ?? ""} onChange={(value) => onChange({ menuItem3Text: value })} />
      <Field label="Header CTA Text" value={settings.headerCtaText ?? ""} onChange={(value) => onChange({ headerCtaText: value })} />
      <Field label="Header CTA URL" value={settings.headerCtaUrl ?? ""} onChange={(value) => onChange({ headerCtaUrl: value })} />
      <Select label="Ausrichtung" value={settings.headerAlignment ?? "left"} options={["left", "center", "right"]} onChange={(value) => onChange({ headerAlignment: value as LandingpageSectionSettings["headerAlignment"] })} />
    </div>
  );
}

function LogoElementEditor({ settings, onSettingsChange }: { settings: LandingpageSectionSettings; onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  const logo = resolveHeaderLogo(settings);
  const setLogo = (patch: Partial<LandingpageSectionSettings>) => onSettingsChange(headerLogoCompatibilityPatch(patch));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Logo</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Textlogo oder Bildlogo für den Header.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-500">{logo.type === "image" ? "Bild" : "Text"}</span>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex min-h-16 items-center justify-center rounded-lg bg-white p-3">
          {logo.type === "image" && logo.imageUrl ? (
            <img src={logo.imageUrl} alt={logo.alt} className="block max-h-14 max-w-full object-contain" style={{ width: logoCssSize(logo.width), height: logoCssSize(logo.height) }} />
          ) : (
            <span className="text-xl font-extrabold text-slate-950">{logo.text}</span>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <Select label="Logo-Typ" value={logo.type} options={["text", "image"]} onChange={(value) => setLogo({ logoType: value as LandingpageSectionSettings["logoType"] })} />
        <Field label="Logo-Text" value={logo.text} onChange={(value) => setLogo({ logoText: value || "Tasklytic" })} />
        <Field label="Logo-Bild-URL" value={logo.imageUrl} onChange={(value) => setLogo({ logoType: value ? "image" : settings.logoType, logoImageUrl: value })} />
        <AssetFilePicker label="Logo hochladen oder auswählen" type="logo" onSelect={(value) => setLogo({ logoType: "image", logoImageUrl: value })} />
        <Field label="Alt-Text" value={logo.alt} onChange={(value) => setLogo({ logoAlt: value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Breite" type="number" value={logo.width} onChange={(value) => setLogo({ logoWidth: value })} />
          <Field label="Höhe" type="number" value={logo.height} onChange={(value) => setLogo({ logoHeight: value })} />
        </div>
        {logo.imageUrl ? (
          <button type="button" onClick={() => setLogo({ logoType: "text", logoImageUrl: "" })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
            Bild entfernen
          </button>
        ) : null}
      </div>
    </div>
  );
}

type BackgroundEditable = Partial<Pick<
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

function BackgroundControls({
  title,
  value,
  onChange
}: {
  title: string;
  value: BackgroundEditable;
  onChange: (patch: BackgroundEditable) => void;
}) {
  const backgroundType = value.backgroundType ?? "default";
  const patch = (next: BackgroundEditable) => onChange(next);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Section- oder Element-Hintergrund live im Canvas anpassen.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-500">{backgroundType}</span>
      </div>
      <div className="mt-4 h-16 rounded-xl border border-slate-200" style={backgroundStyleFromSettings(value, "#f8fafc")} />
      <div className="mt-4 space-y-3">
        <Select label="Hintergrund-Typ" value={backgroundType} options={["default", "none", "color", "gradient", "image"]} onChange={(next) => patch({ backgroundType: next as LandingpageSectionSettings["backgroundType"] })} />
        {backgroundType === "color" || backgroundType === "gradient" || backgroundType === "image" ? (
          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
            <Field label="Farbe" type="color" value={value.backgroundColor || "#ffffff"} onChange={(backgroundColor) => patch({ backgroundColor, backgroundType })} />
            <Field label="Hex" value={value.backgroundColor || ""} onChange={(backgroundColor) => patch({ backgroundColor, backgroundType })} />
          </div>
        ) : null}
        {backgroundType === "gradient" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Startfarbe" type="color" value={value.gradientFrom || value.backgroundColor || "#ffffff"} onChange={(gradientFrom) => patch({ gradientFrom })} />
              <Field label="Endfarbe" type="color" value={value.gradientTo || "#dbeafe"} onChange={(gradientTo) => patch({ gradientTo })} />
            </div>
            <Select label="Richtung" value={value.gradientDirection || "top-bottom"} options={["top-bottom", "left-right", "diagonal", "radial"]} onChange={(gradientDirection) => patch({ gradientDirection: gradientDirection as LandingpageSectionSettings["gradientDirection"] })} />
          </>
        ) : null}
        {backgroundType === "image" ? (
          <>
            <Field label="Bild-URL" value={value.backgroundImageUrl || ""} onChange={(backgroundImageUrl) => patch({ backgroundImageUrl })} />
            <AssetFilePicker label="Hintergrundbild hochladen oder auswählen" type="image" onSelect={(backgroundImageUrl) => patch({ backgroundImageUrl, backgroundType: "image" })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Position" value={value.backgroundPosition || "center"} options={["center", "top", "bottom", "left", "right"]} onChange={(backgroundPosition) => patch({ backgroundPosition: backgroundPosition as LandingpageSectionSettings["backgroundPosition"] })} />
              <Select label="Größe" value={value.backgroundSize || "cover"} options={["cover", "contain", "auto"]} onChange={(backgroundSize) => patch({ backgroundSize: backgroundSize as LandingpageSectionSettings["backgroundSize"] })} />
            </div>
            <Select label="Wiederholung" value={value.backgroundRepeat || "no-repeat"} options={["no-repeat", "repeat"]} onChange={(backgroundRepeat) => patch({ backgroundRepeat: backgroundRepeat as LandingpageSectionSettings["backgroundRepeat"] })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Overlay-Farbe" type="color" value={value.overlayColor || "#000000"} onChange={(overlayColor) => patch({ overlayColor })} />
              <Field label="Overlay-Deckkraft" type="number" value={value.overlayOpacity || "0"} onChange={(overlayOpacity) => patch({ overlayOpacity })} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ResponsiveModuleControls({ section, device, onSectionChange }: { section: LandingpageSection; device: Device; onSectionChange: (patch: Partial<LandingpageSection>) => void }) {
  const responsive = section.responsive?.[device] ?? {};
  const setValue = (key: string, value: string | number | boolean) => {
    onSectionChange({ responsive: updateResponsiveStyle(section.responsive, device, key, value) });
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Responsive Modul ({device})</p>
      <div className="grid gap-3">
        <Field label="Padding oben" type="number" value={String(responsive.paddingTop ?? section.settings.paddingTop ?? "48")} onChange={(value) => setValue("paddingTop", Number(value))} />
        <Field label="Padding unten" type="number" value={String(responsive.paddingBottom ?? section.settings.paddingBottom ?? "48")} onChange={(value) => setValue("paddingBottom", Number(value))} />
        <Field label="Padding links" type="number" value={String(responsive.paddingLeft ?? section.settings.paddingLeft ?? "32")} onChange={(value) => setValue("paddingLeft", Number(value))} />
        <Field label="Padding rechts" type="number" value={String(responsive.paddingRight ?? section.settings.paddingRight ?? "32")} onChange={(value) => setValue("paddingRight", Number(value))} />
        <Field label="Margin oben" type="number" value={String(responsive.marginTop ?? section.settings.marginTop ?? "0")} onChange={(value) => setValue("marginTop", Number(value))} />
        <Field label="Margin unten" type="number" value={String(responsive.marginBottom ?? section.settings.marginBottom ?? "0")} onChange={(value) => setValue("marginBottom", Number(value))} />
        <Field label="Modulbreite" value={String(responsive.moduleWidth ?? "100%")} onChange={(value) => setValue("moduleWidth", value)} />
        <Field label="Modulhöhe" value={String(responsive.moduleHeight ?? "")} onChange={(value) => setValue("moduleHeight", value)} />
        <Field label="Abstand Elemente" type="number" value={String(responsive.gap ?? (device === "mobile" ? 20 : 40))} onChange={(value) => setValue("gap", Number(value))} />
        <Field label="Border Radius" value={String(responsive.borderRadius ?? section.settings.borderRadius ?? "0")} onChange={(value) => setValue("borderRadius", value)} />
        <Select label="Ausrichtung" value={String(responsive.alignment ?? section.settings.alignment ?? "left")} options={["left", "center", "right"]} onChange={(value) => setValue("alignment", value)} />
      </div>
    </div>
  );
}

function editorTitle(activeElement: ActiveBuilderElement | null, section: LandingpageSection) {
  if (activeElement?.kind === "button") return "Button bearbeiten";
  if (activeElement?.kind === "booking") return "Kalender bearbeiten";
  if (activeElement?.kind === "video") return "Video bearbeiten";
  if (activeElement?.kind === "logo") return "Logo bearbeiten";
  if (activeElement?.kind === "list_item") return "Element bearbeiten";
  if (activeElement?.itemList === "faqItems") return activeElement.itemKey === "answer" ? "FAQ Antwort bearbeiten" : "FAQ Frage bearbeiten";
  if (activeElement?.kind === "text") {
    if (activeElement.field === "headline" || activeElement.field === "subheadline") return "Headline bearbeiten";
    return "Text bearbeiten";
  }
  return `${sectionNames[section.type]} bearbeiten`;
}

function ActiveElementEditor({
  element,
  section,
  settings,
  bookingCalendars,
  device,
  onSettingsChange,
  onStyleChange,
  onTextChange
}: {
  element: ActiveBuilderElement;
  section: LandingpageSection;
  settings: LandingpageSectionSettings;
  bookingCalendars: BookingCalendarReference[];
  device: Device;
  onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void;
  onStyleChange: (patch: BuilderElementStyle) => void;
  onTextChange: (value: string) => void;
}) {
  const builderElement = findBuilderElementForActive(section, element);
  const fieldValue = element.itemList && element.itemIndex !== undefined
    ? itemTextValue(settings, element)
    : textValueForElement(builderElement, element.field ? settings[element.field] : "");
  const elementStyle = builderElement?.style ?? {};
  const textFallbacks = textStyleFallbacks(element);
  const elementBackgroundControls = <BackgroundControls title="Hintergrund" value={elementStyle as BackgroundEditable} onChange={(patch) => onStyleChange(patch as BuilderElementStyle)} />;
  if (element.kind === "booking") {
    return <CalendarBlockEditor settings={settings} bookingCalendars={bookingCalendars} initialTab={element.field === "bookingCalendarBorderColor" ? "design" : "edit"} onSettingsChange={onSettingsChange} />;
  }
  if (element.kind === "logo") {
    return <LogoElementEditor settings={settings} onSettingsChange={onSettingsChange} />;
  }
  if (element.kind === "button") {
    const linkValue = element.field === "headerCtaText" ? settings.headerCtaUrl ?? "" : settings.ctaUrl ?? "";
    return (
      <div className="rounded-2xl border border-[#d8d4ff] bg-[#f7f6ff] p-4">
        <p className="text-sm font-semibold text-slate-950">Button bearbeiten</p>
        <div className="mt-3 space-y-5">
          <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Inhalt</p>
      <Field label="Button Text" value={fieldValue} onChange={onTextChange} />
          <Field label="Link / URL" value={linkValue} onChange={(value) => onSettingsChange(element.field === "headerCtaText" ? { headerCtaUrl: value } : { ctaUrl: value })} />
          <Select label="Link Typ" value={settings.buttonLinkType ?? linkTypeFromTarget(settings.buttonTargetType)} options={["url", "scroll", "mail", "phone", "calendar"]} onChange={(value) => onSettingsChange(buttonLinkPatch(value as NonNullable<LandingpageSectionSettings["buttonLinkType"]>))} />
          </div>
          <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Design</p>
          <Select label="Breite" value={settings.buttonWidthMode ?? "auto"} options={["auto", "full", "custom"]} onChange={(value) => onSettingsChange({ buttonWidthMode: value as LandingpageSectionSettings["buttonWidthMode"] })} />
          <Field label="Custom Width px" type="number" value={settings.buttonCustomWidth ?? "220"} onChange={(value) => onSettingsChange({ buttonCustomWidth: value, buttonWidthMode: "custom" })} />
          <Field label="Padding X" type="number" value={settings.buttonPaddingX ?? "22"} onChange={(value) => onSettingsChange({ buttonPaddingX: value })} />
          <Field label="Padding Y" type="number" value={settings.buttonPaddingY ?? "14"} onChange={(value) => onSettingsChange({ buttonPaddingY: value })} />
          <Field label="Hintergrundfarbe" type="color" value={settings.buttonColor ?? "#101828"} onChange={(value) => onSettingsChange({ buttonColor: value })} />
          <Field label="Textfarbe" type="color" value={settings.buttonTextColor ?? "#ffffff"} onChange={(value) => onSettingsChange({ buttonTextColor: value })} />
          <Field label="Hover Hintergrund" type="color" value={settings.buttonHoverColor ?? "#111827"} onChange={(value) => onSettingsChange({ buttonHoverColor: value })} />
          <Field label="Hover Textfarbe" type="color" value={settings.buttonHoverTextColor ?? "#ffffff"} onChange={(value) => onSettingsChange({ buttonHoverTextColor: value })} />
          <Select label="Hover Effekt" value={settings.buttonHoverEffect ?? "lift"} options={["none", "brighten", "lift", "scale"]} onChange={(value) => onSettingsChange({ buttonHoverEffect: value as LandingpageSectionSettings["buttonHoverEffect"] })} />
          <Select label="Animation" value={settings.buttonAnimation ?? "none"} options={["none", "lift", "pulse", "glow", "slide", "scale", "bounce"]} onChange={(value) => onSettingsChange({ buttonAnimation: value as LandingpageSectionSettings["buttonAnimation"] })} />
          <Field label="Border Radius" value={settings.buttonBorderRadius ?? "14"} onChange={(value) => onSettingsChange({ buttonBorderRadius: value })} />
          <Field label="Border Farbe" type="color" value={settings.buttonBorderColor ?? settings.borderColor ?? "#e2e8f0"} onChange={(value) => onSettingsChange({ buttonBorderColor: value })} />
          <Field label="Border Breite" type="number" value={settings.buttonBorderWidth ?? settings.borderWidth ?? "0"} onChange={(value) => onSettingsChange({ buttonBorderWidth: value })} />
          <Field label="Schriftgröße" type="number" value={settings.buttonFontSize ?? String(settings.style?.desktop?.buttonFontSize ?? "14")} onChange={(value) => onSettingsChange({ buttonFontSize: value, style: { ...settings.style, desktop: { ...(settings.style?.desktop ?? {}), buttonFontSize: Number(value) } } })} />
          <Field label="Font Weight" type="number" value={settings.buttonFontWeight ?? settings.fontWeight ?? "700"} onChange={(value) => onSettingsChange({ buttonFontWeight: value })} />
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.buttonShadow === true} onChange={(event) => onSettingsChange({ buttonShadow: event.target.checked })} /> Schatten</label>
          <button type="button" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 ${buttonAnimationClass(settings.buttonAnimation)}`}>
            <Sparkles className="h-4 w-4" /> Animation testen
          </button>
          </div>
          <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Position</p>
          <Select label="Ausrichtung" value={settings.buttonAlignment ?? settings.alignment ?? "left"} options={["left", "center", "right"]} onChange={(value) => onSettingsChange({ buttonAlignment: value as LandingpageSectionSettings["buttonAlignment"], alignment: value as LandingpageSectionSettings["alignment"] })} />
          <Field label="Margin oben" type="number" value={settings.buttonMarginTop ?? "0"} onChange={(value) => onSettingsChange({ buttonMarginTop: value })} />
          <Field label="Margin unten" type="number" value={settings.buttonMarginBottom ?? "0"} onChange={(value) => onSettingsChange({ buttonMarginBottom: value })} />
          </div>
          {elementBackgroundControls}
        </div>
      </div>
    );
  }
  if (element.kind === "video") {
    return (
      <div className="rounded-2xl border border-[#d8d4ff] bg-[#f7f6ff] p-4">
        <p className="text-sm font-semibold text-slate-950">Video bearbeiten</p>
        <div className="mt-3 space-y-3">
          <VideoAssetPicker label="Video auswählen oder hochladen" selectedUrl={settings.videoUrl} onSelect={(asset) => onSettingsChange(videoAssetPatch(asset))} onRemove={() => onSettingsChange({ videoAssetId: "", videoUrl: "", videoMobileUrl: "", videoWebmUrl: "", thumbnailUrl: "" })} />
          <Field label="Video URL" value={settings.videoUrl ?? ""} onChange={(value) => onSettingsChange({ videoUrl: value })} />
          <Field label="Poster" value={settings.thumbnailUrl ?? ""} onChange={(value) => onSettingsChange({ thumbnailUrl: value })} />
          <AssetFilePicker label="Poster aus Mediathek wählen" type="image" onSelect={(value) => onSettingsChange({ thumbnailUrl: value })} />
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.controls !== false} onChange={(event) => onSettingsChange({ controls: event.target.checked })} /> Controls</label>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.autoplay === true} onChange={(event) => onSettingsChange({ autoplay: event.target.checked, muted: event.target.checked ? true : settings.muted })} /> Autoplay</label>
          <VideoDesignControls settings={settings} onChange={onSettingsChange} />
          {elementBackgroundControls}
          <a href={settings.videoUrl || "#"} target="_blank" className="inline-flex rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700">Vorschau öffnen</a>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[#d8d4ff] bg-[#f7f6ff] p-4">
      <p className="text-sm font-semibold text-slate-950">{editorTitle(element, section)}</p>
      <div className="mt-3 space-y-3">
        <Textarea label="Text" value={fieldValue} onChange={onTextChange} />
        {element.field === "headline" ? (
          <>
            <Textarea label="Text Du" value={settings.headlineDu ?? ""} onChange={(value) => onSettingsChange({ headlineDu: value })} />
            <Textarea label="Text Sie" value={settings.headlineSie ?? ""} onChange={(value) => onSettingsChange({ headlineSie: value })} />
          </>
        ) : null}
        {element.field === "bodyText" ? (
          <>
            <Textarea label="Text Du" value={settings.bodyTextDu ?? settings.textDu ?? ""} onChange={(value) => onSettingsChange({ bodyTextDu: value, textDu: value })} />
            <Textarea label="Text Sie" value={settings.bodyTextSie ?? settings.textSie ?? ""} onChange={(value) => onSettingsChange({ bodyTextSie: value, textSie: value })} />
          </>
        ) : null}
        <TextStyleControls
          style={elementStyle}
          settings={settings}
          device={device}
          fallbacks={textFallbacks}
          onStyleChange={onStyleChange}
        />
        <Select label="Animation" value={styleString(elementStyle.animation, "none")} options={["none", "fade", "slide", "scale", "lift"]} onChange={(value) => onStyleChange({ animation: value })} />
        {elementBackgroundControls}
      </div>
    </div>
  );
}

type TextStyleFallbacks = {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  marginBottom: number;
  textColor: string;
};

function textStyleFallbacks(element: ActiveBuilderElement): TextStyleFallbacks {
  const isHeadline = element.field === "headline";
  const isQuestion = element.itemList === "faqItems" && element.itemKey === "question";
  const isAnswer = element.itemList === "faqItems" && element.itemKey === "answer";
  return {
    fontSize: isHeadline ? 48 : isQuestion ? 20 : isAnswer ? 15 : 22,
    fontWeight: isHeadline || isQuestion ? 700 : 400,
    lineHeight: isHeadline ? 1.1 : isQuestion ? 1.3 : 1.5,
    marginBottom: isHeadline ? 24 : isQuestion ? 8 : 0,
    textColor: isAnswer ? "#475569" : "#111827"
  };
}

function TextStyleControls({
  style,
  settings,
  device,
  fallbacks,
  onStyleChange
}: {
  style: BuilderElementStyle;
  settings: LandingpageSectionSettings;
  device: Device;
  fallbacks: TextStyleFallbacks;
  onStyleChange: (patch: BuilderElementStyle) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
      <StyleControlGroup title={`Typografie (${device})`}>
        <TypographyControls style={style} settings={settings} device={device} fallbacks={fallbacks} onStyleChange={onStyleChange} />
      </StyleControlGroup>
      <StyleControlGroup title="Farbe und Ausrichtung">
        <ColorAndAlignmentControls style={style} settings={settings} device={device} fallbacks={fallbacks} onStyleChange={onStyleChange} />
      </StyleControlGroup>
      <StyleControlGroup title="Abstände">
        <SpacingControls style={style} device={device} fallbacks={fallbacks} onStyleChange={onStyleChange} />
      </StyleControlGroup>
    </div>
  );
}

function TypographyControls({
  style,
  settings,
  device,
  fallbacks,
  onStyleChange
}: {
  style: BuilderElementStyle;
  settings: LandingpageSectionSettings;
  device: Device;
  fallbacks: TextStyleFallbacks;
  onStyleChange: (patch: BuilderElementStyle) => void;
}) {
  const patch = (key: string, value: string | number | boolean) => onStyleChange(responsiveElementPatch(style, device, key, value));
  return (
    <div className="grid gap-3">
      <Field label="Schriftart" value={styleString(currentStyleValue(style, device, "fontFamily"), settings.fontFamily ?? "Inter")} onChange={(value) => patch("fontFamily", value)} />
      <SliderField label="Schriftgröße" min={10} max={96} step={1} unit="px" value={styleNumber(currentStyleValue(style, device, "fontSize"), fallbacks.fontSize)} onChange={(value) => patch("fontSize", value)} />
      <Select label="Font Weight" value={String(styleNumber(currentStyleValue(style, device, "fontWeight"), fallbacks.fontWeight))} options={["300", "400", "500", "600", "700", "800", "900"]} onChange={(value) => patch("fontWeight", Number(value))} />
      <SliderField label="Zeilenhöhe" min={0.9} max={2.4} step={0.05} value={styleNumber(currentStyleValue(style, device, "lineHeight"), fallbacks.lineHeight)} onChange={(value) => patch("lineHeight", value)} />
      <SliderField label="Letter Spacing" min={-1} max={8} step={0.1} unit="px" value={styleNumber(currentStyleValue(style, device, "letterSpacing"), 0)} onChange={(value) => patch("letterSpacing", value)} />
    </div>
  );
}

function ColorAndAlignmentControls({
  style,
  settings,
  device,
  fallbacks,
  onStyleChange
}: {
  style: BuilderElementStyle;
  settings: LandingpageSectionSettings;
  device: Device;
  fallbacks: TextStyleFallbacks;
  onStyleChange: (patch: BuilderElementStyle) => void;
}) {
  const patch = (key: string, value: string | number | boolean) => onStyleChange(responsiveElementPatch(style, device, key, value));
  return (
    <div className="grid gap-3">
      <ColorField label="Schriftfarbe" value={styleString(currentStyleValue(style, device, "color"), settings.textColor ?? fallbacks.textColor)} onChange={(value) => patch("color", value)} />
      <ColorField label="Hintergrundfarbe" value={styleString(currentStyleValue(style, device, "backgroundColor"), "#ffffff")} onChange={(value) => patch("backgroundColor", value)} />
      <Select label="Ausrichtung" value={styleString(currentStyleValue(style, device, "textAlign"), settings.alignment ?? "left")} options={["left", "center", "right"]} onChange={(value) => patch("textAlign", value)} />
    </div>
  );
}

function SpacingControls({
  style,
  device,
  fallbacks,
  onStyleChange
}: {
  style: BuilderElementStyle;
  device: Device;
  fallbacks: TextStyleFallbacks;
  onStyleChange: (patch: BuilderElementStyle) => void;
}) {
  const patch = (key: string, value: string | number | boolean) => onStyleChange(responsiveElementPatch(style, device, key, value));
  return (
    <div className="grid gap-3">
      <SliderField label="Margin" min={0} max={96} step={1} unit="px" value={styleNumber(currentStyleValue(style, device, "margin"), 0)} onChange={(value) => patch("margin", value)} />
      <SliderField label="Margin oben" min={0} max={96} step={1} unit="px" value={styleNumber(currentStyleValue(style, device, "marginTop"), 0)} onChange={(value) => patch("marginTop", value)} />
      <SliderField label="Margin unten" min={0} max={96} step={1} unit="px" value={styleNumber(currentStyleValue(style, device, "marginBottom"), fallbacks.marginBottom)} onChange={(value) => patch("marginBottom", value)} />
      <SliderField label="Padding" min={0} max={80} step={1} unit="px" value={styleNumber(currentStyleValue(style, device, "padding"), 0)} onChange={(value) => patch("padding", value)} />
      <Field label="Max Width" value={styleString(currentStyleValue(style, device, "maxWidth"), "")} onChange={(value) => patch("maxWidth", value)} />
    </div>
  );
}

function StyleControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function HeroFields({ settings, onChange }: FieldGroupProps) {
  return (
    <div className="space-y-3">
      <Textarea label="heroHeadline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
      <Textarea label="heroBodyText" value={settings.bodyText ?? ""} onChange={(value) => onChange({ bodyText: value })} />
      <Field label="heroCtaText" value={settings.ctaText ?? ""} onChange={(value) => onChange({ ctaText: value })} />
      <Field label="heroCtaUrl" value={settings.ctaUrl ?? ""} onChange={(value) => onChange({ ctaUrl: value })} />
      <Field label="personalVideoUrl" value={settings.videoUrl ?? ""} onChange={(value) => onChange({ videoUrl: value })} />
      <VideoAssetPicker label="Video auswählen oder hochladen" selectedUrl={settings.videoUrl} onSelect={(asset) => onChange(videoAssetPatch(asset))} onRemove={() => onChange({ videoAssetId: "", videoUrl: "", videoMobileUrl: "", videoWebmUrl: "", thumbnailUrl: "" })} />
      <Field label="personalVideoThumbnailUrl" value={settings.thumbnailUrl ?? ""} onChange={(value) => onChange({ thumbnailUrl: value })} />
      <AssetFilePicker label="Thumbnail aus Asset Library" type="image" onSelect={(value) => onChange({ thumbnailUrl: value })} />
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.autoplay === true} onChange={(event) => onChange({ autoplay: event.target.checked })} /> Autoplay</label>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.controls !== false} onChange={(event) => onChange({ controls: event.target.checked })} /> Controls</label>
      <VideoDesignControls settings={settings} onChange={onChange} />
      <Field label="personalVideoLabel" value={settings.videoLabel ?? ""} onChange={(value) => onChange({ videoLabel: value })} />
      <Select label="Video Position" value={settings.videoPosition ?? "right"} options={["right", "left"]} onChange={(value) => onChange({ videoPosition: value as LandingpageSectionSettings["videoPosition"] })} />
    </div>
  );
}

function ExplainerFields({ settings, onChange }: FieldGroupProps) {
  return (
    <div className="space-y-3">
      <Textarea label="explainerHeadline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
      <Field label="explainerSubline" value={settings.subheadline ?? ""} onChange={(value) => onChange({ subheadline: value })} />
      <Field label="explainerVideoUrl" value={settings.videoUrl ?? ""} onChange={(value) => onChange({ videoUrl: value })} />
      <VideoAssetPicker label="Video auswählen oder hochladen" selectedUrl={settings.videoUrl} onSelect={(asset) => onChange(videoAssetPatch(asset))} onRemove={() => onChange({ videoAssetId: "", videoUrl: "", videoMobileUrl: "", videoWebmUrl: "", thumbnailUrl: "" })} />
      <Field label="explainerVideoThumbnailUrl" value={settings.thumbnailUrl ?? ""} onChange={(value) => onChange({ thumbnailUrl: value })} />
      <AssetFilePicker label="Thumbnail aus Asset Library" type="image" onSelect={(value) => onChange({ thumbnailUrl: value })} />
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.autoplay === true} onChange={(event) => onChange({ autoplay: event.target.checked })} /> Autoplay</label>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.controls !== false} onChange={(event) => onChange({ controls: event.target.checked })} /> Controls</label>
      <VideoDesignControls settings={settings} onChange={onChange} />
      <Field label="explainerVideoButtonText" value={settings.buttonText ?? ""} onChange={(value) => onChange({ buttonText: value })} />
      <Field label="explainerCtaText" value={settings.ctaText ?? ""} onChange={(value) => onChange({ ctaText: value })} />
      <Field label="explainerCtaUrl" value={settings.ctaUrl ?? ""} onChange={(value) => onChange({ ctaUrl: value })} />
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.showArrowEmoji !== false} onChange={(event) => onChange({ showArrowEmoji: event.target.checked })} /> Pfeil/Emoji anzeigen</label>
      <Select label="Layout" value={settings.layout ?? "centered"} options={["centered", "two_column", "full_width"]} onChange={(value) => onChange({ layout: value as LandingpageSectionSettings["layout"] })} />
    </div>
  );
}

function ComparisonFields({ settings, onChange }: FieldGroupProps) {
  return (
    <div className="space-y-3">
      <Textarea label="headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
      <Textarea label="subheadline" value={settings.subheadline ?? ""} onChange={(value) => onChange({ subheadline: value })} />
      <Field label="leftTitle" value={settings.leftTitle ?? ""} onChange={(value) => onChange({ leftTitle: value })} />
      <Field label="rightTitle" value={settings.rightTitle ?? ""} onChange={(value) => onChange({ rightTitle: value })} />
      <Textarea label="leftItems" value={(settings.leftItems ?? settings.beforeItems ?? []).join("\n")} onChange={(value) => onChange({ leftItems: lines(value), beforeItems: lines(value) })} />
      <Textarea label="rightItems" value={(settings.rightItems ?? settings.afterItems ?? []).join("\n")} onChange={(value) => onChange({ rightItems: lines(value), afterItems: lines(value) })} />
      <Select label="iconStyle" value={settings.iconStyle ?? "x_check"} options={["x_check"]} onChange={(value) => onChange({ iconStyle: value as LandingpageSectionSettings["iconStyle"] })} />
      <Select label="layout" value={settings.layout ?? "two_cards"} options={["two_cards"]} onChange={(value) => onChange({ layout: value as LandingpageSectionSettings["layout"] })} />
    </div>
  );
}

function SpecialPageFields({ settings, onChange, type, bookingCalendars = [] }: FieldGroupProps & { type: LandingpageSectionType; bookingCalendars?: BookingCalendarReference[] }) {
  if (type === "legal") {
    return (
      <div className="space-y-3">
        <Select label="Untertab" value={settings.legalTab ?? "impressum"} options={legalTabOptions.map((tab) => tab.value)} onChange={(value) => onChange({ legalTab: value as LandingpageSectionSettings["legalTab"] })} />
        <Select label="Modus" value={settings.legalMode ?? "text"} options={["text", "external_link"]} onChange={(value) => onChange({ legalMode: value as LandingpageSectionSettings["legalMode"] })} />
        <Field label="URL" value={settings.legalUrl ?? ""} onChange={(value) => onChange({ legalUrl: value })} />
        <Textarea label="Impressum" value={settings.legalImprintText ?? ""} onChange={(value) => onChange({ legalImprintText: value })} />
        <Textarea label="Datenschutz" value={settings.legalPrivacyText ?? ""} onChange={(value) => onChange({ legalPrivacyText: value })} />
        <Textarea label="Datenverarbeitung" value={settings.legalProcessingText ?? ""} onChange={(value) => onChange({ legalProcessingText: value })} />
        <Textarea label="AGB" value={settings.legalTermsText ?? ""} onChange={(value) => onChange({ legalTermsText: value })} />
        <Textarea label="Disclaimer" value={settings.legalDisclaimerText ?? ""} onChange={(value) => onChange({ legalDisclaimerText: value })} />
        <Textarea label="Cookies / zusätzlicher Rechtstext" value={settings.legalText ?? ""} onChange={(value) => onChange({ legalText: value })} />
      </div>
    );
  }
  if (type === "booking") {
    return (
      <div className="space-y-4">
        <Textarea label="Headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
        <Textarea label="Subheadline" value={settings.subheadline ?? ""} onChange={(value) => onChange({ subheadline: value })} />
        <CalendarBlockEditor settings={settings} bookingCalendars={bookingCalendars} onSettingsChange={onChange} />
        <Field label="CTA Text" value={settings.ctaText ?? ""} onChange={(value) => onChange({ ctaText: value })} />
        <Field label="CTA URL nach Kalender" value={settings.ctaUrl ?? ""} onChange={(value) => onChange({ ctaUrl: value })} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Textarea label="Headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
      <Textarea label="Text" value={settings.bodyText ?? ""} onChange={(value) => onChange({ bodyText: value })} />
      <Field label="CTA Text" value={settings.ctaText ?? ""} onChange={(value) => onChange({ ctaText: value })} />
      <Field label="CTA URL" value={settings.ctaUrl ?? ""} onChange={(value) => onChange({ ctaUrl: value })} />
    </div>
  );
}

function CalendarBlockEditor({
  settings,
  bookingCalendars,
  initialTab = "edit",
  onSettingsChange
}: {
  settings: LandingpageSectionSettings;
  bookingCalendars: BookingCalendarReference[];
  initialTab?: "edit" | "design";
  onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void;
}) {
  const [tab, setTab] = useState<"edit" | "design">(initialTab);
  const booking = resolveBookingEmbed(settings, previewLead, defaultBookingCalendar(bookingCalendars));
  return (
    <div className="rounded-2xl border border-[#d8d4ff] bg-[#f7f6ff] p-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/70 p-1 text-xs font-semibold">
        <button type="button" onClick={() => setTab("edit")} className={`rounded-lg px-2 py-2 ${tab === "edit" ? "bg-slate-950 text-white shadow-sm" : "text-slate-500"}`}>Bearbeiten</button>
        <button type="button" onClick={() => setTab("design")} className={`rounded-lg px-2 py-2 ${tab === "design" ? "bg-slate-950 text-white shadow-sm" : "text-slate-500"}`}>Design</button>
      </div>
      <div className="mt-4 space-y-4">
        {tab === "edit" ? <CalendarSourceControls settings={settings} booking={booking} bookingCalendars={bookingCalendars} onSettingsChange={onSettingsChange} /> : null}
        {tab === "design" ? <CalendarDesignControls settings={settings} onSettingsChange={onSettingsChange} /> : null}
      </div>
    </div>
  );
}

function CalendarSourceControls({ settings, booking, bookingCalendars, onSettingsChange }: { settings: LandingpageSectionSettings; booking: ResolvedBookingEmbed; bookingCalendars: BookingCalendarReference[]; onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  const source = settings.bookingSource ?? "global_default";
  return (
    <div className="space-y-4">
      <Select label="CTA-Ziel auf Landingpage" value={settings.bookingMode ?? "embedded_page"} options={["embedded_page", "embedded_scroll", "external_link"]} onChange={(value) => onSettingsChange({ bookingMode: value as LandingpageSectionSettings["bookingMode"] })} />
      <Select label="Kalender-Quelle" value={source} options={["global_default", "tidycal", "cal_com", "custom_embed", "external_url"]} onChange={(value) => onSettingsChange(calendarSourcePatch(value as NonNullable<LandingpageSectionSettings["bookingSource"]>))} />
      <BookingCalendarPicker settings={settings} calendars={bookingCalendars} onChange={onSettingsChange} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Anbieter" value={settings.bookingProvider ?? "custom"} options={["tidycal", "cal_com", "calendly", "microsoft_bookings", "custom"]} onChange={(value) => onSettingsChange({ bookingProvider: value as LandingpageSectionSettings["bookingProvider"] })} />
        <Field label="Zeitzone" value={settings.bookingTimezone ?? "Europe/Berlin"} onChange={(value) => onSettingsChange({ bookingTimezone: value })} />
      </div>
      <Field label="Kalendername" value={settings.bookingCalendarName ?? ""} onChange={(value) => onSettingsChange({ bookingCalendarName: value })} />
      <Field label="Kalender-URL / externer Link" value={settings.bookingUrl ?? ""} onChange={(value) => onSettingsChange({ bookingUrl: value })} />
      <Field label="Embed-URL" value={settings.bookingEmbedUrl ?? ""} onChange={(value) => onSettingsChange({ bookingEmbedUrl: value })} />
      <Textarea label="Custom iframe Embed-Code" value={settings.bookingEmbedCode ?? ""} onChange={(value) => onSettingsChange({ bookingEmbedCode: value, bookingSource: "custom_embed" })} />
      <Field label="Button-Text" value={settings.bookingButtonText ?? ""} onChange={(value) => onSettingsChange({ bookingButtonText: value })} />
      <Field label="Danke-URL / Thank-you Route" value={settings.bookingThankYouUrl ?? ""} onChange={(value) => onSettingsChange({ bookingThankYouUrl: value })} />
      <div className="grid gap-2">
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
          <input className="h-4 w-4" type="checkbox" checked={settings.bookingCalendarActive !== false} onChange={(event) => onSettingsChange({ bookingCalendarActive: event.target.checked })} />
          Kalender aktiv
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
          <input className="h-4 w-4" type="checkbox" checked={settings.bookingShowBackButton !== false} onChange={(event) => onSettingsChange({ bookingShowBackButton: event.target.checked })} />
          Zurück-Button anzeigen
        </label>
      </div>
      <CalendarMiniPreview booking={booking} />
    </div>
  );
}

function CalendarDesignControls({ settings, onSettingsChange }: { settings: LandingpageSectionSettings; onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  const tokens = bookingCalendarPlaceholderTokens(settings);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField label="Rahmenfarbe" value={settings.bookingCalendarBorderColor ?? "#E5E7EB"} onChange={(value) => onSettingsChange({ bookingCalendarBorderColor: value })} />
        <ColorField label="Hintergrundfarbe" value={settings.bookingCalendarBackgroundColor ?? "#FFFFFF"} onChange={(value) => onSettingsChange({ bookingCalendarBackgroundColor: value })} />
        <ColorField label="Textfarbe" value={settings.bookingCalendarTextColor ?? "#111827"} onChange={(value) => onSettingsChange({ bookingCalendarTextColor: value })} />
        <ColorField label="Aktiver Tag" value={settings.bookingCalendarActiveDayColor ?? "#2563EB"} onChange={(value) => onSettingsChange({ bookingCalendarActiveDayColor: value })} />
        <ColorField label="Aktiver Text" value={settings.bookingCalendarActiveTextColor ?? "#FFFFFF"} onChange={(value) => onSettingsChange({ bookingCalendarActiveTextColor: value })} />
        <ColorField label="Buttonfarbe" value={settings.bookingCalendarButtonColor ?? "#0F172A"} onChange={(value) => onSettingsChange({ bookingCalendarButtonColor: value })} />
        <ColorField label="Button-Textfarbe" value={settings.bookingCalendarButtonTextColor ?? "#FFFFFF"} onChange={(value) => onSettingsChange({ bookingCalendarButtonTextColor: value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Border Radius" type="number" value={settings.bookingCalendarBorderRadius ?? "24"} onChange={(value) => onSettingsChange({ bookingCalendarBorderRadius: value })} />
        <Field label="Feld-Radius" type="number" value={settings.bookingCalendarInputRadius ?? "12"} onChange={(value) => onSettingsChange({ bookingCalendarInputRadius: value })} />
        <Field label="Feld-Border Breite" type="number" value={settings.bookingCalendarInputBorderWidth ?? "1"} onChange={(value) => onSettingsChange({ bookingCalendarInputBorderWidth: value })} />
        <Field label="Kalenderbreite" type="number" value={settings.bookingCalendarWidth ?? "960"} onChange={(value) => onSettingsChange({ bookingCalendarWidth: value })} />
        <Field label="Kalenderhöhe" type="number" value={settings.bookingCalendarHeight ?? "640"} onChange={(value) => onSettingsChange({ bookingCalendarHeight: value })} />
        <Field label="Abstand oben" type="number" value={settings.bookingCalendarSpacingTop ?? "32"} onChange={(value) => onSettingsChange({ bookingCalendarSpacingTop: value })} />
        <Field label="Abstand unten" type="number" value={settings.bookingCalendarSpacingBottom ?? "24"} onChange={(value) => onSettingsChange({ bookingCalendarSpacingBottom: value })} />
      </div>
      <div className="rounded-2xl border bg-white p-4" style={bookingCalendarShellStyle(settings)}>
        <div className="grid grid-cols-7 gap-2">{Array.from({ length: 14 }).map((_, index) => <div key={index} className="aspect-square rounded-xl border bg-slate-50" style={index === 8 ? { backgroundColor: tokens.activeDayColor, color: tokens.activeTextColor, borderRadius: tokens.inputRadius } : { borderRadius: tokens.inputRadius, borderColor: tokens.borderColor }} />)}</div>
        <button type="button" className="mt-4 rounded-xl px-4 py-2 text-xs font-bold" style={bookingCalendarButtonStyle(settings)}>Termin auswählen</button>
      </div>
    </div>
  );
}

function CalendarMiniPreview({ booking }: { booking: ResolvedBookingEmbed }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Test / Vorschau</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{booking.displayName}</p>
      <p className="mt-1 break-all text-xs text-slate-500">{booking.embedUrl || booking.externalUrl || "Kein Buchungskalender hinterlegt."}</p>
      {booking.externalUrl ? <a href={booking.externalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Test-Link öffnen</a> : null}
    </div>
  );
}

function BookingCalendarPicker({ settings, calendars, onChange }: { settings: LandingpageSectionSettings; calendars: BookingCalendarReference[]; onChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  if (calendars.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        Noch kein zentraler Buchungskalender hinterlegt. Du kannst unten eine Kalender-URL oder einen Embed-Code eintragen.
      </div>
    );
  }
  return (
    <label className="block min-w-0 space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Zentralen Kalender übernehmen</span>
      <select
        className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#6556ff]"
        value={settings.bookingCalendarId ?? ""}
        onChange={(event) => {
          const calendar = calendars.find((item) => item.id === event.target.value);
          if (!calendar) return;
          onChange(calendarPatchFromReference(calendar));
        }}
      >
        <option value="">Kalender auswählen...</option>
        {calendars.map((calendar) => (
          <option key={calendar.id ?? calendar.bookingUrl ?? calendar.displayName ?? "calendar"} value={calendar.id ?? ""}>
            {calendar.displayName ?? calendar.bookingUrl ?? "Buchungskalender"}{calendar.isDefault ? " (Standard)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function calendarSourcePatch(source: NonNullable<LandingpageSectionSettings["bookingSource"]>): Partial<LandingpageSectionSettings> {
  if (source === "tidycal") return { bookingSource: source, bookingProvider: "tidycal", bookingMode: "embedded_page" };
  if (source === "cal_com") return { bookingSource: source, bookingProvider: "cal_com", bookingMode: "embedded_page" };
  if (source === "external_url") return { bookingSource: source, bookingProvider: "custom", bookingMode: "external_link" };
  if (source === "custom_embed") return { bookingSource: source, bookingProvider: "custom", bookingMode: "embedded_page" };
  return { bookingSource: "global_default", bookingMode: "embedded_page" };
}

function calendarPatchFromReference(calendar: BookingCalendarReference | null): Partial<LandingpageSectionSettings> {
  if (!calendar) return { bookingSource: "global_default", bookingCalendarActive: true };
  const provider = (calendar.provider ?? "custom") as LandingpageSectionSettings["bookingProvider"];
  return {
    bookingSource: bookingSourceFromProvider(provider),
    bookingCalendarId: calendar.id ?? "",
    bookingProvider: provider,
    bookingCalendarName: calendar.displayName ?? "",
    bookingUrl: calendar.bookingUrl ?? "",
    bookingEmbedUrl: calendar.bookingUrl ?? "",
    bookingCalendarActive: calendar.isActive !== false
  };
}

function bookingSourceFromProvider(provider: LandingpageSectionSettings["bookingProvider"]): LandingpageSectionSettings["bookingSource"] {
  if (provider === "tidycal") return "tidycal";
  if (provider === "cal_com") return "cal_com";
  return "custom_embed";
}

function VideoDesignControls({ settings, onChange }: FieldGroupProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Design</p>
      <Select label="Breite" value={settings.videoWidthMode ?? "full"} options={["full", "auto", "custom"]} onChange={(value) => onChange({ videoWidthMode: value as LandingpageSectionSettings["videoWidthMode"] })} />
      <div className="mt-3 grid gap-3">
        <Field label="Custom Breite px" value={settings.videoCustomWidth ?? "520px"} onChange={(value) => onChange({ videoCustomWidth: value })} />
        <Field label="Max Width px" value={settings.videoMaxWidth ?? "520px"} onChange={(value) => onChange({ videoMaxWidth: value })} />
        <Select label="Höhe" value={settings.videoHeightMode ?? "auto"} options={["auto", "custom"]} onChange={(value) => onChange({ videoHeightMode: value as LandingpageSectionSettings["videoHeightMode"] })} />
        <Field label="Custom Höhe px" value={settings.videoCustomHeight ?? ""} onChange={(value) => onChange({ videoCustomHeight: value, videoHeightMode: value ? "custom" : "auto" })} />
        <Select label="Aspect Ratio" value={settings.videoAspectRatio ?? "16 / 9"} options={["16 / 9", "4 / 5", "1 / 1", "9 / 16"]} onChange={(value) => onChange({ videoAspectRatio: value as LandingpageSectionSettings["videoAspectRatio"] })} />
        <Select label="Object Fit" value={settings.videoObjectFit ?? "cover"} options={["cover", "contain"]} onChange={(value) => onChange({ videoObjectFit: value as LandingpageSectionSettings["videoObjectFit"] })} />
        <Select label="Preload" value={settings.videoPreload ?? "none"} options={["none", "metadata", "auto"]} onChange={(value) => onChange({ videoPreload: value as LandingpageSectionSettings["videoPreload"] })} />
        <Field label="Border Radius" type="number" value={settings.videoBorderRadius ?? "24"} onChange={(value) => onChange({ videoBorderRadius: value })} />
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.videoShadow !== false} onChange={(event) => onChange({ videoShadow: event.target.checked })} /> Schatten</label>
        <Field label="Hintergrundfarbe" type="color" value={settings.videoBackgroundColor && settings.videoBackgroundColor !== "transparent" ? settings.videoBackgroundColor : "#ffffff"} onChange={(value) => onChange({ videoBackgroundColor: value })} />
        <Field label="Padding" type="number" value={settings.videoPadding ?? "0"} onChange={(value) => onChange({ videoPadding: value })} />
        <Select label="Ausrichtung" value={settings.videoAlign ?? "center"} options={["left", "center", "right"]} onChange={(value) => onChange({ videoAlign: value as LandingpageSectionSettings["videoAlign"] })} />
      </div>
    </div>
  );
}

function TextFields({ settings, onChange }: FieldGroupProps) {
  return (
    <div className="space-y-3">
      <Textarea label="Headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
      <Textarea label="Body Text" value={settings.bodyText ?? ""} onChange={(value) => onChange({ bodyText: value })} />
      <Field label="CTA Text" value={settings.ctaText ?? ""} onChange={(value) => onChange({ ctaText: value })} />
      <Field label="CTA URL" value={settings.ctaUrl ?? ""} onChange={(value) => onChange({ ctaUrl: value })} />
    </div>
  );
}

function ElementFields({ settings, onChange, type }: FieldGroupProps & { type: LandingpageSectionType }) {
  if (type === "image") {
    return (
      <div className="space-y-3">
        <Textarea label="Headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
        <Field label="Bild URL" value={settings.imageUrl ?? ""} onChange={(value) => onChange({ imageUrl: value })} />
        <AssetFilePicker label="Bild aus Asset Library" type="image" onSelect={(value) => onChange({ imageUrl: value })} />
        <Field label="Alt Text" value={settings.imageAlt ?? ""} onChange={(value) => onChange({ imageAlt: value })} />
      </div>
    );
  }
  if (type === "video") {
    return (
      <div className="space-y-3">
        <Textarea label="Headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
        <Field label="Video URL" value={settings.videoUrl ?? ""} onChange={(value) => onChange({ videoUrl: value })} />
        <VideoAssetPicker label="Video auswählen oder hochladen" selectedUrl={settings.videoUrl} onSelect={(asset) => onChange(videoAssetPatch(asset))} onRemove={() => onChange({ videoAssetId: "", videoUrl: "", videoMobileUrl: "", videoWebmUrl: "", thumbnailUrl: "" })} />
        <Field label="Thumbnail URL" value={settings.thumbnailUrl ?? ""} onChange={(value) => onChange({ thumbnailUrl: value })} />
        <AssetFilePicker label="Thumbnail aus Asset Library" type="image" onSelect={(value) => onChange({ thumbnailUrl: value })} />
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.autoplay === true} onChange={(event) => onChange({ autoplay: event.target.checked })} /> Autoplay</label>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.controls !== false} onChange={(event) => onChange({ controls: event.target.checked })} /> Controls</label>
        <VideoDesignControls settings={settings} onChange={onChange} />
        <Field label="Button Text" value={settings.buttonText ?? ""} onChange={(value) => onChange({ buttonText: value })} />
      </div>
    );
  }
  if (type === "cta_button") {
    return (
      <div className="space-y-3">
        <Field label="Button Text" value={settings.ctaText ?? ""} onChange={(value) => onChange({ ctaText: value })} />
        <Field label="Link Ziel" value={settings.ctaUrl ?? ""} onChange={(value) => onChange({ ctaUrl: value })} />
        <Select label="Zieltyp" value={settings.buttonTargetType ?? "calendar"} options={["internal_booking", "external_url", "calendar", "scroll_section"]} onChange={(value) => onChange({ buttonTargetType: value as LandingpageSectionSettings["buttonTargetType"] })} />
        <Field label="Scroll Abschnitt" value={settings.buttonTargetSection ?? ""} onChange={(value) => onChange({ buttonTargetSection: value })} />
        <Select label="Style" value={settings.buttonStyle ?? "primary"} options={["primary", "secondary", "outline"]} onChange={(value) => onChange({ buttonStyle: value as LandingpageSectionSettings["buttonStyle"] })} />
      </div>
    );
  }
  if (type === "benefits") {
    return (
      <div className="space-y-3">
        <Textarea label="Headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
        <Textarea label="Vorteile" value={(settings.benefitItems ?? []).map((item) => `${item.title}|${item.text}`).join("\n")} onChange={(value) => onChange({ benefitItems: value.split("\n").map((line) => {
          const [title, ...rest] = line.split("|");
          return { title: title?.trim() ?? "", text: rest.join("|").trim() };
        }).filter((item) => item.title || item.text) })} />
      </div>
    );
  }
  if (type === "spacer") {
    return <Field label="Höhe" type="number" value={settings.spacerHeight ?? "48"} onChange={(value) => onChange({ spacerHeight: value })} />;
  }
  return <p className="text-sm text-slate-500">Trennlinie über Abstand und Design bearbeiten.</p>;
}

function DesignPanel({ design, activeSection, onDesignChange, onSectionChange }: { design: GlobalLandingpageDesign; activeSection?: LandingpageSection; onDesignChange: (design: GlobalLandingpageDesign) => void; onSectionChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Design</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Global</h2>
      </div>
      <Field label="Primärfarbe" type="color" value={design.primaryColor} onChange={(value) => onDesignChange({ ...design, primaryColor: value })} />
      <Field label="Akzentfarbe" type="color" value={design.accentColor} onChange={(value) => onDesignChange({ ...design, accentColor: value })} />
      <Field label="Hintergrundfarbe" type="color" value={design.backgroundColor} onChange={(value) => onDesignChange({ ...design, backgroundColor: value })} />
      <Field label="Textfarbe" type="color" value={design.textColor} onChange={(value) => onDesignChange({ ...design, textColor: value })} />
      <Field label="Buttonfarbe" type="color" value={design.buttonColor} onChange={(value) => onDesignChange({ ...design, buttonColor: value })} />
      <Field label="Schriftart" value={design.fontFamily} onChange={(value) => onDesignChange({ ...design, fontFamily: value })} />
      <Field label="Headline Größe" type="number" value={design.headlineSize} onChange={(value) => onDesignChange({ ...design, headlineSize: value })} />
      <Field label="Button Radius" value={design.buttonRadius} onChange={(value) => onDesignChange({ ...design, buttonRadius: value })} />
      <Field label="Card Radius" value={design.cardRadius} onChange={(value) => onDesignChange({ ...design, cardRadius: value })} />
      <Select label="Schatten" value={design.shadow} options={["soft", "strong"]} onChange={(value) => onDesignChange({ ...design, shadow: value as GlobalLandingpageDesign["shadow"] })} />
      <div className="border-t border-slate-200 pt-5">
        <h3 className="font-semibold text-slate-950">Abschnitt</h3>
        <Field label="Abstand oben" type="number" value={activeSection?.settings.spacingTop ?? "56"} onChange={(value) => onSectionChange({ spacingTop: value })} />
        <Field label="Abstand unten" type="number" value={activeSection?.settings.spacingBottom ?? "56"} onChange={(value) => onSectionChange({ spacingBottom: value })} />
        <Field label="Padding links" type="number" value={activeSection?.settings.paddingLeft ?? "32"} onChange={(value) => onSectionChange({ paddingLeft: value })} />
        <Field label="Padding rechts" type="number" value={activeSection?.settings.paddingRight ?? "32"} onChange={(value) => onSectionChange({ paddingRight: value })} />
        <Field label="Margin oben" type="number" value={activeSection?.settings.marginTop ?? "0"} onChange={(value) => onSectionChange({ marginTop: value })} />
        <Field label="Margin unten" type="number" value={activeSection?.settings.marginBottom ?? "0"} onChange={(value) => onSectionChange({ marginBottom: value })} />
        <Field label="Border Radius" value={activeSection?.settings.borderRadius ?? "0"} onChange={(value) => onSectionChange({ borderRadius: value })} />
        <Field label="Border Farbe" type="color" value={activeSection?.settings.borderColor ?? "#e2e8f0"} onChange={(value) => onSectionChange({ borderColor: value })} />
        <Field label="Border Breite" type="number" value={activeSection?.settings.borderWidth ?? "0"} onChange={(value) => onSectionChange({ borderWidth: value })} />
        <Field label="Schatten" value={activeSection?.settings.shadow ?? "none"} onChange={(value) => onSectionChange({ shadow: value })} />
        <Field label="Animation" value={activeSection?.settings.animation ?? "none"} onChange={(value) => onSectionChange({ animation: value })} />
        <Select label="Layout" value={activeSection?.settings.layout ?? "left"} options={["left", "right", "centered", "two_columns", "two_column", "full_width", "two_cards"]} onChange={(value) => onSectionChange({ layout: value as LandingpageSectionSettings["layout"] })} />
        <Select label="Ausrichtung" value={activeSection?.settings.alignment ?? "left"} options={["left", "center", "right"]} onChange={(value) => onSectionChange({ alignment: value as LandingpageSectionSettings["alignment"] })} />
        <Field label="Hintergrund" type="color" value={activeSection?.settings.backgroundColor ?? "#ffffff"} onChange={(value) => onSectionChange({ backgroundColor: value })} />
        <Field label="Textfarbe" type="color" value={activeSection?.settings.textColor ?? "#111827"} onChange={(value) => onSectionChange({ textColor: value })} />
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={activeSection?.settings.visibleDesktop !== false} onChange={(event) => onSectionChange({ visibleDesktop: event.target.checked })} /> Desktop sichtbar</label>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={activeSection?.settings.visibleTablet !== false} onChange={(event) => onSectionChange({ visibleTablet: event.target.checked })} /> Tablet sichtbar</label>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={activeSection?.settings.visibleMobile !== false} onChange={(event) => onSectionChange({ visibleMobile: event.target.checked })} /> Mobile sichtbar</label>
      </div>
    </div>
  );
}

type FieldGroupProps = {
  settings: LandingpageSectionSettings;
  onChange: (patch: Partial<LandingpageSectionSettings>) => void;
};

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block min-w-0 space-y-2"><span className="block whitespace-normal break-normal text-xs font-semibold uppercase tracking-wide text-slate-500 [overflow-wrap:normal]">{label}</span><input className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#6556ff] [overflow-wrap:anywhere]" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const normalized = clampNumber(value, min, max);
  const displayValue = formatSliderValue(normalized, step);
  const update = (next: string) => onChange(clampNumber(Number(next), min, max));
  return (
    <label className="block min-w-0 space-y-2">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>{label}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{displayValue}{unit}</span>
      </span>
      <span className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-3">
        <input
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#2563eb]"
          type="range"
          min={min}
          max={max}
          step={step}
          value={normalized}
          onChange={(event) => update(event.target.value)}
        />
        <input
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#6556ff]"
          type="number"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={(event) => update(event.target.value)}
        />
      </span>
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const colorValue = colorInputValue(value);
  return (
    <label className="block min-w-0 space-y-2">
      <span className="block whitespace-normal break-normal text-xs font-semibold uppercase tracking-wide text-slate-500 [overflow-wrap:normal]">{label}</span>
      <span className="grid grid-cols-[48px_minmax(0,1fr)] gap-2">
        <input
          className="h-11 w-12 rounded-xl border border-slate-200 bg-white p-1"
          type="color"
          value={colorValue}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#6556ff]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block min-w-0 space-y-2"><span className="block whitespace-normal break-normal text-xs font-semibold uppercase tracking-wide text-slate-500 [overflow-wrap:normal]">{label}</span><textarea className="min-h-28 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6556ff]" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block min-w-0 space-y-2"><span className="block whitespace-normal break-normal text-xs font-semibold uppercase tracking-wide text-slate-500 [overflow-wrap:normal]">{label}</span><select className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#6556ff]" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function DeviceSwitch({ device, onDeviceChange }: { device: Device; onDeviceChange: (device: Device) => void }) {
  const items: Array<{ value: Device; label: string; icon: ReactNode }> = [
    { value: "desktop", label: "Desktop", icon: <Laptop className="h-4 w-4" /> },
    { value: "tablet", label: "Tablet", icon: <Tablet className="h-4 w-4" /> },
    { value: "mobile", label: "Mobile", icon: <Smartphone className="h-4 w-4" /> }
  ];
  return (
    <div className="inline-flex rounded-xl bg-[var(--editor-card-bg)] p-1 text-[var(--editor-text)]">
      {items.map((item) => (
        <button key={item.value} type="button" title={item.label} onClick={() => onDeviceChange(item.value)} className={`inline-flex h-9 min-w-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold ${device === item.value ? "bg-[var(--editor-active-bg)] text-[var(--editor-active-text)] shadow-sm" : "text-[var(--editor-muted-text)] hover:bg-[var(--editor-card-hover-bg)]"}`}>
          {item.icon}<span className="hidden sm:inline">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function InlineElementPopup({
  activeElement,
  section,
  settings,
  bookingCalendars,
  device,
  onClose,
  onSettingsChange,
  onStyleChange,
  onTextChange
}: {
  activeElement: ActiveBuilderElement;
  section: LandingpageSection;
  settings: LandingpageSectionSettings;
  bookingCalendars: BookingCalendarReference[];
  device: Device;
  onClose: () => void;
  onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void;
  onStyleChange: (patch: BuilderElementStyle) => void;
  onTextChange: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[82vh] overflow-auto rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl md:bottom-auto md:left-auto md:right-6 md:top-24 md:w-[420px] md:max-w-[calc(100vw-48px)] md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{editorTitle(activeElement, section)}</h3>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100" aria-label="Schließen"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">Selected: {activeElement.kind} / {activeElement.elementId ?? activeElement.field ?? activeElement.sectionId}</p>
        {activeElement.kind === "logo" ? (
          <LogoElementEditor settings={settings} onSettingsChange={onSettingsChange} />
        ) : activeElement.kind === "text" || activeElement.kind === "link" || activeElement.kind === "list_item" ? (
          <InlineTextDesignPopup activeElement={activeElement} section={section} settings={settings} device={device} onSettingsChange={onSettingsChange} onStyleChange={onStyleChange} onTextChange={onTextChange} />
        ) : activeElement.kind === "button" ? (
          <InlineButtonPopup activeElement={activeElement} section={section} settings={settings} onSettingsChange={onSettingsChange} onTextChange={onTextChange} />
        ) : activeElement.kind === "video" ? (
          <InlineVideoPopup settings={settings} onSettingsChange={onSettingsChange} />
        ) : activeElement.kind === "booking" ? (
          <CalendarBlockEditor settings={settings} bookingCalendars={bookingCalendars} initialTab={activeElement.field === "bookingCalendarBorderColor" ? "design" : "edit"} onSettingsChange={onSettingsChange} />
        ) : null}
      </div>
    </div>
  );
}

function InlineTextDesignPopup({
  activeElement,
  section,
  settings,
  device,
  onSettingsChange,
  onStyleChange,
  onTextChange
}: {
  activeElement: ActiveBuilderElement;
  section: LandingpageSection;
  settings: LandingpageSectionSettings;
  device: Device;
  onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void;
  onStyleChange: (patch: BuilderElementStyle) => void;
  onTextChange: (value: string) => void;
}) {
  const [tab, setTab] = useState<"font" | "color" | "spacing" | "animation">("font");
  const builderElement = findBuilderElementForActive(section, activeElement);
  const elementStyle = builderElement?.style ?? {};
  const fallbacks = textStyleFallbacks(activeElement);
  const fieldValue = activeElement.itemList && activeElement.itemIndex !== undefined
    ? itemTextValue(settings, activeElement)
    : textValueForElement(builderElement, activeElement.field ? settings[activeElement.field] : "");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
        {[
          ["font", "Schrift"],
          ["color", "Farbe"],
          ["spacing", "Abstand"],
          ["animation", "Animation"]
        ].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value as typeof tab)} className={`rounded-lg px-2 py-2 ${tab === value ? "bg-white shadow-sm" : "text-slate-500"}`}>{label}</button>)}
      </div>
      <Textarea label="Text" value={fieldValue} onChange={onTextChange} />
      {tab === "font" ? (
        <TypographyControls style={elementStyle} settings={settings} device={device} fallbacks={fallbacks} onStyleChange={onStyleChange} />
      ) : null}
      {tab === "color" ? (
        <ColorAndAlignmentControls style={elementStyle} settings={settings} device={device} fallbacks={fallbacks} onStyleChange={onStyleChange} />
      ) : null}
      {tab === "spacing" ? (
        <SpacingControls style={elementStyle} device={device} fallbacks={fallbacks} onStyleChange={onStyleChange} />
      ) : null}
      {tab === "animation" ? <Select label="Animation" value={styleString(elementStyle.animation, "none")} options={["none", "fade", "slide", "scale", "lift"]} onChange={(value) => onStyleChange({ animation: value })} /> : null}
    </div>
  );
}

function InlineButtonPopup({ activeElement, section, settings, onSettingsChange, onTextChange }: { activeElement: ActiveBuilderElement; section: LandingpageSection; settings: LandingpageSectionSettings; onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void; onTextChange: (value: string) => void }) {
  const linkValue = activeElement.field === "headerCtaText" ? settings.headerCtaUrl ?? "" : settings.ctaUrl ?? "";
  const builderElement = findBuilderElementForActive(section, activeElement);
  return (
    <div className="space-y-3">
      <Field label="Text" value={textValueForElement(builderElement, activeElement.field ? settings[activeElement.field] : "")} onChange={onTextChange} />
      <Field label="Link URL" value={linkValue} onChange={(value) => onSettingsChange(activeElement.field === "headerCtaText" ? { headerCtaUrl: value } : { ctaUrl: value })} />
      <Select label="Link Typ" value={settings.buttonLinkType ?? linkTypeFromTarget(settings.buttonTargetType)} options={["url", "calendar", "phone", "mail", "scroll"]} onChange={(value) => onSettingsChange(buttonLinkPatch(value as NonNullable<LandingpageSectionSettings["buttonLinkType"]>))} />
      <Field label="Hintergrundfarbe" type="color" value={settings.buttonColor ?? "#101828"} onChange={(value) => onSettingsChange({ buttonColor: value })} />
      <Field label="Textfarbe" type="color" value={settings.buttonTextColor ?? "#ffffff"} onChange={(value) => onSettingsChange({ buttonTextColor: value })} />
      <Field label="Hover-Farbe" type="color" value={settings.buttonHoverColor ?? "#111827"} onChange={(value) => onSettingsChange({ buttonHoverColor: value })} />
      <Field label="Border Radius" type="number" value={settings.buttonBorderRadius ?? "14"} onChange={(value) => onSettingsChange({ buttonBorderRadius: value })} />
      <Field label="Padding X" type="number" value={settings.buttonPaddingX ?? "22"} onChange={(value) => onSettingsChange({ buttonPaddingX: value })} />
      <Field label="Padding Y" type="number" value={settings.buttonPaddingY ?? "14"} onChange={(value) => onSettingsChange({ buttonPaddingY: value })} />
      <Field label="Schriftgröße" type="number" value={settings.buttonFontSize ?? "14"} onChange={(value) => onSettingsChange({ buttonFontSize: value })} />
      <Select label="Breite" value={settings.buttonWidthMode ?? "auto"} options={["auto", "full", "custom"]} onChange={(value) => onSettingsChange({ buttonWidthMode: value as LandingpageSectionSettings["buttonWidthMode"] })} />
      <Field label="Custom Width" type="number" value={settings.buttonCustomWidth ?? "220"} onChange={(value) => onSettingsChange({ buttonCustomWidth: value, buttonWidthMode: "custom" })} />
      <Select label="Ausrichtung" value={settings.buttonAlignment ?? settings.alignment ?? "left"} options={["left", "center", "right"]} onChange={(value) => onSettingsChange({ buttonAlignment: value as LandingpageSectionSettings["buttonAlignment"], alignment: value as LandingpageSectionSettings["alignment"] })} />
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.buttonShadow === true} onChange={(event) => onSettingsChange({ buttonShadow: event.target.checked })} /> Schatten</label>
      <Select label="Animation" value={settings.buttonAnimation ?? "none"} options={["none", "lift", "pulse", "glow", "scale", "bounce"]} onChange={(value) => onSettingsChange({ buttonAnimation: value as LandingpageSectionSettings["buttonAnimation"] })} />
    </div>
  );
}

function InlineVideoPopup({ settings, onSettingsChange }: { settings: LandingpageSectionSettings; onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  return (
    <div className="space-y-3">
      <VideoAssetPicker label="Video auswählen oder hochladen" selectedUrl={settings.videoUrl} onSelect={(asset) => onSettingsChange(videoAssetPatch(asset))} onRemove={() => onSettingsChange({ videoAssetId: "", videoUrl: "", videoMobileUrl: "", videoWebmUrl: "", thumbnailUrl: "" })} />
      <Field label="Video URL" value={settings.videoUrl ?? ""} onChange={(value) => onSettingsChange({ videoUrl: value })} />
      <Field label="Poster" value={settings.thumbnailUrl ?? ""} onChange={(value) => onSettingsChange({ thumbnailUrl: value })} />
      <AssetFilePicker label="Poster auswählen" type="image" onSelect={(value) => onSettingsChange({ thumbnailUrl: value })} />
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.controls !== false} onChange={(event) => onSettingsChange({ controls: event.target.checked })} /> Controls</label>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.autoplay === true} onChange={(event) => onSettingsChange({ autoplay: event.target.checked, muted: event.target.checked ? true : settings.muted })} /> Autoplay</label>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.muted === true} onChange={(event) => onSettingsChange({ muted: event.target.checked })} /> Muted</label>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4" type="checkbox" checked={settings.loop === true} onChange={(event) => onSettingsChange({ loop: event.target.checked })} /> Loop</label>
      <VideoDesignControls settings={settings} onChange={onSettingsChange} />
    </div>
  );
}

function FloatingTextToolbar({ style, device, onStyleChange, onClose }: { style: BuilderElementStyle; device: Device; onStyleChange: (patch: BuilderElementStyle) => void; onClose: () => void }) {
  const responsive = getResponsiveElementStyle(style, device);
  const fontSize = styleNumber(responsive.fontSize ?? style.fontSize, 24);
  const decoration = typeof style.textDecoration === "string" ? style.textDecoration : "";
  const setDecoration = (token: "underline" | "line-through") => {
    const parts = new Set(decoration.split(" ").filter(Boolean));
    if (parts.has(token)) parts.delete(token); else parts.add(token);
    onStyleChange({ textDecoration: Array.from(parts).join(" ") });
  };
  return (
    <div className="sticky top-4 z-40 mx-auto mb-4 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl">
      <select className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-semibold" value={styleString(style.fontFamily, "Inter")} onChange={(event) => onStyleChange({ fontFamily: event.target.value })} aria-label="Schriftart">
        {["Inter", "Lato", "Poppins", "System", "Serif"].map((font) => <option key={font} value={font}>{font}</option>)}
      </select>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" onClick={() => onStyleChange(responsiveElementPatch(style, device, "fontSize", Math.max(8, fontSize - 1)))}>-</button>
      <span className="min-w-8 text-center text-xs font-semibold">{fontSize}</span>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" onClick={() => onStyleChange(responsiveElementPatch(style, device, "fontSize", fontSize + 1))}>+</button>
      <ToolbarButton active={styleNumber(style.fontWeight, 400) >= 700} onClick={() => onStyleChange({ fontWeight: styleNumber(style.fontWeight, 400) >= 700 ? 400 : 700 })}><Bold className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton active={style.fontStyle === "italic"} onClick={() => onStyleChange({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })}><Italic className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton active={decoration.includes("underline")} onClick={() => setDecoration("underline")}><Underline className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton active={decoration.includes("line-through")} onClick={() => setDecoration("line-through")}><Strikethrough className="h-4 w-4" /></ToolbarButton>
      <input aria-label="Farbe" type="color" className="h-9 w-10 rounded-lg border border-slate-200 bg-white p-1" value={styleString(style.color, "#111827")} onChange={(event) => onStyleChange({ color: event.target.value })} />
      <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" aria-label="Schließen"><X className="h-4 w-4" /></button>
    </div>
  );
}

function ToolbarButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-slate-950 text-white" : "hover:bg-slate-100"}`}>{children}</button>;
}

function FloatingVideoPanel({ settings, onSettingsChange, onClose }: { settings: LandingpageSectionSettings; onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void; onClose: () => void }) {
  return (
    <div className="fixed right-4 top-24 z-50 max-h-[calc(100vh-120px)] w-[min(92vw,720px)] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:right-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-950">Video bearbeiten</h3>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 space-y-3">
        <VideoPreview {...videoPreviewPropsFromSettings(settings)} />
        <VideoAssetPicker label="Video auswählen oder hochladen" selectedUrl={settings.videoUrl} onSelect={(asset) => onSettingsChange(videoAssetPatch(asset))} onRemove={() => onSettingsChange({ videoAssetId: "", videoUrl: "", videoMobileUrl: "", videoWebmUrl: "", thumbnailUrl: "" })} />
        <VideoDesignControls settings={settings} onChange={onSettingsChange} />
        <button type="button" onClick={() => onSettingsChange({ videoAssetId: "", videoUrl: "" })} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"><X className="h-4 w-4" /> Entfernen</button>
      </div>
    </div>
  );
}

function FloatingDesignPanel({ design, activeSection, onDesignChange, onSectionChange, onClose }: { design: GlobalLandingpageDesign; activeSection?: LandingpageSection; onDesignChange: (design: GlobalLandingpageDesign) => void; onSectionChange: (patch: Partial<LandingpageSectionSettings>) => void; onClose: () => void }) {
  return (
    <div className="fixed right-6 top-24 z-50 max-h-[calc(100vh-120px)] w-[360px] max-w-[calc(100vw-32px)] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-950">Design</h3>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <DesignPanel design={design} activeSection={activeSection} onDesignChange={onDesignChange} onSectionChange={onSectionChange} />
    </div>
  );
}

function AddSectionModal({ onAdd, onClose }: { onAdd: (type: LandingpageSectionType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4 py-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Abschnitt hinzufügen</h2>
            <p className="mt-1 text-sm text-slate-500">Wähle einen Abschnittstyp für die Vorlage.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {addSectionOptions.map((option) => (
            <button key={`${option.label}-${option.type}`} type="button" onClick={() => onAdd(option.type)} className="rounded-2xl border border-slate-200 p-4 text-left hover:border-[#6556ff] hover:bg-[#f7f6ff]">
              <span className="block text-sm font-semibold text-slate-950">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ensureEditorSections(input: LandingpageSection[]) {
  let next = input.filter((section) => section.type !== "personal_video");
  for (const type of ["header", "hero", "explainer_video", "comparison", "cta", "approach", "faq", "textblock", "footer", "booking", "thank_you", "legal"] as LandingpageSectionType[]) {
    if (!next.some((section) => section.type === type)) next = addLandingpageSection(next, type);
  }
  return next.map((section, index) => ({
    ...ensureBuilderElementsForEditor(section),
    order: index + 1,
    settings: section.type === "hero" ? {
      ...section.settings,
      bodyTextDu: section.settings.bodyTextDu || addressGreetingTemplate("du"),
      bodyTextSie: section.settings.bodyTextSie || addressGreetingTemplate("sie")
    } : section.settings
  }));
}

function ensureBuilderElementsForEditor(section: LandingpageSection): LandingpageSection {
  const fields = editableFieldsForSection(section);
  if (!section.containers?.[0]?.columns?.[0]) return section;
  const missing = fields.filter(({ field }) => !findBuilderElementByField(section, field));
  const missingFaqElements = section.type === "faq"
    ? (section.settings.faqItems ?? []).flatMap((_, index) => ([
        { index, key: "question" as const },
        { index, key: "answer" as const }
      ])).filter(({ index, key }) => !findBuilderElementForActive(section, { sectionId: section.id, kind: "text", itemList: "faqItems", itemIndex: index, itemKey: key }))
    : [];
  const comparisonItems = section.type === "comparison"
    ? ([
        ["leftItems", section.settings.leftItems ?? section.settings.beforeItems ?? []],
        ["rightItems", section.settings.rightItems ?? section.settings.afterItems ?? []]
      ] as const).flatMap(([listName, items]) => items.map((_, index) => ({ listName, index })))
        .filter(({ listName, index }) => !findBuilderElementForActive(section, { sectionId: section.id, kind: "list_item", itemList: listName, itemIndex: index }))
    : [];
  const missingBenefitElements = section.type === "benefits"
    ? (section.settings.benefitItems ?? []).flatMap((_, index) => ([
        { index, key: "title" as const },
        { index, key: "text" as const }
      ])).filter(({ index, key }) => !findBuilderElementForActive(section, { sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: key }))
    : [];
  if (!missing.length && !missingFaqElements.length && !comparisonItems.length && !missingBenefitElements.length) return section;
  const [firstContainer, ...restContainers] = section.containers;
  const [firstColumn, ...restColumns] = firstContainer.columns;
  return {
    ...section,
    containers: [
      {
        ...firstContainer,
        columns: [
          {
            ...firstColumn,
            elements: [
              ...firstColumn.elements,
              ...missing.map(({ field, type }) => createFieldBuilderElement(section, field, type)),
              ...missingFaqElements.map(({ index, key }) => createFaqBuilderElement(section, index, key)),
              ...comparisonItems.map(({ listName, index }) => createListBuilderElement(section, listName, index)),
              ...missingBenefitElements.map(({ index, key }) => createBenefitBuilderElement(section, index, key))
            ]
          },
          ...restColumns
        ]
      },
      ...restContainers
    ]
  };
}

function editableFieldsForSection(section: LandingpageSection): Array<{ field: EditingField; type: BuilderElement["type"] }> {
  if (section.type === "header") {
    return [
      { field: "logoText", type: "image" },
      { field: "menuItem1Text", type: "text" },
      { field: "menuItem2Text", type: "text" },
      { field: "menuItem3Text", type: "text" },
      { field: "headerCtaText", type: "button" }
    ];
  }
  const fields: Array<{ field: EditingField; type: BuilderElement["type"] }> = [];
  if (section.settings.headline !== undefined) fields.push({ field: "headline", type: "headline" });
  if (section.settings.subheadline !== undefined) fields.push({ field: "subheadline", type: "text" });
  if (section.settings.bodyText !== undefined) fields.push({ field: "bodyText", type: "text" });
  if (section.settings.ctaText !== undefined && section.settings.ctaText !== "") fields.push({ field: "ctaText", type: "button" });
  if (section.settings.videoUrl !== undefined) fields.push({ field: "videoUrl", type: "video" });
  if (section.settings.videoLabel !== undefined) fields.push({ field: "videoLabel", type: "text" });
  if (section.settings.buttonText !== undefined) fields.push({ field: "buttonText", type: "text" });
  if (section.type === "booking") fields.push({ field: "bookingUrl", type: "booking" });
  if (section.type === "legal") fields.push({ field: "legalText", type: "text" });
  if (section.type === "image") fields.push({ field: "imageUrl", type: "image" });
  return fields;
}

function createFieldBuilderElement(section: LandingpageSection, field: EditingField, type: BuilderElement["type"]): BuilderElement {
  const text = typeof section.settings[field] === "string" ? section.settings[field] : "";
  const logo = section.type === "header" && field === "logoText" ? resolveHeaderLogo(section.settings) : null;
  return {
    id: `element_${section.id}_${String(field)}`,
    type,
    props: {
      field,
      text,
      ...(logo ? {
        logoType: logo.type,
        text: logo.text,
        url: logo.imageUrl,
        alt: logo.alt,
        width: logo.width,
        height: logo.height
      } : {}),
      ...(type === "button" ? {
        href: field === "headerCtaText" ? section.settings.headerCtaUrl ?? "" : section.settings.ctaUrl ?? "",
        fontSize: field === "headerCtaText" || field === "ctaText" ? section.settings.buttonFontSize ?? "14" : undefined
      } : {})
    },
    style: defaultBuilderElementStyle(section, field, type),
    editable: true
  };
}

function defaultBuilderElementStyle(section: LandingpageSection, field: EditingField, type: BuilderElement["type"]): BuilderElementStyle {
  if (section.type === "header" && (field === "menuItem1Text" || field === "menuItem2Text" || field === "menuItem3Text")) {
    return {
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#475569",
      textAlign: "left",
      marginTop: 0,
      marginBottom: 0,
      desktop: { fontSize: 14 },
      tablet: { fontSize: 14 },
      mobile: { fontSize: 14 }
    };
  }
  if (type === "headline") {
    return { fontFamily: "Inter", fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: "#111827", textAlign: "left", marginTop: 0, marginBottom: 24, desktop: { fontSize: 48 }, tablet: { fontSize: 38 }, mobile: { fontSize: 30 } };
  }
  if (type === "text") {
    return { fontFamily: "Inter", fontSize: 22, fontWeight: 400, lineHeight: 1.5, color: "#667085", textAlign: "left", marginTop: 0, marginBottom: 0, desktop: { fontSize: 22 }, tablet: { fontSize: 20 }, mobile: { fontSize: 17 } };
  }
  return { desktop: {}, tablet: {}, mobile: {} };
}

function createFaqBuilderElement(section: LandingpageSection, index: number, itemKey: "question" | "answer"): BuilderElement {
  const item = section.settings.faqItems?.[index];
  const isQuestion = itemKey === "question";
  return {
    id: `element_${section.id}_faq_${index}_${itemKey}`,
    type: isQuestion ? "headline" : "text",
    props: {
      itemList: "faqItems",
      itemIndex: index,
      itemKey,
      text: isQuestion ? item?.question ?? "" : item?.answer ?? ""
    },
    style: isQuestion
      ? { fontFamily: "Inter", fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: "#111827", textAlign: "left", marginTop: 0, marginBottom: 8, desktop: { fontSize: 20 }, tablet: { fontSize: 19 }, mobile: { fontSize: 18 } }
      : { fontFamily: "Inter", fontSize: 15, fontWeight: 400, lineHeight: 1.6, color: "#667085", textAlign: "left", marginTop: 8, marginBottom: 0, desktop: { fontSize: 15 }, tablet: { fontSize: 15 }, mobile: { fontSize: 14 } },
    editable: true
  };
}

function createListBuilderElement(section: LandingpageSection, listName: "leftItems" | "rightItems", index: number): BuilderElement {
  const items = listName === "leftItems" ? section.settings.leftItems ?? section.settings.beforeItems ?? [] : section.settings.rightItems ?? section.settings.afterItems ?? [];
  return {
    id: `element_${section.id}_${listName}_${index}`,
    type: "text",
    props: {
      itemList: listName,
      itemIndex: index,
      text: items[index] ?? ""
    },
    style: {
      fontFamily: "Inter",
      fontSize: 15,
      fontWeight: 500,
      lineHeight: 1.6,
      color: "#334155",
      textAlign: "left",
      marginTop: 0,
      marginBottom: 0,
      desktop: { fontSize: 15 },
      tablet: { fontSize: 15 },
      mobile: { fontSize: 14 }
    },
    editable: true
  };
}

function createBenefitBuilderElement(section: LandingpageSection, index: number, itemKey: "title" | "text"): BuilderElement {
  const item = section.settings.benefitItems?.[index];
  const isTitle = itemKey === "title";
  return {
    id: `element_${section.id}_benefit_${index}_${itemKey}`,
    type: isTitle ? "headline" : "text",
    props: {
      itemList: "benefitItems",
      itemIndex: index,
      itemKey,
      text: isTitle ? item?.title ?? "" : item?.text ?? ""
    },
    style: isTitle
      ? { fontFamily: "Inter", fontSize: 18, fontWeight: 800, lineHeight: 1.3, color: "#111827", textAlign: "left", marginTop: 0, marginBottom: 8, desktop: { fontSize: 18 }, tablet: { fontSize: 17 }, mobile: { fontSize: 16 } }
      : { fontFamily: "Inter", fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: "#475569", textAlign: "left", marginTop: 8, marginBottom: 0, desktop: { fontSize: 14 }, tablet: { fontSize: 14 }, mobile: { fontSize: 14 } },
    editable: true
  };
}

function sectionsForTab(sections: LandingpageSection[], tab: PageTab) {
  return tab === "landingpage" ? landingpageOnlySections(sections) : sectionsForPageTab(sections, tab);
}

function firstSectionForTab(sections: LandingpageSection[], tab: PageTab) {
  return sectionsForTab(sections, tab)[0] ?? sections[0];
}

function visibleBuilderSections(sections: LandingpageSection[], activeTab: PageTab) {
  if (activeTab !== "landingpage") return sectionsForTab(sections, activeTab);
  const preferred = sidebarSectionTypes
    .map((type) => sections.find((section) => section.type === type))
    .filter(Boolean) as LandingpageSection[];
  const extras = sections.filter((section) => !["booking", "thank_you", "legal", "personal_video"].includes(section.type) && !preferred.some((item) => item.id === section.id));
  return [...preferred, ...extras];
}

function defaultActiveElementForSection(section: LandingpageSection): ActiveBuilderElement {
  const first = elementTreeItems(section)[0]?.element;
  return first ?? { sectionId: section.id, kind: "section" };
}

function sectionIcon(type: LandingpageSectionType) {
  const className = "h-4 w-4";
  if (type === "header" || type === "footer") return <LayoutTemplate className={className} />;
  if (type === "hero") return <Sparkles className={className} />;
  if (type === "video" || type === "explainer_video" || type === "personal_video") return <SquarePlay className={className} />;
  if (type === "faq") return <HelpCircle className={className} />;
  if (type === "image") return <ImageIcon className={className} />;
  if (type === "cta" || type === "cta_button") return <MousePointerClick className={className} />;
  return <FileText className={className} />;
}

function elementTreeItems(section: LandingpageSection): Array<{ key: string; label: string; type: string; icon: ReactNode; element: ActiveBuilderElement }> {
  const textIcon = <Type className="h-3.5 w-3.5" />;
  const buttonIcon = <MousePointerClick className="h-3.5 w-3.5" />;
  const linkIcon = <LinkIcon className="h-3.5 w-3.5" />;
  const videoIcon = <SquarePlay className="h-3.5 w-3.5" />;
  const items: Array<{ key: string; label: string; type: string; icon: ReactNode; element: ActiveBuilderElement }> = [];
  const addField = (field: EditingField, label: string, kind: BuilderElementKind, type: string, icon: ReactNode) => {
    const element = findBuilderElementByField(section, field);
    items.push({ key: `${section.id}-${field}`, label, type, icon, element: { sectionId: section.id, field, kind, elementId: element?.id } });
  };

  if (section.type === "header") {
    addField("logoText", "Logo", "logo", "Bild/Textlogo", <ImageIcon className="h-3.5 w-3.5" />);
    addField("menuItem1Text", `Navigation Link: ${section.settings.menuItem1Text || "Warum wir?"}`, "link", "Navigation Link", <Navigation className="h-3.5 w-3.5" />);
    addField("menuItem2Text", `Navigation Link: ${section.settings.menuItem2Text || "Unser Ansatz"}`, "link", "Navigation Link", <Navigation className="h-3.5 w-3.5" />);
    addField("menuItem3Text", `Navigation Link: ${section.settings.menuItem3Text || "FAQ"}`, "link", "Navigation Link", <Navigation className="h-3.5 w-3.5" />);
    addField("headerCtaText", "Header Button", "button", "Button", buttonIcon);
    return items;
  }
  if (section.settings.headline !== undefined) addField("headline", "Headline", "text", "Text", textIcon);
  if (section.settings.subheadline !== undefined) addField("subheadline", "Subheadline", "text", "Text", textIcon);
  if (section.settings.bodyText !== undefined) addField("bodyText", "Text", "text", "Textblock", textIcon);
  if (section.type === "booking") addField("bookingUrl", "Kalender", "booking", "Buchungskalender", <SquarePlay className="h-3.5 w-3.5" />);
  if (section.settings.ctaText !== undefined && section.settings.ctaText !== "") addField("ctaText", section.type === "cta_button" ? "CTA Button" : "CTA Button", "button", "Button", buttonIcon);
  if (section.settings.videoUrl !== undefined) {
    addField("videoUrl", "Video", "video", "Video", videoIcon);
    if (section.settings.videoLabel !== undefined) addField("videoLabel", "Video Label", "text", "Text", textIcon);
    if (section.settings.buttonText !== undefined) addField("buttonText", "Video Label", "text", "Text", textIcon);
  }
  if (section.type === "image") addField("imageUrl", "Bild", "link", "Bild", <ImageIcon className="h-3.5 w-3.5" />);
  (section.settings.benefitItems ?? []).forEach((item, index) => {
    const titleElement: ActiveBuilderElement = { sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: "title" };
    const textElement: ActiveBuilderElement = { sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: "text" };
    items.push({ key: `${section.id}-benefit-title-${index}`, label: item.title || `Karte ${index + 1}`, type: "Karten-Titel", icon: <FileText className="h-3.5 w-3.5" />, element: { ...titleElement, elementId: findBuilderElementForActive(section, titleElement)?.id } });
    items.push({ key: `${section.id}-benefit-text-${index}`, label: item.text || `Kartentext ${index + 1}`, type: "Kartentext", icon: textIcon, element: { ...textElement, elementId: findBuilderElementForActive(section, textElement)?.id } });
  });
  (section.settings.faqItems ?? []).forEach((item, index) => {
    const questionElement: ActiveBuilderElement = { sectionId: section.id, kind: "text", itemList: "faqItems", itemIndex: index, itemKey: "question" };
    const answerElement: ActiveBuilderElement = { sectionId: section.id, kind: "text", itemList: "faqItems", itemIndex: index, itemKey: "answer" };
    items.push({ key: `${section.id}-faq-q-${index}`, label: item.question || `Frage ${index + 1}`, type: "FAQ Frage", icon: <HelpCircle className="h-3.5 w-3.5" />, element: { ...questionElement, elementId: findBuilderElementForActive(section, questionElement)?.id } });
    items.push({ key: `${section.id}-faq-a-${index}`, label: item.answer || `Antwort ${index + 1}`, type: "FAQ Antwort", icon: textIcon, element: { ...answerElement, elementId: findBuilderElementForActive(section, answerElement)?.id } });
  });
  if (section.type === "footer") {
    items.push({ key: `${section.id}-impressum`, label: "Impressum Link", type: "Rechtlicher Link", icon: linkIcon, element: { sectionId: section.id, field: "bodyText", kind: "link" } });
    items.push({ key: `${section.id}-datenschutz`, label: "Datenschutz Link", type: "Rechtlicher Link", icon: linkIcon, element: { sectionId: section.id, field: "bodyText", kind: "link" } });
  }
  return items;
}

function getActiveElementStyle(sections: LandingpageSection[], activeElement: ActiveBuilderElement | null): BuilderElementStyle {
  if (!activeElement) return {};
  const section = sections.find((item) => item.id === activeElement.sectionId);
  if (!section) return {};
  const element = findBuilderElementForActive(section, activeElement);
  return element?.style ?? {};
}

function findByType(sections: LandingpageSection[], type: LandingpageSectionType) {
  return sections.find((section) => section.type === type);
}

function useStoredBoolean(key: string, initialValue: boolean) {
  const [value, setValue] = useState(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) setValue(stored === "true");
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(key, String(value));
  }, [key, ready, value]);

  return [value, setValue] as const;
}

function builderGridVars(leftCollapsed: boolean, rightCollapsed: boolean) {
  if (leftCollapsed && rightCollapsed) return "[--builder-left:72px] [--builder-right:56px]";
  if (leftCollapsed) return "[--builder-left:72px] [--builder-right:minmax(360px,400px)]";
  if (rightCollapsed) return "[--builder-left:280px] [--builder-right:56px]";
  return "[--builder-left:280px] [--builder-right:minmax(360px,400px)]";
}

function editorSnapshot(sections: LandingpageSection[], design: GlobalLandingpageDesign, addressForm: AddressForm) {
  return JSON.stringify({ sections, design, addressForm });
}

function isActiveButton(activeElement: ActiveBuilderElement | null | undefined, sectionId: string, field: EditingField) {
  return activeElement?.sectionId === sectionId && activeElement.kind === "button" && activeElement.field === field;
}

function isSameElement(activeElement: ActiveBuilderElement | null | undefined, element: ActiveBuilderElement) {
  if (activeElement?.elementId || element.elementId) return activeElement?.elementId === element.elementId;
  return activeElement?.sectionId === element.sectionId
    && activeElement.kind === element.kind
    && activeElement.field === element.field
    && activeElement.itemList === element.itemList
    && activeElement.itemIndex === element.itemIndex
    && activeElement.itemKey === element.itemKey;
}

function activeElementTreeKey(element: ActiveBuilderElement) {
  if (element.kind === "section") return `${element.sectionId}-section`;
  if (element.elementId) return `${element.sectionId}-${element.elementId}`;
  if (element.field) return `${element.sectionId}-${element.field}`;
  if (element.itemList) return `${element.sectionId}-${element.itemList}-${element.itemIndex ?? 0}-${element.itemKey ?? "item"}`;
  return `${element.sectionId}-${element.kind}-${element.itemIndex ?? 0}`;
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function findBuilderElementById(section: LandingpageSection, elementId: string) {
  for (const container of section.containers ?? []) {
    for (const column of container.columns) {
      const match = findElementByIdRecursive(column.elements, elementId);
      if (match) return match;
    }
  }
  return undefined;
}

function flattenBuilderElements(sections: LandingpageSection[]) {
  return sections.flatMap((section) => (section.containers ?? []).flatMap((container) => container.columns.flatMap((column) => flattenElementsRecursive(column.elements))));
}

function findElementByIdRecursive(elements: BuilderElement[], elementId: string): BuilderElement | undefined {
  for (const element of elements) {
    if (element.id === elementId) return element;
    const source = element as typeof element & { elements?: typeof elements; children?: typeof elements };
    const nested = Array.isArray(source.elements) ? source.elements : Array.isArray(source.children) ? source.children : undefined;
    const match = nested ? findElementByIdRecursive(nested, elementId) : undefined;
    if (match) return match;
  }
  return undefined;
}

function flattenElementsRecursive(elements: BuilderElement[]): BuilderElement[] {
  return elements.flatMap((element) => {
    const source = element as typeof element & { elements?: typeof elements; children?: typeof elements };
    const nested = Array.isArray(source.elements) ? source.elements : Array.isArray(source.children) ? source.children : undefined;
    return nested ? [element, ...flattenElementsRecursive(nested)] : [element];
  });
}

function styleString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function logoCssSize(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value}px` : value;
}

function numericLogoSize(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValueForElement(element: BuilderElement | undefined, fallback: unknown) {
  return typeof element?.props?.text === "string" ? element.props.text : String(fallback ?? "");
}

function itemTextValue(settings: LandingpageSectionSettings, element: ActiveBuilderElement) {
  const index = element.itemIndex ?? 0;
  if (element.itemList === "faqItems") {
    return String(settings.faqItems?.[index]?.[element.itemKey === "answer" ? "answer" : "question"] ?? "");
  }
  if (element.itemList === "benefitItems") {
    return String(settings.benefitItems?.[index]?.[element.itemKey === "text" ? "text" : "title"] ?? "");
  }
  if (element.itemList === "leftItems" || element.itemList === "rightItems" || element.itemList === "beforeItems" || element.itemList === "afterItems") {
    return String(settings[element.itemList]?.[index] ?? "");
  }
  return "";
}

function styleNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatSliderValue(value: number, step: number) {
  if (step >= 1) return String(Math.round(value));
  return value.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function colorInputValue(value: string) {
  const normalized = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    return `#${normalized.slice(1).split("").map((char) => `${char}${char}`).join("")}`;
  }
  return "#ffffff";
}

function elementSelectionLabel(section: LandingpageSection, activeElement: ActiveBuilderElement | null) {
  if (activeElement?.kind === "button") return "Button";
  if (activeElement?.kind === "video") return "Video";
  if (activeElement?.kind === "logo") return "Logo";
  if (activeElement?.kind === "link") return "Link";
  if (activeElement?.itemList === "faqItems") return activeElement.itemKey === "answer" ? "Antwort" : "Frage";
  if (activeElement?.kind === "text") return activeElement.field === "headline" || activeElement.field === "subheadline" ? "Headline" : "Text";
  return sectionNames[section.type];
}

function linkTypeFromTarget(target?: LandingpageSectionSettings["buttonTargetType"]): NonNullable<LandingpageSectionSettings["buttonLinkType"]> {
  if (target === "scroll_section") return "scroll";
  if (target === "calendar" || target === "internal_booking") return "calendar";
  return "url";
}

function buttonLinkPatch(linkType: NonNullable<LandingpageSectionSettings["buttonLinkType"]>): Partial<LandingpageSectionSettings> {
  const targetMap: Record<NonNullable<LandingpageSectionSettings["buttonLinkType"]>, LandingpageSectionSettings["buttonTargetType"]> = {
    url: "external_url",
    scroll: "scroll_section",
    mail: "external_url",
    phone: "external_url",
    calendar: "calendar"
  };
  return { buttonLinkType: linkType, buttonTargetType: targetMap[linkType] };
}

function videoAssetPatch(asset: VideoAsset): Partial<LandingpageSectionSettings> {
  const derivatives = asset as VideoAsset & { mobileUrl?: string | null; webmUrl?: string | null };
  return {
    videoAssetId: asset.id,
    videoUrl: asset.url,
    videoMobileUrl: derivatives.mobileUrl ?? asset.url,
    videoWebmUrl: derivatives.webmUrl ?? "",
    thumbnailUrl: asset.thumbnailUrl ?? ""
  };
}

function deriveLegacyPayload(sections: LandingpageSection[], design: GlobalLandingpageDesign) {
  const header = findByType(sections, "header")?.settings ?? {};
  const hero = findByType(sections, "hero")?.settings ?? {};
  const explainer = findByType(sections, "explainer_video")?.settings ?? {};
  const comparison = findByType(sections, "comparison")?.settings ?? {};
  const cta = findByType(sections, "cta")?.settings ?? {};
  const finalCta = findByType(sections, "textblock")?.settings ?? {};
  const booking = findByType(sections, "booking")?.settings ?? {};
  const footer = findByType(sections, "footer")?.settings ?? {};
  const logo = resolveHeaderLogo(header);
  const bookingDefaultUrl = booking.bookingUrl && !booking.bookingUrl.includes("{{") ? booking.bookingUrl : "";
  return {
    logoUrl: logo.imageUrl,
    headerLogoUrl: logo.imageUrl,
    headerLogoAlt: logo.alt,
    headerLogoWidth: numericLogoSize(logo.width),
    headerLogoHeight: numericLogoSize(logo.height),
    headerLogoPosition: header.headerLogoPosition ?? "left",
    headerShowTextFallback: header.headerShowTextFallback !== false,
    headerTextFallback: logo.text,
    heroEnabled: findByType(sections, "hero")?.enabled ?? true,
    heroHeadline: hero.headline ?? "",
    heroBodyText: hero.bodyText ?? "",
    heroCtaText: hero.ctaText ?? "",
    heroCtaUrl: hero.ctaUrl ?? "",
    heroVideoPosition: hero.videoPosition ?? "right",
    personalVideoEnabled: Boolean(hero.videoUrl || hero.thumbnailUrl),
    personalVideoUrl: hero.videoUrl ?? "",
    personalVideoThumbnailUrl: hero.thumbnailUrl ?? "",
    personalVideoButtonText: hero.videoLabel ?? "Persönliches Video ansehen!",
    explainerVideoEnabled: findByType(sections, "explainer_video")?.enabled ?? true,
    explainerVideoTitle: explainer.headline ?? "",
    explainerVideoSubline: explainer.subheadline ?? "",
    explainerVideoUrl: explainer.videoUrl ?? "",
    explainerVideoThumbnailUrl: explainer.thumbnailUrl ?? "",
    explainerVideoButtonText: explainer.buttonText ?? "Erklärvideo ansehen",
    explainerCtaText: explainer.ctaText ?? "",
    explainerCtaUrl: explainer.ctaUrl ?? "",
    comparisonEnabled: findByType(sections, "comparison")?.enabled ?? true,
    comparisonHeadline: comparison.headline ?? "",
    beforeItems: comparison.leftItems ?? comparison.beforeItems ?? [],
    afterItems: comparison.rightItems ?? comparison.afterItems ?? [],
    finalCtaEnabled: findByType(sections, "textblock")?.enabled ?? findByType(sections, "cta")?.enabled ?? true,
    finalCtaHeadline: finalCta.headline ?? cta.headline ?? "",
    finalCtaText: finalCta.ctaText ?? cta.ctaText ?? "",
    finalCtaUrl: finalCta.ctaUrl ?? cta.ctaUrl ?? "",
    bookingHeadline: booking.headline ?? "",
    bookingSubheadline: booking.subheadline ?? "",
    bookingMode: booking.bookingMode ?? "embedded_page",
    bookingExternalButtonText: booking.bookingButtonText ?? "Termin extern öffnen",
    ...(booking.bookingMode === "external_link" && bookingDefaultUrl ? { defaultCtaUrl: bookingDefaultUrl } : {}),
    footerText: footer.bodyText ?? "Tasklytic",
    primaryColor: design.primaryColor,
    accentColor: design.accentColor
  };
}

function lines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function stripDashes(value: string) {
  return value.replace(/[–—]/g, "-");
}

function renderSectionForPreview(section: LandingpageSection, prospect: LeadForTemplate, addressForm: AddressForm): LandingpageSection {
  const settings = renderSettings(applyAddressFormVariants(section.settings, addressForm), prospect, addressForm);
  return {
    ...section,
    settings,
    containers: section.containers?.map((container) => ({
      ...container,
      columns: container.columns.map((column) => ({
        ...column,
        elements: column.elements.map((element) => renderBuilderElementForPreview(element, prospect, addressForm, settings))
      }))
    }))
  };
}

function renderBuilderElementForPreview(element: BuilderElement, prospect: LeadForTemplate, addressForm: AddressForm, settings: LandingpageSectionSettings): BuilderElement {
  const addressedProps = addressBuilderElementProps(element.props ?? {}, addressForm, settings);
  const props = Object.fromEntries(
    Object.entries(addressedProps).map(([key, value]) => [
      key,
      typeof value === "string" ? resolveTemplateVariables(value, { lead: prospect, addressForm }) : value
    ])
  );
  const source = element as BuilderElement & { elements?: BuilderElement[]; children?: BuilderElement[] };
  return {
    ...element,
    editable: true,
    props,
    ...(Array.isArray(source.elements) ? { elements: source.elements.map((child) => renderBuilderElementForPreview(child, prospect, addressForm, settings)) } : {}),
    ...(Array.isArray(source.children) ? { children: source.children.map((child) => renderBuilderElementForPreview(child, prospect, addressForm, settings)) } : {})
  };
}

function addressBuilderElementProps(props: Record<string, unknown>, addressForm: AddressForm, settings: LandingpageSectionSettings) {
  const next = { ...props };
  const variantText = addressForm === "sie" ? stringProp(props.textSie) : stringProp(props.textDu);
  if (variantText) next.text = variantText;
  const field = typeof props.field === "string" ? props.field as keyof LandingpageSectionSettings : null;
  if (field && typeof settings[field] === "string") next.text = settings[field];
  if (props.itemList === "faqItems" && typeof props.itemIndex === "number") {
    const item = settings.faqItems?.[props.itemIndex];
    if (props.itemKey === "answer") next.text = item?.answer ?? next.text;
    else next.text = item?.question ?? next.text;
  }
  if (props.itemList === "benefitItems" && typeof props.itemIndex === "number") {
    const item = settings.benefitItems?.[props.itemIndex];
    next.text = props.itemKey === "text" ? item?.text ?? next.text : item?.title ?? next.text;
  }
  if ((props.itemList === "leftItems" || props.itemList === "rightItems" || props.itemList === "beforeItems" || props.itemList === "afterItems") && typeof props.itemIndex === "number") {
    const list = settings[props.itemList] ?? [];
    next.text = list[props.itemIndex] ?? next.text;
  }
  return next;
}

function renderSettings(settings: LandingpageSectionSettings, prospect: LeadForTemplate, addressForm: AddressForm): LandingpageSectionSettings {
  return {
    ...settings,
    logoText: renderText(settings.logoText, prospect, { addressForm }),
    logoImageUrl: renderText(settings.logoImageUrl, prospect, { addressForm }),
    logoAlt: renderText(settings.logoAlt, prospect, { addressForm }),
    logoUrl: renderText(settings.logoUrl, prospect, { addressForm }),
    headerLogoUrl: renderText(settings.headerLogoUrl, prospect, { addressForm }),
    headerLogoAlt: renderText(settings.headerLogoAlt, prospect, { addressForm }),
    headerTextFallback: renderText(settings.headerTextFallback, prospect, { addressForm }),
    menuItem1Text: renderText(settings.menuItem1Text, prospect, { addressForm }),
    menuItem2Text: renderText(settings.menuItem2Text, prospect, { addressForm }),
    menuItem3Text: renderText(settings.menuItem3Text, prospect, { addressForm }),
    headerCtaText: renderText(settings.headerCtaText, prospect, { addressForm }),
    headerCtaUrl: renderText(settings.headerCtaUrl, prospect, { addressForm }),
    headline: renderText(settings.headline, prospect, { addressForm }),
    subheadline: renderText(settings.subheadline, prospect, { addressForm }),
    bodyText: renderText(settings.bodyText, prospect, { addressForm }),
    ctaText: renderText(settings.ctaText, prospect, { addressForm }),
    ctaUrl: renderText(settings.ctaUrl, prospect, { addressForm }),
    videoUrl: renderText(settings.videoUrl, prospect, { addressForm }),
    thumbnailUrl: renderText(settings.thumbnailUrl, prospect, { addressForm }),
    videoLabel: renderText(settings.videoLabel, prospect, { addressForm }),
    bookingCalendarId: renderText(settings.bookingCalendarId, prospect, { addressForm }),
    bookingCalendarName: renderText(settings.bookingCalendarName, prospect, { addressForm }),
    bookingUrl: renderText(settings.bookingUrl, prospect, { addressForm }),
    bookingEmbedUrl: renderText(settings.bookingEmbedUrl, prospect, { addressForm }),
    bookingEmbedCode: renderText(settings.bookingEmbedCode, prospect, { addressForm }),
    bookingTimezone: renderText(settings.bookingTimezone, prospect, { addressForm }),
    bookingButtonText: renderText(settings.bookingButtonText, prospect, { addressForm }),
    bookingThankYouUrl: renderText(settings.bookingThankYouUrl, prospect, { addressForm }),
    bookingCalendarBorderColor: renderText(settings.bookingCalendarBorderColor, prospect, { addressForm }),
    bookingCalendarBackgroundColor: renderText(settings.bookingCalendarBackgroundColor, prospect, { addressForm }),
    bookingCalendarTextColor: renderText(settings.bookingCalendarTextColor, prospect, { addressForm }),
    bookingCalendarActiveDayColor: renderText(settings.bookingCalendarActiveDayColor, prospect, { addressForm }),
    bookingCalendarActiveTextColor: renderText(settings.bookingCalendarActiveTextColor, prospect, { addressForm }),
    bookingCalendarButtonColor: renderText(settings.bookingCalendarButtonColor, prospect, { addressForm }),
    bookingCalendarButtonTextColor: renderText(settings.bookingCalendarButtonTextColor, prospect, { addressForm }),
    bookingCalendarBorderRadius: renderText(settings.bookingCalendarBorderRadius, prospect, { addressForm }),
    bookingCalendarInputRadius: renderText(settings.bookingCalendarInputRadius, prospect, { addressForm }),
    bookingCalendarInputBorderWidth: renderText(settings.bookingCalendarInputBorderWidth, prospect, { addressForm }),
    bookingCalendarWidth: renderText(settings.bookingCalendarWidth, prospect, { addressForm }),
    bookingCalendarHeight: renderText(settings.bookingCalendarHeight, prospect, { addressForm }),
    bookingCalendarSpacingTop: renderText(settings.bookingCalendarSpacingTop, prospect, { addressForm }),
    bookingCalendarSpacingBottom: renderText(settings.bookingCalendarSpacingBottom, prospect, { addressForm }),
    legalUrl: renderText(settings.legalUrl, prospect, { addressForm }),
    legalText: renderText(settings.legalText, prospect, { addressForm }),
    legalImprintText: renderText(settings.legalImprintText, prospect, { addressForm }),
    legalPrivacyText: renderText(settings.legalPrivacyText, prospect, { addressForm }),
    legalProcessingText: renderText(settings.legalProcessingText, prospect, { addressForm }),
    legalTermsText: renderText(settings.legalTermsText, prospect, { addressForm }),
    legalDisclaimerText: renderText(settings.legalDisclaimerText, prospect, { addressForm }),
    imageUrl: renderText(settings.imageUrl, prospect, { addressForm }),
    imageAlt: renderText(settings.imageAlt, prospect, { addressForm }),
    faqItems: settings.faqItems?.map((item) => ({ question: renderText(item.question, prospect, { addressForm }), answer: renderText(item.answer, prospect, { addressForm }) })),
    benefitItems: settings.benefitItems?.map((item) => ({ title: renderText(item.title, prospect, { addressForm }), text: renderText(item.text, prospect, { addressForm }) })),
    beforeItems: settings.beforeItems?.map((item) => renderText(item, prospect, { addressForm })),
    afterItems: settings.afterItems?.map((item) => renderText(item, prospect, { addressForm })),
    leftTitle: renderText(settings.leftTitle, prospect, { addressForm }),
    rightTitle: renderText(settings.rightTitle, prospect, { addressForm }),
    leftItems: settings.leftItems?.map((item) => renderText(item, prospect, { addressForm })),
    rightItems: settings.rightItems?.map((item) => renderText(item, prospect, { addressForm }))
  };
}
