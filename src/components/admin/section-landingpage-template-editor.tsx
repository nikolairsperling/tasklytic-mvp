"use client";

import type { LandingpageTemplate, Prospect } from "@prisma/client";
import { useMemo, useState, useTransition } from "react";
import { VideoPreview as SharedVideoPreview } from "@/components/landing/video-preview";
import { videoPreviewPropsFromSettings } from "@/lib/landingpage/video-preview-props";
import {
  addLandingpageSection,
  deleteLandingpageSection,
  getGlobalLandingpageDesign,
  getLandingpageSections,
  landingpageSectionTypes,
  moveLandingpageSection,
  renderText,
  toggleLandingpageSection,
  type GlobalLandingpageDesign,
  type LandingpageSection,
  type LandingpageSectionSettings,
  type LandingpageSectionType,
  updateLandingpageSection
} from "@/lib/landingpage-templates";

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

export function SectionLandingpageTemplateEditor({
  template,
  prospects
}: {
  template: LandingpageTemplate;
  prospects: Prospect[];
}) {
  const [sections, setSections] = useState(() => getLandingpageSections(template));
  const [globalDesign, setGlobalDesign] = useState<GlobalLandingpageDesign>(() => getGlobalLandingpageDesign(template));
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [newType, setNewType] = useState<LandingpageSectionType>("hero");
  const [previewProspectId, setPreviewProspectId] = useState(prospects[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const previewProspect = prospects.find((prospect) => prospect.id === previewProspectId) ?? prospects[0];
  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0];
  const renderedSections = useMemo(() => {
    if (!previewProspect) return sections.filter((section) => section.enabled);
    return sections
      .filter((section) => section.enabled)
      .map((section) => ({
        ...section,
        settings: renderSettings(section.settings, previewProspect)
      }));
  }, [previewProspect, sections]);

  function replaceSections(next: LandingpageSection[]) {
    setSections(next);
    if (!next.some((section) => section.id === activeId)) setActiveId(next[0]?.id ?? "");
  }

  function patchActiveSettings(patch: Partial<LandingpageSectionSettings>) {
    if (!activeSection) return;
    setSections(updateLandingpageSection(sections, activeSection.id, {
      settings: {
        ...activeSection.settings,
        ...patch
      }
    }));
  }

  function patchActiveSection(patch: Partial<LandingpageSection>) {
    if (!activeSection) return;
    setSections(updateLandingpageSection(sections, activeSection.id, patch));
  }

  function duplicateSection(section: LandingpageSection) {
    const copy = {
      ...section,
      id: `section_${Date.now()}`,
      name: `${section.name} Kopie`,
      order: sections.length + 1
    };
    replaceSections([...sections, copy].map((item, index) => ({ ...item, order: index + 1 })));
    setActiveId(copy.id);
  }

  function save() {
    startTransition(async () => {
      const response = await fetch(`/api/landingpage-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          isDefault: template.isDefault,
          primaryColor: globalDesign.primaryColor,
          accentColor: globalDesign.accentColor,
          sectionsJson: sections,
          globalDesignJson: globalDesign
        })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "Template gespeichert." : data?.error ?? "Speichern fehlgeschlagen.");
    });
  }

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">{message}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select value={newType} onChange={(event) => setNewType(event.target.value as LandingpageSectionType)}>
              {landingpageSectionTypes.map((type) => <option key={type} value={type}>{sectionLabels[type]}</option>)}
            </select>
            <button type="button" onClick={() => {
              const next = addLandingpageSection(sections, newType);
              replaceSections(next);
              setActiveId(next[next.length - 1]?.id ?? "");
            }} className="btn-primary min-h-11 rounded-xl px-3 py-2 text-sm font-semibold">
              Abschnitt hinzufügen
            </button>
          </div>
          <div className="space-y-2">
            {sections.map((section, index) => (
              <div key={section.id} className={`rounded-xl border p-3 ${activeSection?.id === section.id ? "border-cyan-400 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}>
                <button type="button" onClick={() => setActiveId(section.id)} className="w-full text-left">
                  <span className="text-xs text-slate-500">{index + 1}. {sectionLabels[section.type]}</span>
                  <span className="block font-medium text-ink">{section.name}</span>
                  <span className="text-xs text-slate-500">{section.enabled ? "aktiv" : "deaktiviert"}</span>
                </button>
                <div className="mt-3 grid grid-cols-3 gap-1 text-xs">
                  <TinyButton onClick={() => replaceSections(moveLandingpageSection(sections, section.id, "up"))}>Hoch</TinyButton>
                  <TinyButton onClick={() => replaceSections(moveLandingpageSection(sections, section.id, "down"))}>Runter</TinyButton>
                  <TinyButton onClick={() => replaceSections(toggleLandingpageSection(sections, section.id))}>{section.enabled ? "Aus" : "Ein"}</TinyButton>
                  <TinyButton onClick={() => duplicateSection(section)}>Dupl.</TinyButton>
                  <TinyButton onClick={() => replaceSections(deleteLandingpageSection(sections, section.id))}>Löschen</TinyButton>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <label className="w-full max-w-xs">
              <span className="text-sm font-medium text-slate-500">Prospect Preview</span>
              <select value={previewProspectId} onChange={(event) => setPreviewProspectId(event.target.value)}>
                {prospects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.companyName}</option>)}
              </select>
            </label>
            <button type="button" onClick={save} disabled={isPending} className="btn-primary min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold">
              Speichern
            </button>
          </div>
          <PreviewCanvas sections={renderedSections} globalDesign={globalDesign} />
        </section>

        <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <GlobalDesignEditor design={globalDesign} onChange={setGlobalDesign} />
          {activeSection ? (
            <SectionEditor
              section={activeSection}
              onSectionChange={patchActiveSection}
              onSettingsChange={patchActiveSettings}
            />
          ) : <p className="text-sm text-slate-500">Noch kein Abschnitt vorhanden.</p>}
        </aside>
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  onSectionChange,
  onSettingsChange
}: {
  section: LandingpageSection;
  onSectionChange: (patch: Partial<LandingpageSection>) => void;
  onSettingsChange: (patch: Partial<LandingpageSectionSettings>) => void;
}) {
  const settings = section.settings;
  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      <h2 className="text-lg font-semibold text-ink">Abschnitt</h2>
      <Field label="Name" value={section.name} onChange={(value) => onSectionChange({ name: value })} />
      <label className="flex items-center gap-3 text-sm text-ink">
        <input className="w-auto" type="checkbox" checked={section.enabled} onChange={(event) => onSectionChange({ enabled: event.target.checked })} />
        Aktiv
      </label>
      <TextFields settings={settings} onChange={onSettingsChange} />
      {(section.type === "personal_video" || section.type === "explainer_video") ? <VideoFields settings={settings} onChange={onSettingsChange} /> : null}
      {(section.type === "pdf_report_download" || section.type === "print_report_cta" || section.type === "roi_report") ? <ReportFields type={section.type} settings={settings} onChange={onSettingsChange} /> : null}
      {section.type === "faq" ? <FaqFields settings={settings} onChange={onSettingsChange} /> : null}
      {section.type === "comparison" ? <ComparisonFields settings={settings} onChange={onSettingsChange} /> : null}
      <DesignFields settings={settings} onChange={onSettingsChange} />
    </div>
  );
}

function TextFields({ settings, onChange }: { settings: LandingpageSectionSettings; onChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Headline" value={settings.headline ?? ""} onChange={(value) => onChange({ headline: value })} />
      <Field label="Subheadline" value={settings.subheadline ?? ""} onChange={(value) => onChange({ subheadline: value })} />
      <Textarea label="Body Text" value={settings.bodyText ?? ""} onChange={(value) => onChange({ bodyText: value })} />
      <Field label="CTA Text" value={settings.ctaText ?? ""} onChange={(value) => onChange({ ctaText: value })} />
      <Field label="CTA URL" value={settings.ctaUrl ?? ""} onChange={(value) => onChange({ ctaUrl: value })} />
    </div>
  );
}

function VideoFields({ settings, onChange }: { settings: LandingpageSectionSettings; onChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Video URL" value={settings.videoUrl ?? ""} onChange={(value) => onChange({ videoUrl: value })} />
      <Field label="Thumbnail URL" value={settings.thumbnailUrl ?? ""} onChange={(value) => onChange({ thumbnailUrl: value })} />
      <Field label="Button Text" value={settings.buttonText ?? ""} onChange={(value) => onChange({ buttonText: value })} />
      <Select label="Position" value={settings.position ?? "right"} options={["left", "right", "bottom"]} onChange={(value) => onChange({ position: value })} />
    </div>
  );
}

function ReportFields({ type, settings, onChange }: { type: LandingpageSectionType; settings: LandingpageSectionSettings; onChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-3">
      <Field label="Report Titel" value={settings.reportTitle ?? ""} onChange={(value) => onChange({ reportTitle: value })} />
      <Textarea label="Report Beschreibung" value={settings.reportDescription ?? ""} onChange={(value) => onChange({ reportDescription: value })} />
      <Field label="Button Text" value={settings.reportButtonText ?? ""} onChange={(value) => onChange({ reportButtonText: value })} />
      <label className="flex items-center gap-3 text-sm text-ink">
        <input className="w-auto" type="checkbox" checked={settings.reportShowIcon !== false} onChange={(event) => onChange({ reportShowIcon: event.target.checked })} />
        Icon anzeigen
      </label>
      <label className="flex items-center gap-3 text-sm text-ink">
        <input className="w-auto" type="checkbox" checked={settings.reportShowQrCode === true} onChange={(event) => onChange({ reportShowQrCode: event.target.checked })} />
        QR-Code anzeigen
      </label>
      {type === "roi_report" ? (
        <div className="grid gap-3 border-t border-white/10 pt-3">
          <Field label="Fahrzeuge" value={settings.roiVehicles ?? ""} onChange={(value) => onChange({ roiVehicles: value })} />
          <Field label="Disponenten" value={settings.roiDispatchers ?? ""} onChange={(value) => onChange({ roiDispatchers: value })} />
          <Field label="Aufträge pro Tag" value={settings.roiOrdersPerDay ?? ""} onChange={(value) => onChange({ roiOrdersPerDay: value })} />
          <Field label="Geschätzter manueller Aufwand" value={settings.roiManualEffort ?? ""} onChange={(value) => onChange({ roiManualEffort: value })} />
          <Field label="Geschätzter Monatsverlust" value={settings.roiMonthlyLoss ?? ""} onChange={(value) => onChange({ roiMonthlyLoss: value })} />
        </div>
      ) : null}
    </div>
  );
}

function FaqFields({ settings, onChange }: { settings: LandingpageSectionSettings; onChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  const items = settings.faqItems ?? [];
  return (
    <div className="space-y-3">
      <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-ink" onClick={() => onChange({ faqItems: [...items, { question: "", answer: "" }] })}>
        Frage hinzufügen
      </button>
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-white/10 p-3">
          <Field label="Frage" value={item.question} onChange={(value) => onChange({ faqItems: items.map((faq, i) => i === index ? { ...faq, question: value } : faq) })} />
          <Textarea label="Antwort" value={item.answer} onChange={(value) => onChange({ faqItems: items.map((faq, i) => i === index ? { ...faq, answer: value } : faq) })} />
          <TinyButton onClick={() => onChange({ faqItems: items.filter((_, i) => i !== index) })}>Löschen</TinyButton>
        </div>
      ))}
    </div>
  );
}

