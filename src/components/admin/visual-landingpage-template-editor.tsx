"use client";

import type { LandingpageTemplate, Prospect, VideoAsset } from "@prisma/client";
import { ArrowDown, ArrowUp, Bold, ChevronLeft, ChevronRight, Copy, Eye, FileText, HelpCircle, Image as ImageIcon, Italic, Laptop, LayoutTemplate, Link as LinkIcon, MoreHorizontal, MousePointerClick, Navigation, Pencil, Plus, Save, Smartphone, Sparkles, SquarePlay, Strikethrough, Tablet, Trash2, Type, Underline, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { AssetFilePicker } from "@/components/admin/asset-file-picker";
import { VideoAssetPicker } from "@/components/admin/video-asset-picker";
import { VideoPreview } from "@/components/landing/video-preview";
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

type PageTab = "landingpage" | "booking" | "thank_you" | "legal";
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
  backHref = "/admin/landingpages/templates"
}: {
  template: LandingpageTemplate;
  prospects: Prospect[];
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
  const [activeElement, setActiveElement] = useState<ActiveBuilderElement | null>(normalizedInitialSections[0] ? { sectionId: normalizedInitialSections[0].id, kind: "section" } : null);
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
      .map((section) => renderSectionForPreview({ ...section, settings: applyAddressFormVariants(section.settings, addressForm) }, activePreviewLead));
  }, [activePreviewLead, addressForm, sections]);
  const filteredBuilderElements = useMemo(() => {
    const query = elementQuery.trim().toLowerCase();
    if (!query) return builderElements;
    return builderElements.filter((element) => `${element.label} ${element.description}`.toLowerCase().includes(query));
  }, [elementQuery]);
  const activeElementStyle = useMemo(() => getActiveElementStyle(sections, activeElement), [activeElement, sections]);
  const dirty = editorSnapshot(sections, globalDesign, addressForm) !== savedSnapshot;

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
    setSections(updateLandingpageSection(sections, sectionId, { settings: { ...target.settings, ...patch } }));
  }

  function selectElement(element: ActiveBuilderElement) {
    const resolved = resolveBuilderElement(sections, element);
    setActiveId(resolved.sectionId);
    setActiveElement(selectBuilderElement(resolved));
    if (resolved.field) setEditing({ sectionId: resolved.sectionId, field: resolved.field });
    setDesignOpen(false);
  }

  function openElementPopup(element: ActiveBuilderElement) {
    selectElement(element);
    setInlinePopup("settings");
  }

function patchActiveElement(patch: Partial<LandingpageSectionSettings>) {
  if (!activeElement) return;
  if ("buttonColor" in patch || "buttonTextColor" in patch || "videoBackgroundColor" in patch) {
    console.log("color change", activeElement.elementId ?? activeElement.field ?? activeElement.sectionId, patch.buttonColor ?? patch.buttonTextColor ?? patch.videoBackgroundColor);
  }
  console.log("update element", activeElement.elementId ?? activeElement.field ?? activeElement.sectionId, patch);
  setSections((current) => patchBuilderElement(current, activeElement, patch));
}

  function patchActiveVideoElement(patch: Partial<LandingpageSectionSettings>) {
    if (!activeElement) return;
    console.log("update element", activeElement.elementId ?? activeElement.field ?? activeElement.sectionId, patch);
    const next = patchBuilderElement(sections, activeElement, patch);
    setSections(next);
    if ("videoUrl" in patch || "videoAssetId" in patch) {
      persistSections(next, patch.videoUrl ? "Video gespeichert." : "Video entfernt.");
    }
  }

