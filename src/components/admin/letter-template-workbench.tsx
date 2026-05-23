"use client";

import { Copy, ExternalLink, Eye, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import { personalizationVariables, recipientVariables, senderVariables, type LetterTemplateCheckIssue } from "@/lib/letter-templates";

type LetterTemplateItem = {
  id: string;
  name: string;
  title: string | null;
  body: string;
  footer: string | null;
  description: string | null;
  googleDocUrl: string | null;
  qrCodePosition: string | null;
  landingPageUrlVariable: string;
  previewText: string;
  googleDocsText: string;
  imageAltTexts: string[];
  pageCount: number | null;
  isDefault: boolean;
  isSystemTemplate: boolean;
  isInUse: boolean;
  isChecked: boolean;
  lastCheckIssues: LetterTemplateCheckIssue[] | unknown;
  updatedAt: Date | string;
};

type ViewMode = "preview" | "editor" | null;
type Notice = { tone: "success" | "error"; text: string } | null;

const sampleLead: Record<string, string> = {
  "{{Empfaenger_Vorname}}": "Mara",
  "{{Empfaenger_Nachname}}": "Schneider",
  "{{Empfaenger_Firma}}": "Schneider Logistik GmbH",
  "{{Empfaenger_Strasse}}": "Hafenstrasse 12",
  "{{Empfaenger_PLZ}}": "20457",
  "{{Empfaenger_Stadt}}": "Hamburg",
  "{{Empfaenger_Email}}": "mara.schneider@example.de",
  "{{Empfaenger_Telefon}}": "+49 40 123456",
  "{{LandingPage_URL}}": "https://tasklytic.de/p/schneider-logistik",
  "{{Absender_Vorname}}": "Alex",
  "{{Absender_Nachname}}": "Weber",
  "{{Absender_Firma}}": "Tasklytic",
  "{{Absender_Email}}": "alex@tasklytic.de",
  "{{Absender_Website}}": "https://tasklytic.de",
  "{{PersonalVideo_URL}}": "https://tasklytic.de/video/schneider"
};

const emptyTemplate: LetterTemplateItem = {
  id: "",
  name: "",
  title: "",
  body: "Hallo {{Empfaenger_Vorname}} {{Empfaenger_Nachname}},\n\nich habe fuer {{Empfaenger_Firma}} eine kurze persoenliche Seite vorbereitet:\n{{LandingPage_URL}}\n\nViele Gruesse\n{{Absender_Vorname}} {{Absender_Nachname}}\n\n{{QR_Code}}\n{{VideoThumbnail}}",
  footer: "{{Absender_Firma}} · {{Absender_Email}} · {{Absender_Website}}",
  description: "",
  googleDocUrl: "",
  qrCodePosition: "unten",
  landingPageUrlVariable: "{{LandingPage_URL}}",
  previewText: "",
  googleDocsText: "",
  imageAltTexts: ["{{QR_Code}}", "{{VideoThumbnail}}"],
  pageCount: 1,
  isDefault: false,
  isSystemTemplate: false,
  isInUse: false,
  isChecked: false,
  lastCheckIssues: [],
  updatedAt: new Date().toISOString()
};

function issuesFor(template: LetterTemplateItem): LetterTemplateCheckIssue[] {
  return Array.isArray(template.lastCheckIssues) ? template.lastCheckIssues as LetterTemplateCheckIssue[] : [];
}

function renderVariables(value: string) {
  return Object.entries(sampleLead).reduce((current, [variable, replacement]) => current.replaceAll(variable, replacement), value)
    .replaceAll("{{QR_Code}}", "[QR-Code]")
    .replaceAll("{{QRCode}}", "[QR-Code]")
    .replaceAll("{{VideoThumbnail}}", "[Video-/Bildplatzhalter]");
}

function templateText(template: LetterTemplateItem) {
  const body = template.body || template.googleDocsText || template.previewText;
  return [template.title, body, template.footer].filter(Boolean).join("\n\n");
}

function DocumentPreview({ template }: { template: LetterTemplateItem }) {
  const parts = renderVariables(templateText(template)).split(/(\[QR-Code\]|\[Video-\/Bildplatzhalter\])/g).filter(Boolean);
  return (
    <div className="mx-auto min-h-[620px] w-full max-w-[680px] rounded-sm border border-slate-200 bg-white px-8 py-10 shadow-sm">
      <div className="space-y-4 whitespace-pre-wrap text-sm leading-7 text-slate-800">
        {parts.map((part, index) => {
          if (part === "[QR-Code]") return <div key={index} className="my-5 flex h-28 w-28 items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 text-center text-xs font-semibold text-slate-500">QR-Code</div>;
          if (part === "[Video-/Bildplatzhalter]") return <div key={index} className="my-5 flex aspect-video w-full max-w-sm items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 text-center text-xs font-semibold text-slate-500">Video-/Bildplatzhalter</div>;
          return <span key={index}>{part}</span>;
        })}
      </div>
    </div>
  );
}

function VariableGroup({ title, variables, onCopy }: { title: string; variables: readonly string[]; onCopy: (value: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <div className="mt-2 grid gap-2">
        {variables.map((variable) => <button key={variable} type="button" onClick={() => onCopy(variable)} className="rounded-lg bg-slate-100 px-2 py-2 text-left font-mono text-xs text-slate-700 hover:bg-slate-200">{variable}</button>)}
      </div>
    </div>
  );
}

export function LetterTemplateWorkbench({ templates }: { templates: LetterTemplateItem[] }) {
  const [items, setItems] = useState(templates);
  const [selected, setSelected] = useState<LetterTemplateItem | null>(null);
  const [mode, setMode] = useState<ViewMode>(null);
  const [draft, setDraft] = useState<LetterTemplateItem>(emptyTemplate);
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();
  const sortedTemplates = useMemo(() => items, [items]);
  const activeTemplate = mode === "editor" ? draft : selected;

  function openEditor(template?: LetterTemplateItem) {
    setSelected(template ?? null);
    setDraft(template ? { ...template } : { ...emptyTemplate });
    setMode("editor");
    setNotice(null);
  }

  function openPreview(template: LetterTemplateItem) {
    setSelected(template);
    setMode("preview");
    setNotice(null);
  }

  function updateDraft(patch: Partial<LetterTemplateItem>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function copyVariable(variable: string) {
    navigator.clipboard?.writeText(variable).catch(() => undefined);
    setNotice({ tone: "success", text: `${variable} kopiert.` });
  }

  function persistTemplate(template: LetterTemplateItem) {
    const isEdit = Boolean(template.id);
    startTransition(async () => {
      const response = await fetch(isEdit ? `/api/assets/letter-templates/${template.id}` : "/api/assets/letter-templates", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template)
      });
      const data = await response.json().catch(() => null) as LetterTemplateItem | { error?: string } | null;
      if (!response.ok || !data || "error" in data) {
        setNotice({ tone: "error", text: data && "error" in data ? data.error ?? "Vorlage konnte nicht gespeichert werden." : "Vorlage konnte nicht gespeichert werden." });
        return;
      }
      const saved = data as LetterTemplateItem;
      setItems((current) => {
        const rest = current.filter((item) => item.id !== saved.id);
        return [saved, ...(saved.isDefault ? rest.map((item) => ({ ...item, isDefault: false })) : rest)];
      });
      setDraft(saved);
      setSelected(saved);
      setNotice({ tone: "success", text: "Briefvorlage gespeichert." });
    });
  }

  function copyTemplate(template: LetterTemplateItem) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/letter-templates/${template.id}/copy`, { method: "POST" });
      const data = await response.json().catch(() => null) as LetterTemplateItem | { error?: string } | null;
      if (!response.ok || !data || "error" in data) {
        setNotice({ tone: "error", text: data && "error" in data ? data.error ?? "Vorlage konnte nicht dupliziert werden." : "Vorlage konnte nicht dupliziert werden." });
        return;
      }
      setItems((current) => [data as LetterTemplateItem, ...current]);
      setNotice({ tone: "success", text: "Briefvorlage dupliziert." });
    });
  }

  function deleteTemplate(template: LetterTemplateItem) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/letter-templates/${template.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setNotice({ tone: "error", text: data?.error ?? "Vorlage konnte nicht gelöscht werden." });
        return;
      }
      setItems((current) => current.filter((item) => item.id !== template.id));
      setNotice({ tone: "success", text: "Briefvorlage gelöscht." });
    });
  }

  function resyncGoogleDocs() {
    setNotice({ tone: "error", text: "Google Docs Sync ist noch nicht verbunden." });
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] overflow-x-hidden">
      <PageHeader title="Briefvorlagen" description="Vorlagen für personalisierte Briefe mit lokaler Bearbeitung und optionalem Google-Docs-Link." backButton={<AdminBackButton href="/admin/assets" />} action={<button className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => openEditor()}><Plus size={16} />Neue Vorlage</button>} />
      {notice ? <p className={`mb-4 rounded-xl p-3 text-sm ${notice.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{notice.text}</p> : null}
      {sortedTemplates.length === 0 ? <EmptyState title="Noch keine Briefvorlagen" description="Erstelle die erste Vorlage über den Button oben." /> : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedTemplates.map((template) => (
            <AdminCard key={template.id} className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="break-words text-lg font-semibold text-ink">{template.name}</h2><p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{template.title || template.description || "Lokale Briefvorlage"}</p></div>
                {template.isDefault ? <StatusBadge tone="brand">Standard</StatusBadge> : null}
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="line-clamp-6 whitespace-pre-wrap text-xs leading-5 text-slate-600">{renderVariables(templateText(template))}</p></div>
              <div className="mt-4 flex flex-wrap gap-2">{template.googleDocUrl ? <StatusBadge tone="green">Google Docs Link</StatusBadge> : <StatusBadge tone="neutral">Lokal</StatusBadge>}{template.isChecked ? <StatusBadge tone="green">Geprüft</StatusBadge> : <StatusBadge tone="amber">Prüfung offen</StatusBadge>}</div>
              <p className="mt-3 text-xs text-slate-400">Aktualisiert am {new Date(template.updatedAt).toLocaleDateString("de-DE")}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openPreview(template)} className="btn-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"><Eye size={14} />Vorschau</button>
                <button type="button" onClick={() => openEditor(template)} className="btn-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"><Pencil size={14} />Bearbeiten</button>
                <button type="button" onClick={() => copyTemplate(template)} className="btn-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"><Copy size={14} />Duplizieren</button>
                <button type="button" onClick={() => persistTemplate({ ...template, isDefault: true })} className="btn-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"><Star size={14} />Standard</button>
                <button type="button" onClick={() => deleteTemplate(template)} disabled={template.isSystemTemplate || isPending} className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={14} />Löschen</button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {mode && activeTemplate ? (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto w-full max-w-[1180px] rounded-2xl bg-white p-5 shadow-panel">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-semibold text-ink">{mode === "preview" ? "Briefvorschau" : "Briefvorlage bearbeiten"}</h2><p className="mt-1 text-sm text-slate-500">{mode === "preview" ? "Beispiel-Lead-Daten sind eingesetzt. Platzhalter werden visuell angezeigt." : "Lokaler Editor. Variablen links anklicken, um sie zu kopieren."}</p></div>
              <div className="flex flex-wrap gap-2">{mode === "editor" ? <button type="button" disabled={isPending} onClick={() => persistTemplate(draft)} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">Speichern</button> : null}<button type="button" onClick={() => setMode(null)} className="btn-secondary rounded-xl px-4 py-2 text-sm font-semibold">Schließen</button></div>
            </div>
            {notice ? <p className={`mb-4 rounded-xl p-3 text-sm ${notice.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{notice.text}</p> : null}
            {mode === "preview" ? <DocumentPreview template={activeTemplate} /> : (
              <div className="grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
                <aside className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><VariableGroup title="Empfänger" variables={recipientVariables} onCopy={copyVariable} /><VariableGroup title="Absender" variables={senderVariables} onCopy={copyVariable} /><VariableGroup title="Kampagne" variables={personalizationVariables} onCopy={copyVariable} /></aside>
                <main className="min-w-0 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Name</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required /></label><label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Betreff/Titel</span><input value={draft.title ?? ""} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label></div>
                  <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Dokumentinhalt</span><textarea rows={12} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} /></label>
                  <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Fußzeile</span><input value={draft.footer ?? ""} onChange={(event) => setDraft((current) => ({ ...current, footer: event.target.value }))} /></label>
                  <DocumentPreview template={draft} />
                </main>
                <aside className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Google Docs URL</span><input type="url" value={draft.googleDocUrl ?? ""} onChange={(event) => updateDraft({ googleDocUrl: event.target.value })} /></label>
                  {draft.googleDocUrl ? <div className="space-y-2"><a href={draft.googleDocUrl} target="_blank" rel="noreferrer" className="btn-secondary inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"><ExternalLink size={15} />In Google Docs öffnen</a><button type="button" onClick={resyncGoogleDocs} className="btn-secondary min-h-10 w-full rounded-xl px-3 py-2 text-sm font-semibold">Google Docs Text neu einlesen</button><p className="text-xs leading-5 text-slate-500">Änderungen in Google Docs werden dort gespeichert. Nach Änderungen bitte Text neu einlesen.</p></div> : <p className="rounded-xl bg-white p-3 text-xs leading-5 text-slate-500">Google Docs Sync ist noch nicht verbunden.</p>}
                  <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Bild-Alt-Texte</span><input value={draft.imageAltTexts.join(", ")} onChange={(event) => updateDraft({ imageAltTexts: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
                  <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">QR-Code Position</span><select value={draft.qrCodePosition ?? "unten"} onChange={(event) => updateDraft({ qrCodePosition: event.target.value })}><option value="oben">oben</option><option value="mitte">mitte</option><option value="unten">unten</option></select></label>
                  <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Landingpage URL Variable</span><input value={draft.landingPageUrlVariable} onChange={(event) => updateDraft({ landingPageUrlVariable: event.target.value })} /></label>
                  <label className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={draft.isDefault} onChange={(event) => updateDraft({ isDefault: event.target.checked })} />Als Standard setzen</label>
                  <div className="rounded-xl bg-white p-3 text-xs leading-5 text-slate-500">{issuesFor(draft).length > 0 ? issuesFor(draft)[0]?.message : "Die Vorlage wird beim Speichern validiert."}</div>
                </aside>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