function ComparisonFields({ settings, onChange }: { settings: LandingpageSectionSettings; onChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  return (
    <div className="space-y-3">
      <Textarea label="Linke Liste" value={(settings.beforeItems ?? []).join("\n")} onChange={(value) => onChange({ beforeItems: lines(value) })} />
      <Textarea label="Rechte Liste" value={(settings.afterItems ?? []).join("\n")} onChange={(value) => onChange({ afterItems: lines(value) })} />
    </div>
  );
}

function DesignFields({ settings, onChange }: { settings: LandingpageSectionSettings; onChange: (patch: Partial<LandingpageSectionSettings>) => void }) {
  return (
    <div className="grid gap-3 border-t border-white/10 pt-4">
      <Field label="Schriftart" value={settings.fontFamily ?? "Inter"} onChange={(value) => onChange({ fontFamily: value })} />
      <Select label="Headline-Größe" value={settings.headlineSize ?? "large"} options={["small", "normal", "large"]} onChange={(value) => onChange({ headlineSize: value as LandingpageSectionSettings["headlineSize"] })} />
      <Select label="Textgröße" value={settings.textSize ?? "normal"} options={["small", "normal", "large"]} onChange={(value) => onChange({ textSize: value as LandingpageSectionSettings["textSize"] })} />
      <Select label="Textausrichtung" value={settings.alignment ?? "left"} options={["left", "center", "right"]} onChange={(value) => onChange({ alignment: value as LandingpageSectionSettings["alignment"] })} />
      <Field label="Hintergrundfarbe" value={settings.backgroundColor ?? "#ffffff"} onChange={(value) => onChange({ backgroundColor: value })} type="color" />
      <Field label="Textfarbe" value={settings.textColor ?? "#111827"} onChange={(value) => onChange({ textColor: value })} type="color" />
      <Field label="Button-Farbe" value={settings.buttonColor ?? "#24324a"} onChange={(value) => onChange({ buttonColor: value })} type="color" />
      <Field label="Abstand oben" value={settings.spacingTop ?? "48"} onChange={(value) => onChange({ spacingTop: value })} type="number" />
      <Field label="Abstand unten" value={settings.spacingBottom ?? "48"} onChange={(value) => onChange({ spacingBottom: value })} type="number" />
      <Select label="Breite" value={settings.width ?? "normal"} options={["narrow", "normal", "wide"]} onChange={(value) => onChange({ width: value as LandingpageSectionSettings["width"] })} />
      <Select label="Layout" value={settings.layout ?? "left"} options={["left", "right", "centered", "two_columns"]} onChange={(value) => onChange({ layout: value as LandingpageSectionSettings["layout"] })} />
    </div>
  );
}

function GlobalDesignEditor({ design, onChange }: { design: GlobalLandingpageDesign; onChange: (design: GlobalLandingpageDesign) => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">Globales Design</h2>
      <Field label="Primärfarbe" type="color" value={design.primaryColor} onChange={(value) => onChange({ ...design, primaryColor: value })} />
      <Field label="Akzentfarbe" type="color" value={design.accentColor} onChange={(value) => onChange({ ...design, accentColor: value })} />
      <Field label="Standardschrift" value={design.fontFamily} onChange={(value) => onChange({ ...design, fontFamily: value })} />
      <Field label="Button-Radius" value={design.buttonRadius} onChange={(value) => onChange({ ...design, buttonRadius: value })} />
      <Field label="Card-Radius" value={design.cardRadius} onChange={(value) => onChange({ ...design, cardRadius: value })} />
      <Select label="Schatten" value={design.shadow} options={["soft", "strong"]} onChange={(value) => onChange({ ...design, shadow: value as GlobalLandingpageDesign["shadow"] })} />
      <Select label="Seitenbreite" value={design.pageWidth} options={["narrow", "normal", "wide"]} onChange={(value) => onChange({ ...design, pageWidth: value as GlobalLandingpageDesign["pageWidth"] })} />
    </div>
  );
}

function PreviewCanvas({ sections, globalDesign }: { sections: LandingpageSection[]; globalDesign: GlobalLandingpageDesign }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-3 sm:p-4">
      <div className="mx-auto w-full overflow-hidden rounded-2xl bg-white shadow-panel" style={{ fontFamily: globalDesign.fontFamily, maxWidth: widthPx(globalDesign.pageWidth) }}>
        {sections.map((section) => <PreviewSection key={section.id} section={section} globalDesign={globalDesign} />)}
      </div>
    </div>
  );
}