function patchActiveElementStyle(patch: BuilderElementStyle) {
  if (!activeElement) return;
  if ("color" in patch || "backgroundColor" in patch) {
    console.log("color change", activeElement.elementId ?? activeElement.field ?? activeElement.sectionId, patch.color ?? patch.backgroundColor);
  }
  console.log("update element", activeElement.elementId ?? activeElement.field ?? activeElement.sectionId, patch);
  setSections((current) => patchBuilderElementStyle(current, activeElement, patch));
}

  function patchActiveText(value: string) {
    if (!activeElement) return;
    setSections((current) => {
      const resolved = resolveBuilderElement(current, activeElement);
      const section = current.find((item) => item.id === resolved.sectionId);
      const selectedElement = section ? findBuilderElementForActive(section, resolved) : undefined;
      console.log("TEXT CHANGE", {
        selectedElementId: resolved.elementId ?? resolved.field ?? resolved.sectionId,
        oldText: selectedElement?.props?.text,
        newText: value
      });
      return patchBuilderText(current, resolved, value);
    });
  }

  function patchElementText(element: ActiveBuilderElement, value: string) {
    setSections((current) => {
      const resolved = resolveBuilderElement(current, element);
      const section = current.find((item) => item.id === resolved.sectionId);
      const selectedElement = section ? findBuilderElementForActive(section, resolved) : undefined;
      console.log("TEXT CHANGE", {
        selectedElementId: resolved.elementId ?? resolved.field ?? resolved.sectionId,
        oldText: selectedElement?.props?.text,
        newText: value
      });
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
    const added = next[next.length - 1] ? ensureBuilderElementsForEditor(next[next.length - 1]) : undefined;
    const withoutAdded = next.slice(0, -1);
    const activeIndex = withoutAdded.findIndex((section) => section.id === activeId);
    const insertIndex = activeIndex >= 0 ? activeIndex + 1 : withoutAdded.length;
    const ordered = added ? [...withoutAdded.slice(0, insertIndex), added, ...withoutAdded.slice(insertIndex)] : withoutAdded;
    replaceSections(ordered);
    setActiveId(added?.id ?? "");
    setActiveElement(added ? defaultActiveElementForSection(added) : null);
    setActiveTab(type === "booking" ? "booking" : "landingpage");
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
      console.log("SAVE PAYLOAD ELEMENTS", nextSections);
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
            onClick={() => {
              const previewUrl = `/admin/landingpages/templates/${template.id}/preview`;
              console.log("opening preview", { templateId: template.id, previewUrl });
            }}
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
        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--editor-border)] bg-[var(--editor-sidebar-bg)] p-4 text-[var(--editor-text)]">
          <div className={`flex items-center ${leftPanelCollapsed ? "justify-center" : "justify-between"} gap-3 px-1 py-2`}>
            {leftPanelCollapsed ? null : <h2 className="text-lg font-semibold">Vorlage bearbeiten</h2>}
            <button type="button" onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)} className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--editor-card-bg)] text-[var(--editor-text)] hover:bg-[var(--editor-card-hover-bg)]" aria-label="Sidebar einklappen">
              {leftPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          {leftPanelCollapsed ? (
            <div ref={leftSidebarScrollRef} className="mt-5 grid min-h-0 flex-1 gap-2 overflow-y-auto pb-24">
              {visibleBuilderSections(sections).map((section) => (
                <button key={section.id} type="button" data-builder-tree-key={`${section.id}-section`} title={sectionNames[section.type]} onClick={() => selectElement({ sectionId: section.id, kind: "section" })} className={`grid h-11 w-11 place-items-center rounded-xl ${section.id === activeId ? "bg-[var(--editor-active-bg)] text-[var(--editor-active-text)]" : "bg-[var(--editor-card-bg)] text-[var(--editor-muted-text)] hover:bg-[var(--editor-card-hover-bg)]"}`}>
                  {sectionIcon(section.type)}
                </button>
              ))}
              <button type="button" onClick={() => setAddModalOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--editor-active-bg)] text-[var(--editor-active-text)]"><Plus className="h-4 w-4" /></button>
            </div>
          ) : (
            <div ref={leftSidebarScrollRef} className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 pb-24">
              <div className="space-y-2">
                {visibleBuilderSections(sections).map((section) => (
                  <ElementTreeSection
                    key={section.id}
                    section={section}
                    activeElement={activeElement}
                    onSelect={(element) => {
                      selectElement(element);
                      setActiveTab(section.type === "booking" ? "booking" : "landingpage");
                    }}
                    onDragStart={() => setDraggedSectionId(section.id)}
                    onDrop={() => reorderSection(section.id)}
                    onMoveUp={() => replaceSections(moveLandingpageSection(sections, section.id, "up"))}
                    onMoveDown={() => replaceSections(moveLandingpageSection(sections, section.id, "down"))}
                    onDuplicate={() => duplicateSection(section)}
                    onDelete={() => {
                      if (window.confirm(`${sectionNames[section.type]} wirklich löschen?`)) replaceSections(deleteLandingpageSection(sections, section.id));
                    }}
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
            onTabChange={setActiveTab}
          />
          {message ? <div className="mx-5 mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100">{message}</div> : null}
          <div className="relative min-h-0 flex-1 overflow-auto px-4 py-6 pb-24 lg:px-6">
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
              sections={renderedSections}
              activeElement={activeElement}
              onEdit={(sectionId, field, kind = "text") => selectElement({ sectionId, field, kind })}
              onOpenPopup={(element) => openElementPopup(element)}
              onDuplicate={duplicateActiveElement}
              onDelete={deleteActiveElement}
              onMove={moveSectionById}
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
                aiPreview={aiPreview}
                device={device}
                onAcceptAi={() => {
                  if (!aiPreview || !activeSection) return;
                  patchSettings(activeSection.id, aiPreview);
                  setAiPreview(null);
                }}
                onRejectAi={() => setAiPreview(null)}
                onDelete={() => {
                  if (!activeSection || !window.confirm(`${sectionNames[activeSection.type]} wirklich löschen?`)) return;
                  replaceSections(deleteLandingpageSection(sections, activeSection.id));
                }}
                onDuplicate={() => activeSection ? duplicateSection(activeSection) : undefined}
                onMoveDown={() => activeSection ? replaceSections(moveLandingpageSection(sections, activeSection.id, "down")) : undefined}
                onMoveUp={() => activeSection ? replaceSections(moveLandingpageSection(sections, activeSection.id, "up")) : undefined}
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

function SectionListItem({
  section,
  index,
  active,
  onDragStart,
  onDrop,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete
}: {
  section: LandingpageSection;
  index: number;
  active: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={`group rounded-xl border p-2 transition ${active ? "border-[var(--editor-active-bg)] bg-[var(--editor-active-bg)]/15" : "border-[var(--editor-border)] bg-[var(--editor-card-bg)] hover:bg-[var(--editor-card-hover-bg)]"}`}
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${active ? "bg-[var(--editor-active-bg)] text-[var(--editor-active-text)]" : "bg-[var(--editor-card-bg)] text-[var(--editor-muted-text)]"}`}>{index + 1}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--editor-text)]">{sectionNames[section.type]}</span>
            <span className="text-xs text-[var(--editor-muted-text)]">{section.enabled ? "aktiv" : "inaktiv"}</span>
          </span>
        </button>
        <TreeActionMenu onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </div>
  );
}

function TreeActionMenu({ onMoveUp, onMoveDown, onDuplicate, onDelete }: { onMoveUp: () => void; onMoveDown: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return undefined;
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const preferredLeft = rect.right + 8;
      const maxLeft = window.innerWidth - 188;
      setPosition({
        position: "fixed",
        left: Math.max(8, Math.min(preferredLeft, maxLeft)),
        top: Math.min(rect.top, window.innerHeight - 178)
      });
    }
    function close() {
      setOpen(false);
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("click", close);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("click", close);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--editor-muted-text)] hover:bg-[var(--editor-card-hover-bg)]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          style={position}
          onClick={(event) => event.stopPropagation()}
          className="menu z-[9999] min-w-[180px] whitespace-nowrap rounded-xl border border-[var(--editor-border)] bg-[var(--editor-menu-bg)] p-1 shadow-xl"
        >
          <MenuButton onClick={() => run(onMoveUp)}>Nach oben</MenuButton>
          <MenuButton onClick={() => run(onMoveDown)}>Nach unten</MenuButton>
          <MenuButton onClick={() => run(onDuplicate)}>Duplizieren</MenuButton>
          <MenuButton onClick={() => run(onDelete)} danger>Löschen</MenuButton>
        </div>
      ) : null}
    </div>
  );
}

function ElementTreeSection({
  section,
  activeElement,
  onSelect,
  onDragStart,
  onDrop,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete
}: {
  section: LandingpageSection;
  activeElement: ActiveBuilderElement | null;
  onSelect: (element: ActiveBuilderElement) => void;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
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
        <TreeActionMenu onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDuplicate={onDuplicate} onDelete={onDelete} />
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
  onPatchElementText,
  onPatchSettings,
  onSelect
}: {
  activeId: string;
  activeElement: ActiveBuilderElement | null;
  activeTab: PageTab;
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
  onPatchElementText: (element: ActiveBuilderElement, value: string) => void;
  onPatchSettings: (sectionId: string, patch: Partial<LandingpageSectionSettings>) => void;
  onSelect: (sectionId: string) => void;
}) {
  const width = devicePreviewWidth(device);
  const selectedSection = sections.find((section) => section.id === activeId);
  return (
    <div className="min-h-[520px] overflow-x-auto rounded-[28px] bg-[#dfe4ed] p-4 shadow-inner transition sm:min-h-[680px] sm:p-8">
      <div className="mx-auto mb-4 flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm" style={{ maxWidth: width }}>
        <span className="min-w-0 truncate">
          {selectedSection ? `${sectionNames[selectedSection.type]} ausgewählt` : "Element anklicken zum Bearbeiten"}
        </span>
        <span>{width}px</span>
      </div>
      <div className="mx-auto overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 transition-all duration-200" style={{ width, maxWidth: "100%", fontFamily: globalDesign.fontFamily }}>
        {activeTab === "landingpage" ? (
          sections
            .filter((section) => !["booking", "thank_you", "legal", "personal_video"].includes(section.type))
            .map((section) => (
              <CanvasSection
                key={section.id}
                section={section}
                active={activeId === section.id}
                activeElement={activeElement}
                device={device}
                editing={editing}
                globalDesign={globalDesign}
                onEdit={onEdit}
                onOpenPopup={onOpenPopup}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onMove={onMove}
                onPatchElementText={onPatchElementText}
                onPatchSettings={onPatchSettings}
                onSelect={onSelect}
              />
            ))
        ) : null}
        {activeTab === "booking" ? <BookingPreview globalDesign={globalDesign} prospect={prospect} section={findByType(sections, "booking")} /> : null}
        {activeTab === "thank_you" ? <ThankYouPreview prospect={prospect} section={findByType(sections, "thank_you")} /> : null}
        {activeTab === "legal" ? <LegalPreview section={findByType(sections, "legal")} /> : null}
      </div>
    </div>
  );
}

function CanvasSection({
  section,
  active,
  activeElement,
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
    backgroundColor: settings.backgroundColor || "white",
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
    <section onClick={() => onSelect(section.id)} className={`relative outline outline-1 outline-offset-0 ${hidden ? "opacity-35" : ""} ${active && activeElement?.kind === "section" ? "outline-2 outline-offset-[3px] outline-[#4f46e5]" : "outline-transparent hover:outline-[#93c5fd]"}`} style={style}>
      {active && activeElement?.kind === "section" ? <SelectionLabel label={elementSelectionLabel(section, activeElement)} /> : null}
      {section.type === "header" ? <HeaderSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "headerCtaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} device={device} /> : null}
      {section.type === "hero" ? <HeroSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} device={device} /> : null}
      {section.type === "explainer_video" ? <ExplainerSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
      {section.type === "comparison" ? <ComparisonSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: "text", elementId: findBuilderElementByField(section, field)?.id }, value)} onPatchSettings={onPatchSettings} device={device} /> : null}
      {section.type === "cta" || section.type === "cta_button" ? <CtaSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
      {section.type === "image" || section.type === "video" || section.type === "benefits" || section.type === "divider" || section.type === "spacer" ? <ElementSection section={section} activeElement={activeElement} globalDesign={globalDesign} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: "text", elementId: findBuilderElementByField(section, field)?.id }, value)} device={device} /> : null}
      {section.type === "approach" || section.type === "faq" || section.type === "textblock" || section.type === "footer" ? <SimpleSection section={section} activeElement={activeElement} globalDesign={globalDesign} device={device} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onPatchSettings={onPatchSettings} onPatchElementText={onPatchElementText} onInlineChange={(field, value) => onPatchElementText({ sectionId: section.id, field, kind: field === "ctaText" ? "button" : "text", elementId: findBuilderElementByField(section, field)?.id }, value)} /> : null}
    </section>
  );
}

function SelectionLabel({ label }: { label: string }) {
  return <span className="absolute right-3 top-3 z-10 rounded-md bg-[#2563eb] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">{label}</span>;
}

function HeaderSection({ section, activeElement, globalDesign, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange, device }: CanvasChildProps & { device: Device }) {
  const settings = section.settings;
  const centered = settings.headerLogoPosition === "center" || settings.headerAlignment === "center";
  const justify = centered ? "justify-center" : settings.headerAlignment === "right" ? "justify-end" : "justify-between";
  const logoWidth = Number(settings.headerLogoWidth || 140);
  const logoHeight = Number(settings.headerLogoHeight || 0);
  const headerButtonSelected = isActiveButton(activeElement, section.id, "headerCtaText");
  const logoElement: ActiveBuilderElement = { sectionId: section.id, field: "headerLogoUrl", kind: "link", elementId: findBuilderElementByField(section, "headerLogoUrl")?.id };
  return (
    <div className={`mx-auto flex max-w-6xl ${device === "mobile" ? "flex-wrap gap-3 py-3" : "items-center gap-6 py-5"} ${justify}`}>
      <ElementChrome selected={isSameElement(activeElement, logoElement)} element={logoElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}>
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(section.id, "headerLogoUrl", "link"); }} className="text-left text-xl font-bold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#6556ff]">
          {settings.headerLogoUrl || settings.logoUrl ? <img src={settings.headerLogoUrl || settings.logoUrl} alt={settings.headerLogoAlt || "Logo"} className="max-h-10 w-auto object-contain" style={{ width: logoWidth || undefined, height: logoHeight || undefined }} /> : settings.headerShowTextFallback === false ? null : settings.headerTextFallback || "Tasklytic"}
        </button>
      </ElementChrome>
      <nav className={`${device === "mobile" ? "hidden" : "hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex"}`}>
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
      <ButtonBlock section={section} field="headerCtaText" selected={headerButtonSelected} text={settings.headerCtaText || "Lass uns sprechen"} globalDesign={globalDesign} activeElement={activeElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
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
      <EditableText section={section} activeElement={activeElement} field="headline" device={device} className={`${device === "mobile" ? "text-3xl" : "text-5xl"} font-semibold leading-tight text-slate-950`} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      <EditableText section={section} activeElement={activeElement} field="bodyText" device={device} className={`${device === "mobile" ? "mt-4 text-base leading-7" : "mt-5 text-lg leading-8"} text-slate-600`} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.bodyText}</EditableText>
      <ButtonAlign settings={settings} className="mt-7">
        <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText || "Gratis Termin vereinbaren"} globalDesign={globalDesign} activeElement={activeElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
      </ButtonAlign>
    </div>
  );
  return <div className={`mx-auto grid max-w-6xl ${device === "mobile" ? "gap-6 py-5" : "gap-10 py-8 lg:grid-cols-[1fr_0.9fr]"}`}>{videoFirst && device !== "mobile" ? video : copy}{videoFirst && device !== "mobile" ? copy : video}</div>;
}

function ExplainerSection({ section, activeElement, globalDesign, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange }: CanvasChildProps) {
  const settings = section.settings;
  const buttonSelected = isActiveButton(activeElement, section.id, "ctaText");
  return (
    <div className="mx-auto max-w-5xl py-4 text-center">
      <EditableText section={section} activeElement={activeElement} field="headline" className="mx-auto max-w-4xl text-4xl font-semibold leading-tight text-slate-950" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      <EditableText section={section} activeElement={activeElement} field="subheadline" className="mx-auto mt-5 inline-block rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.subheadline || "Schau dir das kurz an!"}</EditableText>
        {settings.showArrowEmoji === false ? null : <div className="mt-4 text-3xl">↓</div>}
      <ElementChrome selected={isSameElement(activeElement, { sectionId: section.id, field: "videoUrl", kind: "video", elementId: findBuilderElementByField(section, "videoUrl")?.id })} element={{ sectionId: section.id, field: "videoUrl", kind: "video", elementId: findBuilderElementByField(section, "videoUrl")?.id }} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}><div role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onEdit(section.id, "videoUrl", "video"); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onEdit(section.id, "videoUrl", "video"); }} className="mx-auto mt-7 block max-w-4xl rounded-[28px] text-left outline-none"><VideoBox settings={settings} elementStyle={findBuilderElementByField(section, "videoUrl")?.style} globalDesign={globalDesign} label={settings.buttonText || "Video ansehen"} large /></div></ElementChrome>
      <ButtonAlign settings={settings} className="mt-7">
        <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText || "Jetzt Abläufe gemeinsam durchgehen"} globalDesign={globalDesign} activeElement={activeElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
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
      <EditableText section={section} activeElement={activeElement} field="headline" className={`${device === "mobile" ? "text-2xl" : "text-4xl"} font-semibold text-slate-950`} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      {settings.subheadline ? <EditableText section={section} activeElement={activeElement} field="subheadline" className="mt-3 text-lg leading-7 text-slate-600" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.subheadline}</EditableText> : null}
      <div className={`mt-7 grid gap-5 ${device === "mobile" ? "" : "md:grid-cols-2"}`}>
        <CompareCard section={section} activeElement={activeElement} listName="leftItems" title={settings.leftTitle || "Vorher"} tone="bad" items={beforeItems} globalDesign={globalDesign} onOpenPopup={onOpenPopup} onEdit={onEdit} onDuplicate={onDuplicate} onDeleteElement={onDelete} onMove={onMove} onAdd={() => onPatchSettings(section.id, { leftItems: [...beforeItems, "Neuer Punkt"], beforeItems: [...beforeItems, "Neuer Punkt"] })} onDelete={(index) => onPatchSettings(section.id, { leftItems: beforeItems.filter((_, itemIndex) => itemIndex !== index), beforeItems: beforeItems.filter((_, itemIndex) => itemIndex !== index) })} onChange={(index, value) => onPatchSettings(section.id, { leftItems: beforeItems.map((item, itemIndex) => itemIndex === index ? value : item), beforeItems: beforeItems.map((item, itemIndex) => itemIndex === index ? value : item) })} />
        <CompareCard section={section} activeElement={activeElement} listName="rightItems" title={settings.rightTitle || "Nachher"} tone="good" items={afterItems} globalDesign={globalDesign} onOpenPopup={onOpenPopup} onEdit={onEdit} onDuplicate={onDuplicate} onDeleteElement={onDelete} onMove={onMove} onAdd={() => onPatchSettings(section.id, { rightItems: [...afterItems, "Neuer Punkt"], afterItems: [...afterItems, "Neuer Punkt"] })} onDelete={(index) => onPatchSettings(section.id, { rightItems: afterItems.filter((_, itemIndex) => itemIndex !== index), afterItems: afterItems.filter((_, itemIndex) => itemIndex !== index) })} onChange={(index, value) => onPatchSettings(section.id, { rightItems: afterItems.map((item, itemIndex) => itemIndex === index ? value : item), afterItems: afterItems.map((item, itemIndex) => itemIndex === index ? value : item) })} />
      </div>
    </div>
  );
}

function CtaSection({ section, activeElement, globalDesign, onEdit, onOpenPopup, onDuplicate, onDelete, onMove, onInlineChange }: CanvasChildProps) {
  const settings = section.settings;
  const buttonSelected = isActiveButton(activeElement, section.id, "ctaText");
  return (
    <div className="mx-auto max-w-5xl rounded-[28px] bg-slate-950 px-8 py-10 text-center text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
      <EditableText section={section} activeElement={activeElement} field="headline" className="text-4xl font-semibold leading-tight" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      <EditableText section={section} activeElement={activeElement} field="bodyText" className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/70" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.bodyText}</EditableText>
      <div className="mx-auto my-7 h-px max-w-lg bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <ButtonAlign settings={settings}>
        <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText || "Gratis Termin vereinbaren"} globalDesign={globalDesign} activeElement={activeElement} fallbackColor={globalDesign.accentColor} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
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
        <EditableText section={section} activeElement={activeElement} field="headline" className="text-3xl font-semibold text-slate-950" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "FAQ"}</EditableText>
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
      <EditableText section={section} activeElement={activeElement} field="headline" className="text-3xl font-semibold text-slate-950" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText>
      <EditableText section={section} activeElement={activeElement} field="bodyText" className="mt-4 text-base leading-7 text-slate-600" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.bodyText}</EditableText>
      {settings.ctaText ? (
        <ButtonAlign settings={settings} className="mt-5">
          <ButtonBlock section={section} field="ctaText" selected={buttonSelected} text={settings.ctaText} globalDesign={globalDesign} activeElement={activeElement} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange} />
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
        {settings.headline ? <EditableText section={section} activeElement={activeElement} field="headline" className="mb-5 text-3xl font-semibold text-slate-950" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline}</EditableText> : null}
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(section.id, "imageUrl", "link"); }} className="block w-full overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#6556ff]">
          {settings.imageUrl ? <img src={settings.imageUrl} alt={settings.imageAlt || ""} className="h-auto w-full object-cover" /> : <span className="grid min-h-56 place-items-center text-sm font-semibold text-slate-500">Bild auswählen</span>}
        </button>
      </div>
    );
  }
  if (section.type === "video") {
    return (
      <div className="mx-auto max-w-4xl text-center">
        <EditableText section={section} activeElement={activeElement} field="headline" className="text-3xl font-semibold text-slate-950" onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "Video"}</EditableText>
        <ElementChrome selected={isSameElement(activeElement, { sectionId: section.id, field: "videoUrl", kind: "video", elementId: findBuilderElementByField(section, "videoUrl")?.id })} element={{ sectionId: section.id, field: "videoUrl", kind: "video", elementId: findBuilderElementByField(section, "videoUrl")?.id }} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}><div role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onEdit(section.id, "videoUrl", "video"); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onEdit(section.id, "videoUrl", "video"); }} className="mt-6 block w-full rounded-[28px] text-left outline-none"><VideoBox settings={settings} elementStyle={findBuilderElementByField(section, "videoUrl")?.style} globalDesign={globalDesign} label={settings.buttonText || "Video ansehen"} large /></div></ElementChrome>
      </div>
    );
  }
  if (section.type === "benefits") {
    return (
      <div className="mx-auto max-w-6xl">
        <EditableText section={section} activeElement={activeElement} field="headline" className={`${device === "mobile" ? "text-2xl" : "text-4xl"} font-semibold text-slate-950`} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove} onInlineChange={onInlineChange}>{settings.headline || "Vorteile"}</EditableText>
        <div className={`mt-6 grid gap-4 ${device === "mobile" ? "" : "md:grid-cols-3"}`}>
          {(settings.benefitItems ?? []).map((item, index) => (
            <ElementChrome key={`${item.title}-${index}`} selected={isSameElement(activeElement, { sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: "title" })} element={{ sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: "title" }} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDelete} onMove={onMove}>
              <div className="rounded-2xl bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.09)]" style={{ borderRadius: globalDesign.cardRadius }}>
                <h3
                  role="textbox"
                  tabIndex={0}
                  contentEditable
                  suppressContentEditableWarning
                  className="rounded-lg font-semibold text-slate-950 outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff]"
                  onClick={(event) => { event.stopPropagation(); onOpenPopup({ sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: "title" }); }}
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
                  className="mt-2 rounded-lg text-sm leading-6 text-slate-600 outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff]"
                  onClick={(event) => { event.stopPropagation(); onOpenPopup({ sectionId: section.id, kind: "list_item", itemList: "benefitItems", itemIndex: index, itemKey: "text" }); }}
                  onInput={(event) => {
                    const items = settings.benefitItems ?? [];
                    onPatchSettings?.(section.id, { benefitItems: items.map((benefit, itemIndex) => itemIndex === index ? { ...benefit, text: event.currentTarget.textContent ?? "" } : benefit) });
                  }}
                >
                  {item.text}
                </p>
              </div>
            </ElementChrome>
          ))}
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
        className={`block w-full rounded-xl border border-transparent p-1 text-left outline-none hover:border-[#6556ff] hover:bg-[#6556ff]/5 focus-visible:border-[#6556ff] focus-visible:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff] ${className}`}
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
  onOpenPopup,
  onDuplicate,
  onDelete,
  onMove
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
  const chromeRef = useRef<HTMLSpanElement | null>(null);
  const [toolbarPlacement, setToolbarPlacement] = useState<"top" | "bottom">("top");

  useLayoutEffect(() => {
    if (!selected) return undefined;
    function updatePlacement() {
      const rect = chromeRef.current?.getBoundingClientRect();
      if (!rect) return;
      setToolbarPlacement(rect.top < 58 ? "bottom" : "top");
    }
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [selected]);

  return (
    <span ref={chromeRef} className={`group/element relative block rounded-[18px] ${selected ? "outline outline-2 outline-offset-[3px] outline-[#4f46e5]" : ""}`} onClick={(event) => {
      event.stopPropagation();
      if (element.field) onEdit(element.sectionId, element.field, element.kind);
      else onOpenPopup(element);
    }}>
      {children}
      {selected ? (
        <span className={`pointer-events-none absolute right-0 z-50 inline-flex items-center gap-0.5 rounded-[10px] border border-slate-200 bg-white p-1 text-slate-700 shadow-xl ${toolbarPlacement === "top" ? "top-0 -translate-y-[calc(100%+10px)]" : "bottom-0 translate-y-[calc(100%+10px)]"}`}>
          <InlineToolButton label="Bearbeiten" onClick={() => onOpenPopup(element)}><Pencil className="h-3.5 w-3.5" /></InlineToolButton>
          <InlineToolButton label="Duplizieren" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></InlineToolButton>
          <InlineToolButton label="Löschen" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></InlineToolButton>
          <InlineToolButton label="Hoch" onClick={() => onMove(element.sectionId, "up")}><ArrowUp className="h-3.5 w-3.5" /></InlineToolButton>
          <InlineToolButton label="Runter" onClick={() => onMove(element.sectionId, "down")}><ArrowDown className="h-3.5 w-3.5" /></InlineToolButton>
        </span>
      ) : null}
    </span>
  );
}

function InlineToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={(event) => { event.stopPropagation(); onClick(); }} className="pointer-events-auto grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100">{children}</button>;
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
  const style = buttonInlineStyle(settings, globalDesign, fallbackColor, element);
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
    <span className={`relative inline-flex max-w-full ${widthMode === "full" ? "w-full" : ""} ${selected ? "rounded-[16px] outline outline-1 outline-offset-2 outline-[#2563eb]" : ""}`}>
      {children}
      {selected ? <SelectionLabel label="Button" /> : null}
    </span>
  );
}

function buttonInlineStyle(settings: LandingpageSectionSettings, globalDesign: GlobalLandingpageDesign, fallbackColor?: string, element?: ReturnType<typeof findBuilderElementByField>): CSSProperties {
  const props = element?.props ?? {};
  const elementStyle = element?.style ?? {};
  const y = Number(props.paddingY ?? settings.buttonPaddingY ?? 12);
  const x = Number(props.paddingX ?? settings.buttonPaddingX ?? 24);
  const customWidth = Number(elementStyle.width ?? props.customWidth ?? settings.buttonCustomWidth ?? 220);
  const widthMode = props.widthMode ?? settings.buttonWidthMode ?? "auto";
  const borderWidth = Number(settings.buttonBorderWidth ?? settings.borderWidth ?? 0);
  const fontSize = Number(elementStyle.fontSize ?? props.fontSize ?? settings.buttonFontSize ?? settings.style?.desktop?.buttonFontSize ?? 14);
  const marginTop = Number(settings.buttonMarginTop ?? 0);
  const marginBottom = Number(settings.buttonMarginBottom ?? 0);
  return {
    backgroundColor: styleStringOrUndefined(elementStyle.backgroundColor) || stringProp(props.backgroundColor) || settings.buttonColor || fallbackColor || globalDesign.buttonColor,
    color: styleStringOrUndefined(elementStyle.color) || stringProp(props.textColor) || settings.buttonTextColor || "#ffffff",
    width: styleWidth(elementStyle.width) ?? (widthMode === "full" ? "100%" : widthMode === "custom" && Number.isFinite(customWidth) ? customWidth : "auto"),
    minWidth: 0,
    maxWidth: styleWidth(elementStyle.maxWidth) ?? "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: numericCss(elementStyle.borderRadius ?? props.borderRadius as BuilderElementStyle[string] ?? settings.buttonBorderRadius) ?? (settings.borderRadius && settings.borderRadius !== "0" ? settings.borderRadius : globalDesign.buttonRadius || 14),
    borderColor: settings.buttonBorderColor || settings.borderColor || "transparent",
    borderWidth: Number.isFinite(borderWidth) ? borderWidth : 0,
    borderStyle: "solid" as const,
    padding: `${Number.isFinite(y) ? y : 12}px ${Number.isFinite(x) ? x : 24}px`,
    fontSize: Number.isFinite(fontSize) ? fontSize : 14,
    fontWeight: Number(elementStyle.fontWeight ?? props.fontWeight ?? settings.buttonFontWeight ?? settings.fontWeight ?? 700),
    boxShadow: (props.shadow ?? settings.buttonShadow) ? "0 10px 24px rgba(15, 23, 42, 0.16)" : undefined,
    marginTop: Number.isFinite(marginTop) ? marginTop : 0,
    marginBottom: Number.isFinite(marginBottom) ? marginBottom : 0,
    textAlign: textAlignValue(elementStyle.textAlign, "center"),
    lineHeight: 1.2,
    overflowWrap: "anywhere",
    whiteSpace: "normal",
    textDecoration: "none"
  };
}

function textInlineStyle(settings: LandingpageSectionSettings, elementStyle: BuilderElementStyle | undefined, device: Device): CSSProperties {
  const responsive = getResponsiveElementStyle(elementStyle, device);
  const fontSize = Number(responsive.fontSize ?? elementStyle?.fontSize ?? settings.style?.[device]?.fontSize ?? settings.style?.desktop?.fontSize);
  const fontWeight = Number(elementStyle?.fontWeight ?? settings.fontWeight);
  const lineHeight = Number(elementStyle?.lineHeight ?? settings.lineHeight);
  return {
    color: typeof elementStyle?.color === "string" ? elementStyle.color : settings.textColor || undefined,
    fontFamily: typeof elementStyle?.fontFamily === "string" ? elementStyle.fontFamily : settings.fontFamily || undefined,
    fontSize: Number.isFinite(fontSize) ? fontSize : undefined,
    fontWeight: Number.isFinite(fontWeight) ? fontWeight : undefined,
    lineHeight: Number.isFinite(lineHeight) ? lineHeight : settings.lineHeight || undefined,
    fontStyle: elementStyle?.fontStyle === "italic" ? "italic" : undefined,
    textDecoration: typeof elementStyle?.textDecoration === "string" ? elementStyle.textDecoration : undefined,
    textAlign: textAlignValue(elementStyle?.textAlign, settings.alignment),
    backgroundColor: styleStringOrUndefined(elementStyle?.backgroundColor),
    borderRadius: numericCss(elementStyle?.borderRadius),
    width: styleWidth(elementStyle?.width),
    maxWidth: styleWidth(elementStyle?.maxWidth),
    marginTop: numericCss(elementStyle?.marginTop ?? settings.marginTop),
    marginBottom: numericCss(elementStyle?.marginBottom ?? settings.marginBottom),
    margin: numericCss(elementStyle?.margin),
    padding: numericCss(elementStyle?.padding)
  };
}

function elementInlineStyle(elementStyle: BuilderElementStyle | undefined): CSSProperties {
  return {
    color: styleStringOrUndefined(elementStyle?.color),
    backgroundColor: styleStringOrUndefined(elementStyle?.backgroundColor),
    fontSize: numericCss(elementStyle?.fontSize),
    textAlign: textAlignValue(elementStyle?.textAlign),
    borderRadius: numericCss(elementStyle?.borderRadius),
    width: styleWidth(elementStyle?.width),
    maxWidth: styleWidth(elementStyle?.maxWidth),
    padding: numericCss(elementStyle?.padding),
    margin: numericCss(elementStyle?.margin),
    overflow: elementStyle?.borderRadius !== undefined ? "hidden" : undefined
  };
}

function textAlignValue(value: BuilderElementStyle[string], fallback?: LandingpageSectionSettings["alignment"]): CSSProperties["textAlign"] {
  if (value === "left" || value === "center" || value === "right") return value;
  return fallback;
}

function getResponsiveElementStyle(style: BuilderElementStyle | undefined, device: Device): Record<string, string | number | boolean | undefined> {
  const deviceStyle = style?.[device];
  if (deviceStyle && typeof deviceStyle === "object") return deviceStyle as Record<string, string | number | boolean | undefined>;
  return {};
}

function responsiveElementPatch(style: BuilderElementStyle | undefined, device: Device, key: string, value: string | number | boolean): BuilderElementStyle {
  const deviceStyle = style?.[device] && typeof style[device] === "object" ? style[device] as Record<string, string | number | boolean | undefined> : {};
  return { [device]: { ...deviceStyle, [key]: value } };
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

function styleStringOrUndefined(value: BuilderElementStyle[string] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function styleWidth(value: BuilderElementStyle[string] | undefined) {
  if (value === undefined || value === "" || typeof value === "boolean" || typeof value === "object") return undefined;
  if (typeof value === "number") return value;
  return value;
}

function CompareCard({
  section,
  activeElement,
  listName,
  title,
  tone,
  items,
  globalDesign,
  onAdd,
  onChange,
  onDelete,
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
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onDelete: (index: number) => void;
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
        {items.map((item, index) => (
          <ElementChrome key={`${item}-${index}`} selected={isSameElement(activeElement, { sectionId: section.id, kind: "list_item", itemList: listName, itemIndex: index })} element={{ sectionId: section.id, kind: "list_item", itemList: listName, itemIndex: index }} onEdit={onEdit} onOpenPopup={onOpenPopup} onDuplicate={onDuplicate} onDelete={onDeleteElement} onMove={onMove}>
            <li className="flex items-start gap-3 text-sm text-slate-700">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${good ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{good ? "✓" : "x"}</span>
              <span
                role="textbox"
                tabIndex={0}
                contentEditable
                suppressContentEditableWarning
                className="flex-1 rounded-lg outline-none hover:bg-[#6556ff]/5 focus-visible:ring-2 focus-visible:ring-[#6556ff]"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenPopup({ sectionId: section.id, kind: "list_item", itemList: listName, itemIndex: index });
                }}
                onInput={(event) => onChange(index, event.currentTarget.textContent ?? "")}
              >
                {item}
              </span>
              <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(index); }} className="text-xs text-slate-400">Del</button>
            </li>
          </ElementChrome>
        ))}
      </ul>
      <button type="button" onClick={(event) => { event.stopPropagation(); onAdd(); }} className="mt-4 text-sm font-semibold text-[#6556ff]">Eintrag hinzufügen</button>
    </div>
  );
}

function BookingPreview({ section, prospect, globalDesign }: { section?: LandingpageSection; prospect?: Prospect; globalDesign: GlobalLandingpageDesign }) {
  const settings = section?.settings ?? {};
  const bookingUrl = settings.bookingUrl || prospect?.bookingUrl || prospect?.calendarUrl || "";
  return (
    <div className="min-h-[760px] bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <span className="text-sm font-semibold text-slate-600">← Zurück</span>
        <span className="font-bold">Tasklytic</span>
      </header>
      <section className="px-8 py-12 text-center">
        <h1 className="text-5xl font-semibold text-slate-950">{settings.headline || "Termin vereinbaren"}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{settings.subheadline || "Wähle einen passenden Zeitpunkt für unser Gespräch aus."}</p>
        <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]">
          {bookingUrl ? <iframe src={bookingUrl} title="Buchungskalender" className="h-[620px] w-full" /> : <CalendarPlaceholder globalDesign={globalDesign} />}
        </div>
      </section>
      <FooterPreview bodyText="Impressum  Datenschutz  Cookies" />
    </div>
  );
}

function CalendarPlaceholder({ globalDesign }: { globalDesign: GlobalLandingpageDesign }) {
  return (
    <div className="grid min-h-[520px] place-items-center p-8">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left">
        <div className="h-6 w-44 rounded-full bg-slate-200" />
        <div className="mt-6 grid grid-cols-7 gap-2">{Array.from({ length: 35 }).map((_, index) => <div key={index} className="aspect-square rounded-xl bg-white shadow-sm" />)}</div>
        <button type="button" className="mt-6 rounded-full px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: globalDesign.buttonColor }}>Zeit auswählen</button>
      </div>
    </div>
  );
}

function ThankYouPreview({ section, prospect }: { section?: LandingpageSection; prospect?: Prospect }) {
  const settings = section?.settings ?? {};
  return (
    <div className="grid min-h-[760px] place-items-center bg-white px-8 text-center">
      <div className="max-w-2xl">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div>
        <h1 className="mt-8 text-5xl font-semibold text-slate-950">{settings.headline || `Termin erfolgreich gebucht, ${prospect?.firstName ?? ""}!`}</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">{settings.bodyText || "Vielen Dank für deine Buchung. Du erhältst in Kürze eine Bestätigungsmail mit allen Details zu deinem Termin."}</p>
        <a href="#" className="mt-8 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">Zurück zur Startseite</a>
      </div>
    </div>
  );
}

function LegalPreview({ section }: { section?: LandingpageSection }) {
  const settings = section?.settings ?? {};
  const tabs = ["Impressum", "Datenschutz", "Cookies"];
  return (
    <div className="min-h-[760px] bg-slate-50 px-8 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex gap-2">{tabs.map((tab) => <span key={tab} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">{tab}</span>)}</div>
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-[0_18px_55px_rgba(15,23,42,0.1)]">
          {settings.legalMode === "external_link" ? (
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">Externer Link hinterlegt</h1>
              <p className="mt-3 break-all text-slate-600">{settings.legalUrl || "https://example.com/rechtliches"}</p>
              <a href={settings.legalUrl || "#"} className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">Vorschau öffnen</a>
            </div>
          ) : (
            <article className="prose max-w-none text-slate-700">
              <h1 className="text-3xl font-semibold text-slate-950">{settings.legalTab || "Rechtliches"}</h1>
              <p className="mt-4 whitespace-pre-line leading-8">{settings.legalText || "Rechtstext im Preview anzeigen."}</p>
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
  aiPreview,
  device,
  onAcceptAi,
  onDelete,
  onDuplicate,
  onRejectAi,
  onMoveDown,
  onMoveUp,
  onElementSettingsChange,
  onElementStyleChange,
  onElementTextChange,
  onSectionChange,
  onSettingsChange
}: {
  activeElement: ActiveBuilderElement | null;
  section: LandingpageSection;
  aiPreview: Record<string, string> | null;
  device: Device;
  onAcceptAi: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRejectAi: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
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
      <div className="grid grid-cols-2 gap-2">
        <MiniButton onClick={onMoveUp}>Hoch</MiniButton>
        <MiniButton onClick={onMoveDown}>Runter</MiniButton>
        <MiniButton onClick={onDuplicate}>Duplizieren</MiniButton>
        <MiniButton onClick={onDelete}>Löschen</MiniButton>
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
      {section.type === "header" ? <HeaderFields settings={settings} onChange={onSettingsChange} /> : null}
      {section.type === "hero" ? <HeroFields settings={settings} onChange={onSettingsChange} /> : null}
      {section.type === "explainer_video" ? <ExplainerFields settings={settings} onChange={onSettingsChange} /> : null}
      {section.type === "comparison" ? <ComparisonFields settings={settings} onChange={onSettingsChange} /> : null}
      {["image", "video", "cta_button", "benefits", "divider", "spacer"].includes(section.type) ? <ElementFields settings={settings} onChange={onSettingsChange} type={section.type} /> : null}
      {section.type === "booking" || section.type === "thank_you" || section.type === "legal" ? <SpecialPageFields settings={settings} onChange={onSettingsChange} type={section.type} /> : null}
      {!["header", "hero", "explainer_video", "comparison", "booking", "thank_you", "legal", "image", "video", "cta_button", "benefits", "divider", "spacer"].includes(section.type) ? <TextFields settings={settings} onChange={onSettingsChange} /> : null}
        </>
      )}
    </div>
  );
}

function HeaderFields({ settings, onChange }: FieldGroupProps) {
  return (
    <div className="space-y-3">
      <Field label="Logo URL" value={settings.headerLogoUrl ?? settings.logoUrl ?? ""} onChange={(value) => onChange({ headerLogoUrl: value, logoUrl: value })} />
      <AssetFilePicker label="Logo aus Asset Library" type="logo" onSelect={(value) => onChange({ headerLogoUrl: value, logoUrl: value })} />
      <Field label="Logo Alt Text" value={settings.headerLogoAlt ?? ""} onChange={(value) => onChange({ headerLogoAlt: value })} />
      <Field label="Logo Breite" type="number" value={settings.headerLogoWidth ?? ""} onChange={(value) => onChange({ headerLogoWidth: value })} />
      <Field label="Logo Höhe optional" type="number" value={settings.headerLogoHeight ?? ""} onChange={(value) => onChange({ headerLogoHeight: value })} />
      <Select label="Logo Position" value={settings.headerLogoPosition ?? "left"} options={["left", "center"]} onChange={(value) => onChange({ headerLogoPosition: value as LandingpageSectionSettings["headerLogoPosition"] })} />
      <Field label="Textfallback" value={settings.headerTextFallback ?? ""} onChange={(value) => onChange({ headerTextFallback: value })} />
      <Field label="Menüpunkt 1 Text" value={settings.menuItem1Text ?? ""} onChange={(value) => onChange({ menuItem1Text: value })} />
      <Field label="Menüpunkt 2 Text" value={settings.menuItem2Text ?? ""} onChange={(value) => onChange({ menuItem2Text: value })} />
      <Field label="Menüpunkt 3 Text" value={settings.menuItem3Text ?? ""} onChange={(value) => onChange({ menuItem3Text: value })} />
      <Field label="Header CTA Text" value={settings.headerCtaText ?? ""} onChange={(value) => onChange({ headerCtaText: value })} />
      <Field label="Header CTA URL" value={settings.headerCtaUrl ?? ""} onChange={(value) => onChange({ headerCtaUrl: value })} />
      <Select label="Ausrichtung" value={settings.headerAlignment ?? "left"} options={["left", "center", "right"]} onChange={(value) => onChange({ headerAlignment: value as LandingpageSectionSettings["headerAlignment"] })} />
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
  if (activeElement?.kind === "video") return "Video bearbeiten";
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
  device,
  onSettingsChange,
  onStyleChange,
  onTextChange
}: {
  element: ActiveBuilderElement;
  section: LandingpageSection;
  settings: LandingpageSectionSettings;
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
  const textFallbackSize = element.field === "headline" ? 48 : element.itemList === "faqItems" && element.itemKey === "question" ? 20 : element.itemList === "faqItems" && element.itemKey === "answer" ? 15 : 22;
  const textFallbackWeight = element.field === "headline" || element.itemKey === "question" ? 700 : 400;
  const textFallbackLineHeight = element.field === "headline" ? 1.1 : element.itemKey === "question" ? 1.3 : 1.5;
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
        <Field label="Schriftart" value={styleString(elementStyle.fontFamily, settings.fontFamily ?? "Inter")} onChange={(value) => onStyleChange({ fontFamily: value })} />
        <Field label="Schriftgröße" type="number" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).fontSize ?? elementStyle.fontSize, textFallbackSize))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "fontSize", Number(value)))} />
        <Field label="Schriftgewicht" type="number" value={String(styleNumber(elementStyle.fontWeight, textFallbackWeight))} onChange={(value) => onStyleChange({ fontWeight: Number(value) })} />
        <Field label="Zeilenhöhe" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).lineHeight ?? elementStyle.lineHeight, textFallbackLineHeight))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "lineHeight", Number(value)))} />
        <Field label="Farbe" type="color" value={styleString(elementStyle.color, settings.textColor ?? "#111827")} onChange={(value) => onStyleChange({ color: value })} />
        <Select label="Ausrichtung" value={styleString(getResponsiveElementStyle(elementStyle, device).textAlign ?? elementStyle.textAlign, settings.alignment ?? "left")} options={["left", "center", "right"]} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "textAlign", value))} />
        <Field label="Abstand oben" type="number" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).marginTop ?? elementStyle.marginTop, 0))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "marginTop", Number(value)))} />
        <Field label="Abstand unten" type="number" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).marginBottom ?? elementStyle.marginBottom, element.field === "headline" ? 24 : 0))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "marginBottom", Number(value)))} />
        <Field label="Padding" type="number" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).padding ?? elementStyle.padding, 0))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "padding", Number(value)))} />
        <Field label="Max Width" value={String(getResponsiveElementStyle(elementStyle, device).maxWidth ?? elementStyle.maxWidth ?? "")} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "maxWidth", value))} />
        <Select label="Animation" value={styleString(elementStyle.animation, "none")} options={["none", "fade", "slide", "scale", "lift"]} onChange={(value) => onStyleChange({ animation: value })} />
      </div>
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

