"use client";

import type { LandingpageTemplate, Prospect } from "@prisma/client";
import { useState, useTransition } from "react";
import { renderLandingpageModel, renderText, templateVariables } from "@/lib/landingpage-templates";

export function LandingpageTemplateEditor({
  template,
  prospects
}: {
  template: LandingpageTemplate;
  prospects: Prospect[];
}) {
  const [tab, setTab] = useState("Allgemein");
  const [previewProspectId, setPreviewProspectId] = useState(prospects[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const previewProspect = prospects.find((prospect) => prospect.id === previewProspectId) ?? prospects[0];
  const preview = previewProspect ? renderLandingpageModel(template, previewProspect) : null;

  function save(formData: FormData) {
    startTransition(async () => {
      const body = Object.fromEntries(formData.entries());
      const response = await fetch(`/api/landingpage-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "Template gespeichert." : data?.error ?? "Speichern fehlgeschlagen.");
      if (response.ok) window.location.reload();
    });
  }

  function generateAiCopy() {
    if (!previewProspectId) {
      setMessage("Bitte zuerst einen Prospect für die Vorschau auswählen.");
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/ai/generate-landingpage-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: previewProspectId })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(data?.error ?? "KI-Texte konnten nicht erzeugt werden.");
        return;
      }
      setMessage(`KI-Vorschlag: ${JSON.stringify(data)}`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="admin-tab-scroll">
        {["Allgemein", "Hero", "Persönliches Video", "Erklärvideo", "Vergleich", "CTA", "Buchung", "FAQ", "Design", "Vorschau"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`min-h-10 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${tab === item ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <button type="button" onClick={generateAiCopy} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200">
        Landingpage-Texte mit KI personalisieren
      </button>
      {message ? <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">{message}</div> : null}
      <form className="rounded-2xl border border-white/10 p-5" onSubmit={(event) => { event.preventDefault(); save(new FormData(event.currentTarget)); }}>
        {tab === "Allgemein" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" name="name" defaultValue={template.name} />
            <label className="flex items-center gap-3"><input type="checkbox" name="isDefault" defaultChecked={template.isDefault} /> Standard-Template</label>
            <Field label="Button Text Default" name="defaultCtaText" defaultValue={template.defaultCtaText} />
            <Field label="Button Link Default" name="defaultCtaUrl" defaultValue={template.defaultCtaUrl ?? ""} />
          </div>
        ) : null}
        {tab === "Hero" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3"><input type="checkbox" name="heroEnabled" defaultChecked={template.heroEnabled} /> Hero aktiv</label>
            <Field label="Eyebrow" name="heroEyebrow" defaultValue={template.heroEyebrow ?? ""} />
            <Textarea label="Headline" name="heroHeadline" defaultValue={template.heroHeadline} />
            <Textarea label="Subheadline" name="heroSubheadline" defaultValue={template.heroSubheadline ?? ""} />
            <Textarea label="Text" name="heroBodyText" defaultValue={template.heroBodyText ?? ""} />
            <Field label="CTA Text" name="heroCtaText" defaultValue={template.heroCtaText ?? ""} />
            <Field label="CTA Link" name="heroCtaUrl" defaultValue={template.heroCtaUrl ?? ""} />
            <Field label="Secondary CTA Text" name="heroSecondaryCtaText" defaultValue={template.heroSecondaryCtaText ?? ""} />
            <Field label="Secondary CTA Link" name="heroSecondaryCtaUrl" defaultValue={template.heroSecondaryCtaUrl ?? ""} />
            <Select label="Hero Layout" name="heroLayout" defaultValue={template.heroLayout} options={["video_right", "video_left", "centered"]} />
            <Select label="Video Position" name="heroVideoPosition" defaultValue={template.heroVideoPosition} options={["right", "left", "bottom"]} />
          </div>
        ) : null}
        {tab === "Persönliches Video" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3"><input type="checkbox" name="personalVideoEnabled" defaultChecked={template.personalVideoEnabled} /> Aktiv</label>
            <Field label="Video URL" name="personalVideoUrl" defaultValue={template.personalVideoUrl ?? ""} />
            <Field label="Thumbnail URL" name="personalVideoThumbnailUrl" defaultValue={template.personalVideoThumbnailUrl ?? ""} />
            <Field label="Titel" name="personalVideoTitle" defaultValue={template.personalVideoTitle ?? ""} />
            <Field label="Button Text" name="personalVideoButtonText" defaultValue={template.personalVideoButtonText} />
          </div>
        ) : null}
        {tab === "Erklärvideo" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3"><input type="checkbox" name="explainerVideoEnabled" defaultChecked={template.explainerVideoEnabled} /> Aktiv</label>
            <Field label="Video URL" name="explainerVideoUrl" defaultValue={template.explainerVideoUrl ?? ""} />
            <Field label="Thumbnail URL" name="explainerVideoThumbnailUrl" defaultValue={template.explainerVideoThumbnailUrl ?? ""} />
            <Textarea label="Titel" name="explainerVideoTitle" defaultValue={template.explainerVideoTitle ?? ""} />
            <Textarea label="Subline" name="explainerVideoSubline" defaultValue={template.explainerVideoSubline ?? ""} />
            <Field label="Button Text" name="explainerVideoButtonText" defaultValue={template.explainerVideoButtonText} />
            <Field label="CTA Text" name="explainerCtaText" defaultValue={template.explainerCtaText ?? ""} />
            <Field label="CTA Link" name="explainerCtaUrl" defaultValue={template.explainerCtaUrl ?? ""} />
          </div>
        ) : null}
        {tab === "Vergleich" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3"><input type="checkbox" name="comparisonEnabled" defaultChecked={template.comparisonEnabled} /> Aktiv</label>
            <Field label="Headline" name="comparisonHeadline" defaultValue={template.comparisonHeadline ?? ""} />
            <Textarea label="Vorher Items, eine Zeile pro Punkt" name="beforeItems" defaultValue={template.beforeItems.join("\n")} />
            <Textarea label="Nachher Items, eine Zeile pro Punkt" name="afterItems" defaultValue={template.afterItems.join("\n")} />
          </div>
        ) : null}
        {tab === "CTA" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3"><input type="checkbox" name="finalCtaEnabled" defaultChecked={template.finalCtaEnabled} /> Abschluss CTA aktiv</label>
            <Textarea label="Headline" name="finalCtaHeadline" defaultValue={template.finalCtaHeadline ?? ""} />
            <Field label="CTA Text" name="finalCtaText" defaultValue={template.finalCtaText ?? ""} />
            <Field label="CTA Link" name="finalCtaUrl" defaultValue={template.finalCtaUrl ?? ""} />
          </div>
        ) : null}
        {tab === "Buchung" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300 md:col-span-2">
              Interne Buchungsseite bedeutet: externe Calendly/Tidycal-Seite wird im Tasklytic-Design eingebettet.
            </div>
            <Select label="CTA Verhalten" name="bookingMode" defaultValue={template.bookingMode} options={["embedded_page", "external_link"]} />
            <Field label="Buchungs-Headline" name="bookingHeadline" defaultValue={template.bookingHeadline ?? ""} />
            <Textarea label="Buchungs-Subheadline" name="bookingSubheadline" defaultValue={template.bookingSubheadline ?? ""} />
            <Field label="Zurück Button Text" name="bookingBackText" defaultValue={template.bookingBackText} />
            <Field label="Extern öffnen Button Text" name="bookingExternalButtonText" defaultValue={template.bookingExternalButtonText} />
          </div>
        ) : null}
        {tab === "FAQ" ? (
          <div className="grid gap-4">
            <label className="flex items-center gap-3"><input type="checkbox" name="faqEnabled" defaultChecked={template.faqEnabled} /> FAQ aktiv</label>
            <Textarea label="FAQ JSON" name="faqJson" defaultValue={JSON.stringify(template.faqJson, null, 2)} />
          </div>
        ) : null}
        {tab === "Design" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Logo URL" name="logoUrl" defaultValue={template.logoUrl ?? ""} />
            <Field label="Primärfarbe" name="primaryColor" defaultValue={template.primaryColor} />
            <Field label="Akzentfarbe" name="accentColor" defaultValue={template.accentColor} />
            <Select label="Hintergrund" name="backgroundMode" defaultValue={template.backgroundMode} options={["light", "dark"]} />
            <Field label="Footer Text" name="footerText" defaultValue={template.footerText ?? ""} />
          </div>
        ) : null}
        {tab === "Vorschau" && previewProspect && preview ? (
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Prospect</span>
              <select value={previewProspectId} onChange={(event) => setPreviewProspectId(event.target.value)}>
                {prospects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.companyName}</option>)}
              </select>
            </label>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <Preview title="Desktop Preview" model={preview} />
              <Preview title="Mobile Preview" model={preview} compact />
            </div>
            <div className="rounded-2xl bg-white/5 p-4 text-xs text-slate-300">
              Variablen: {templateVariables.map((v) => `{{${v}}}`).join(", ")}
              <br />
              Gerendert: {renderText(template.heroHeadline, previewProspect)}
            </div>
          </div>
        ) : null}
        <div className="mt-5">
          <button type="submit" disabled={isPending} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-medium">Speichern</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text" }: { label: string; name: string; defaultValue?: string; type?: string }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate">{label}</span><input name={name} type={type} defaultValue={defaultValue} /></label>;
}
function Textarea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return <label className="block space-y-2 md:col-span-2"><span className="text-sm font-medium text-slate">{label}</span><textarea name={name} defaultValue={defaultValue} rows={4} /></label>;
}
function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate">{label}</span><select name={name} defaultValue={defaultValue}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
function Preview({ title, model, compact }: { title: string; model: ReturnType<typeof renderLandingpageModel>; compact?: boolean }) {
  return (
    <div className={`w-full min-w-0 rounded-3xl bg-white p-5 text-slate-950 ${compact ? "max-w-sm" : ""}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <h3 className="mt-4 text-2xl font-semibold">{model.hero.headline}</h3>
      <p className="mt-3 text-slate-600">{model.hero.bodyText}</p>
      <a href={model.hero.ctaUrl} className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm text-white">{model.hero.ctaText}</a>
      {model.personalVideo.enabled ? <div className="mt-5 rounded-2xl bg-slate-100 p-5">▶ {model.personalVideo.title}</div> : null}
      {model.explainerVideo.enabled ? <div className="mt-5 rounded-2xl bg-slate-100 p-5">▶ {model.explainerVideo.title}</div> : null}
    </div>
  );
}