function PreviewSection({ section, globalDesign }: { section: LandingpageSection; globalDesign: GlobalLandingpageDesign }) {
  const settings = section.settings;
  return (
    <section
      className="px-6"
      style={{
        backgroundColor: settings.backgroundColor,
        color: settings.textColor,
        paddingTop: Number(settings.spacingTop ?? 48),
        paddingBottom: Number(settings.spacingBottom ?? 48),
        textAlign: settings.alignment,
        fontFamily: settings.fontFamily || globalDesign.fontFamily
      }}
    >
      <div className={`mx-auto ${settings.layout === "two_columns" ? "grid gap-4 md:grid-cols-2" : ""}`} style={{ maxWidth: widthPx(settings.width ?? "normal") }}>
        <div>
          {settings.headline ? <h2 className={headlineClass(settings.headlineSize)}>{settings.headline}</h2> : null}
          {settings.subheadline ? <p className="mt-3 text-lg opacity-80">{settings.subheadline}</p> : null}
          {settings.bodyText ? <p className={textClass(settings.textSize)}>{settings.bodyText}</p> : null}
          {section.type === "faq" ? <FaqPreview items={settings.faqItems ?? []} globalDesign={globalDesign} /> : null}
          {section.type === "comparison" ? <ComparisonPreview settings={settings} globalDesign={globalDesign} /> : null}
          {(section.type === "pdf_report_download" || section.type === "print_report_cta" || section.type === "roi_report") ? <ReportPreview type={section.type} settings={settings} globalDesign={globalDesign} /> : null}
          {(section.type === "personal_video" || section.type === "explainer_video") ? <VideoPreview settings={settings} /> : null}
          {settings.ctaText ? (
            <a href={settings.ctaUrl || "#"} className="mt-5 inline-flex px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: settings.buttonColor, borderRadius: globalDesign.buttonRadius }}>
              {settings.ctaText}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FaqPreview({ items, globalDesign }: { items: Array<{ question: string; answer: string }>; globalDesign: GlobalLandingpageDesign }) {
  return <div className="mt-5 grid gap-3">{items.map((item, index) => <div key={index} className="bg-slate-50 p-4" style={{ borderRadius: globalDesign.cardRadius }}><h3 className="font-semibold">{item.question}</h3><p className="mt-2 text-sm opacity-75">{item.answer}</p></div>)}</div>;
}

function ComparisonPreview({ settings, globalDesign }: { settings: LandingpageSectionSettings; globalDesign: GlobalLandingpageDesign }) {
  return <div className="mt-5 grid gap-3 md:grid-cols-2"><ListCard title="Links" items={settings.beforeItems ?? []} globalDesign={globalDesign} /><ListCard title="Rechts" items={settings.afterItems ?? []} globalDesign={globalDesign} /></div>;
}

function ReportPreview({ type, settings, globalDesign }: { type: LandingpageSectionType; settings: LandingpageSectionSettings; globalDesign: GlobalLandingpageDesign }) {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left" style={{ borderRadius: globalDesign.cardRadius }}>
      <div className="flex items-start gap-3">
        {settings.reportShowIcon === false ? null : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold text-slate-700">PDF</span>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{settings.reportTitle || settings.headline || "Kurzreport"}</p>
          <p className="mt-1 text-sm text-slate-600">{settings.reportDescription || settings.bodyText || "PDF Kurzreport öffnen"}</p>
        </div>
      </div>
      {type === "roi_report" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["roiVehicles", "roiDispatchers", "roiOrdersPerDay", "roiManualEffort", "roiMonthlyLoss"].map((key) => (
            <span key={key} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700">{String(settings[key as keyof LandingpageSectionSettings] ?? "")}</span>
          ))}
        </div>
      ) : null}
      <span className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: settings.buttonColor || globalDesign.buttonColor }}>
        {settings.reportButtonText || "Kurzreport generieren"}
      </span>
    </div>
  );
}