function SpecialPageFields({ settings, onChange, type }: FieldGroupProps & { type: LandingpageSectionType }) {
  if (type === "legal") {
    return (
      <div className="space-y-3">
        <Select label="Untertab" value={settings.legalTab ?? "impressum"} options={["impressum", "datenschutz", "cookies"]} onChange={(value) => onChange({ legalTab: value as LandingpageSectionSettings["legalTab"] })} />
        <Select label="Modus" value={settings.legalMode ?? "text"} options={["text", "external_link"]} onChange={(value) => onChange({ legalMode: value as LandingpageSectionSettings["legalMode"] })} />
        <Field label="URL" value={settings.legalUrl ?? ""} onChange={(value) => onChange({ legalUrl: value })} />
        <Textarea label="Rechtstext" value={settings.legalText ?? ""} onChange={(value) => onChange({ legalText: value })} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Textarea label="Headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
      <Textarea label="Text" value={settings.bodyText ?? ""} onChange={(value) => onChange({ bodyText: value })} />
      {type === "booking" ? <Field label="bookingUrl" value={settings.bookingUrl ?? ""} onChange={(value) => onChange({ bookingUrl: value })} /> : null}
    </div>
  );
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

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block min-w-0 space-y-2"><span className="block whitespace-normal break-normal text-xs font-semibold uppercase tracking-wide text-slate-500 [overflow-wrap:normal]">{label}</span><textarea className="min-h-28 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6556ff]" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block min-w-0 space-y-2"><span className="block whitespace-normal break-normal text-xs font-semibold uppercase tracking-wide text-slate-500 [overflow-wrap:normal]">{label}</span><select className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#6556ff]" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function MiniButton({ children, onClick }: { children: string; onClick: () => void }) {
  return <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{children}</button>;
}

function MenuButton({ children, onClick, danger }: { children: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} className={`block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-semibold ${danger ? "text-red-500 hover:bg-red-500/10" : "text-[var(--editor-text)] hover:bg-[var(--editor-card-hover-bg)]"}`}>{children}</button>;
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
  device,
  onClose,
  onSettingsChange,
  onStyleChange,
  onTextChange
}: {
  activeElement: ActiveBuilderElement;
  section: LandingpageSection;
  settings: LandingpageSectionSettings;
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
        {activeElement.kind === "text" || activeElement.kind === "link" || activeElement.kind === "list_item" ? (
          <InlineTextDesignPopup activeElement={activeElement} section={section} settings={settings} device={device} onSettingsChange={onSettingsChange} onStyleChange={onStyleChange} onTextChange={onTextChange} />
        ) : activeElement.kind === "button" ? (
          <InlineButtonPopup activeElement={activeElement} section={section} settings={settings} onSettingsChange={onSettingsChange} onTextChange={onTextChange} />
        ) : activeElement.kind === "video" ? (
          <InlineVideoPopup settings={settings} onSettingsChange={onSettingsChange} />
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
        <>
          <Field label="Schriftart" value={styleString(elementStyle.fontFamily, settings.fontFamily ?? "Inter")} onChange={(value) => onStyleChange({ fontFamily: value })} />
          <Field label="Schriftgröße" type="number" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).fontSize ?? elementStyle.fontSize, activeElement.field === "headline" ? 48 : 22))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "fontSize", Number(value)))} />
          <Field label="Font Weight" type="number" value={String(styleNumber(elementStyle.fontWeight, activeElement.field === "headline" ? 700 : 400))} onChange={(value) => onStyleChange({ fontWeight: Number(value) })} />
          <Field label="Zeilenhöhe" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).lineHeight ?? elementStyle.lineHeight, activeElement.field === "headline" ? 1.1 : 1.5))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "lineHeight", Number(value)))} />
        </>
      ) : null}
      {tab === "color" ? (
        <>
          <Field label="Textfarbe" type="color" value={styleString(elementStyle.color, settings.textColor ?? "#111827")} onChange={(value) => onStyleChange({ color: value })} />
          <Select label="Ausrichtung" value={styleString(getResponsiveElementStyle(elementStyle, device).textAlign ?? elementStyle.textAlign, settings.alignment ?? "left")} options={["left", "center", "right"]} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "textAlign", value))} />
        </>
      ) : null}
      {tab === "spacing" ? (
        <>
          <Field label="Margin oben" type="number" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).marginTop ?? elementStyle.marginTop, 0))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "marginTop", Number(value)))} />
          <Field label="Margin unten" type="number" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).marginBottom ?? elementStyle.marginBottom, activeElement.field === "headline" ? 24 : 0))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "marginBottom", Number(value)))} />
          <Field label="Padding" type="number" value={String(styleNumber(getResponsiveElementStyle(elementStyle, device).padding ?? elementStyle.padding, 0))} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "padding", Number(value)))} />
          <Field label="Max Width" value={String(getResponsiveElementStyle(elementStyle, device).maxWidth ?? elementStyle.maxWidth ?? "")} onChange={(value) => onStyleChange(responsiveElementPatch(elementStyle, device, "maxWidth", value))} />
        </>
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
  if (!missing.length && !missingFaqElements.length) return section;
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
              ...missingFaqElements.map(({ index, key }) => createFaqBuilderElement(section, index, key))
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
      { field: "headerLogoUrl", type: "image" },
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
  if (section.type === "image") fields.push({ field: "imageUrl", type: "image" });
  return fields;
}