function ListCard({ title, items, globalDesign }: { title: string; items: string[]; globalDesign: GlobalLandingpageDesign }) {
  return <div className="bg-slate-50 p-4" style={{ borderRadius: globalDesign.cardRadius }}><h3 className="font-semibold">{title}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function VideoPreview({ settings }: { settings: LandingpageSectionSettings }) {
  return <div className="mt-5"><SharedVideoPreview {...videoPreviewPropsFromSettings(settings)} /></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-500">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-500">{label}</span><textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function TinyButton({ children, onClick }: { children: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-ink">{children}</button>;
}

function lines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function renderSettings(settings: LandingpageSectionSettings, prospect: Prospect): LandingpageSectionSettings {
  return {
    ...settings,
    headline: renderText(settings.headline, prospect),
    subheadline: renderText(settings.subheadline, prospect),
    bodyText: renderText(settings.bodyText, prospect),
    ctaText: renderText(settings.ctaText, prospect),
    reportTitle: renderText(settings.reportTitle, prospect),
    reportDescription: renderText(settings.reportDescription, prospect),
    reportButtonText: renderText(settings.reportButtonText, prospect),
    faqItems: settings.faqItems?.map((item) => ({ question: renderText(item.question, prospect), answer: renderText(item.answer, prospect) })),
    beforeItems: settings.beforeItems?.map((item) => renderText(item, prospect)),
    afterItems: settings.afterItems?.map((item) => renderText(item, prospect))
  };
}

function widthPx(width: string) {
  if (width === "narrow") return 720;
  if (width === "wide") return 1180;
  return 960;
}

function headlineClass(size?: string) {
  if (size === "small") return "text-2xl font-semibold";
  if (size === "normal") return "text-3xl font-semibold";
  return "text-4xl font-semibold";
}

function textClass(size?: string) {
  if (size === "small") return "mt-4 text-sm leading-6 opacity-80";
  if (size === "large") return "mt-4 text-lg leading-8 opacity-80";
  return "mt-4 text-base leading-7 opacity-80";
}