function createFieldBuilderElement(section: LandingpageSection, field: EditingField, type: BuilderElement["type"]): BuilderElement {
  const text = typeof section.settings[field] === "string" ? section.settings[field] : "";
  return {
    id: `element_${section.id}_${String(field)}`,
    type,
    props: {
      field,
      text,
      ...(type === "button" ? {
        href: field === "headerCtaText" ? section.settings.headerCtaUrl ?? "" : section.settings.ctaUrl ?? "",
        fontSize: field === "headerCtaText" || field === "ctaText" ? section.settings.buttonFontSize ?? "14" : undefined
      } : {})
    },
    style: type === "headline"
      ? { fontFamily: "Inter", fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: "#111827", textAlign: "left", marginTop: 0, marginBottom: 24, desktop: { fontSize: 48 }, tablet: { fontSize: 38 }, mobile: { fontSize: 30 } }
      : type === "text"
        ? { fontFamily: "Inter", fontSize: 22, fontWeight: 400, lineHeight: 1.5, color: "#667085", textAlign: "left", marginTop: 0, marginBottom: 0, desktop: { fontSize: 22 }, tablet: { fontSize: 20 }, mobile: { fontSize: 17 } }
        : { desktop: {}, tablet: {}, mobile: {} },
    editable: true
  };
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

function visibleBuilderSections(sections: LandingpageSection[]) {
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
    addField("headerLogoUrl", "Logo", "link", "Bild/Logo", <ImageIcon className="h-3.5 w-3.5" />);
    addField("menuItem1Text", `Navigation Link: ${section.settings.menuItem1Text || "Warum wir?"}`, "link", "Navigation Link", <Navigation className="h-3.5 w-3.5" />);
    addField("menuItem2Text", `Navigation Link: ${section.settings.menuItem2Text || "Unser Ansatz"}`, "link", "Navigation Link", <Navigation className="h-3.5 w-3.5" />);
    addField("menuItem3Text", `Navigation Link: ${section.settings.menuItem3Text || "FAQ"}`, "link", "Navigation Link", <Navigation className="h-3.5 w-3.5" />);
    addField("headerCtaText", "Header Button", "button", "Button", buttonIcon);
    return items;
  }
  if (section.settings.headline !== undefined) addField("headline", "Headline", "text", "Text", textIcon);
  if (section.settings.subheadline !== undefined) addField("subheadline", "Subheadline", "text", "Text", textIcon);
  if (section.settings.bodyText !== undefined) addField("bodyText", "Text", "text", "Textblock", textIcon);
  if (section.settings.ctaText !== undefined && section.settings.ctaText !== "") addField("ctaText", section.type === "cta_button" ? "CTA Button" : "CTA Button", "button", "Button", buttonIcon);
  if (section.settings.videoUrl !== undefined) {
    addField("videoUrl", "Video", "video", "Video", videoIcon);
    if (section.settings.videoLabel !== undefined) addField("videoLabel", "Video Label", "text", "Text", textIcon);
    if (section.settings.buttonText !== undefined) addField("buttonText", "Video Label", "text", "Text", textIcon);
  }
  if (section.type === "image") addField("imageUrl", "Bild", "link", "Bild", <ImageIcon className="h-3.5 w-3.5" />);
  (section.settings.benefitItems ?? []).forEach((_, index) => {
    items.push({ key: `${section.id}-benefit-${index}`, label: `Karte ${index + 1}`, type: "Karte", icon: <FileText className="h-3.5 w-3.5" />, element: { sectionId: section.id, kind: "list_item", itemIndex: index } });
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
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    const stored = window.localStorage.getItem(key);
    return stored === null ? initialValue : stored === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(key, String(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function builderGridVars(leftCollapsed: boolean, rightCollapsed: boolean) {
  if (leftCollapsed && rightCollapsed) return "[--builder-left:56px] [--builder-right:56px]";
  if (leftCollapsed) return "[--builder-left:56px] [--builder-right:minmax(360px,400px)]";
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

function styleString(value: BuilderElementStyle[string], fallback: string) {
  return typeof value === "string" ? value : fallback;
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

function styleNumber(value: BuilderElementStyle[string], fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function elementSelectionLabel(section: LandingpageSection, activeElement: ActiveBuilderElement | null) {
  if (activeElement?.kind === "button") return "Button";
  if (activeElement?.kind === "video") return "Video";
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
  return {
    logoUrl: header.logoUrl ?? "",
    headerLogoUrl: header.headerLogoUrl ?? header.logoUrl ?? "",
    headerLogoAlt: header.headerLogoAlt ?? "Tasklytic",
    headerLogoWidth: header.headerLogoWidth ? Number(header.headerLogoWidth) : null,
    headerLogoHeight: header.headerLogoHeight ? Number(header.headerLogoHeight) : null,
    headerLogoPosition: header.headerLogoPosition ?? "left",
    headerShowTextFallback: header.headerShowTextFallback !== false,
    headerTextFallback: header.headerTextFallback ?? "Tasklytic",
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

function renderSectionForPreview(section: LandingpageSection, prospect: LeadForTemplate): LandingpageSection {
  return {
    ...section,
    settings: renderSettings(section.settings, prospect),
    containers: section.containers?.map((container) => ({
      ...container,
      columns: container.columns.map((column) => ({
        ...column,
        elements: column.elements.map((element) => renderBuilderElementForPreview(element, prospect))
      }))
    }))
  };
}

function renderBuilderElementForPreview(element: BuilderElement, prospect: LeadForTemplate): BuilderElement {
  const props = Object.fromEntries(
    Object.entries(element.props ?? {}).map(([key, value]) => [
      key,
      typeof value === "string" ? resolveTemplateVariables(value, prospect) : value
    ])
  );
  const source = element as BuilderElement & { elements?: BuilderElement[]; children?: BuilderElement[] };
  return {
    ...element,
    editable: true,
    props,
    ...(Array.isArray(source.elements) ? { elements: source.elements.map((child) => renderBuilderElementForPreview(child, prospect)) } : {}),
    ...(Array.isArray(source.children) ? { children: source.children.map((child) => renderBuilderElementForPreview(child, prospect)) } : {})
  };
}

function renderSettings(settings: LandingpageSectionSettings, prospect: LeadForTemplate): LandingpageSectionSettings {
  return {
    ...settings,
    logoUrl: renderText(settings.logoUrl, prospect),
    headerLogoUrl: renderText(settings.headerLogoUrl, prospect),
    headerLogoAlt: renderText(settings.headerLogoAlt, prospect),
    headerTextFallback: renderText(settings.headerTextFallback, prospect),
    menuItem1Text: renderText(settings.menuItem1Text, prospect),
    menuItem2Text: renderText(settings.menuItem2Text, prospect),
    menuItem3Text: renderText(settings.menuItem3Text, prospect),
    headerCtaText: renderText(settings.headerCtaText, prospect),
    headerCtaUrl: renderText(settings.headerCtaUrl, prospect),
    headline: renderText(settings.headline, prospect),
    subheadline: renderText(settings.subheadline, prospect),
    bodyText: renderText(settings.bodyText, prospect),
    ctaText: renderText(settings.ctaText, prospect),
    ctaUrl: renderText(settings.ctaUrl, prospect),
    videoUrl: renderText(settings.videoUrl, prospect),
    thumbnailUrl: renderText(settings.thumbnailUrl, prospect),
    videoLabel: renderText(settings.videoLabel, prospect),
    bookingUrl: renderText(settings.bookingUrl, prospect),
    legalUrl: renderText(settings.legalUrl, prospect),
    legalText: renderText(settings.legalText, prospect),
    imageUrl: renderText(settings.imageUrl, prospect),
    imageAlt: renderText(settings.imageAlt, prospect),
    faqItems: settings.faqItems?.map((item) => ({ question: renderText(item.question, prospect), answer: renderText(item.answer, prospect) })),
    benefitItems: settings.benefitItems?.map((item) => ({ title: renderText(item.title, prospect), text: renderText(item.text, prospect) })),
    beforeItems: settings.beforeItems?.map((item) => renderText(item, prospect)),
    afterItems: settings.afterItems?.map((item) => renderText(item, prospect)),
    leftTitle: renderText(settings.leftTitle, prospect),
    rightTitle: renderText(settings.rightTitle, prospect),
    leftItems: settings.leftItems?.map((item) => renderText(item, prospect)),
    rightItems: settings.rightItems?.map((item) => renderText(item, prospect))
  };
}
