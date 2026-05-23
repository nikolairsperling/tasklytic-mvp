"use client";

import { Bot, Copy, FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";
import {
  categoryLabels,
  channelLabels,
  messageCategories,
  messageChannels,
  messageStatuses,
  messageVariables,
  sampleLead,
  statusLabels
} from "@/lib/message-templates";

type MessageTemplateItem = {
  id: string;
  name: string;
  channel: string;
  bodyText: string;
  subject: string | null;
  category: string | null;
  status: string;
  targetAudience: string | null;
  tone: string | null;
  qualityScore: number | null;
  updatedAt: string;
};

type EditorMode = "create" | "edit" | null;

const aiActions = [
  ["rewrite", "Nachricht neu formulieren"],
  ["shorten", "Kürzer machen"],
  ["more_personal", "Persönlicher machen"],
  ["more_b2b", "Mehr B2B-professionell"],
  ["linkedin", "Mehr LinkedIn-tauglich"],
  ["whatsapp", "Mehr WhatsApp-tauglich"],
  ["email_subject", "Betreffzeile für E-Mail erzeugen"],
  ["follow_up", "Follow-up aus bestehender Nachricht erzeugen"],
  ["objection", "Einwandbehandlung erzeugen"],
  ["abc_variants", "Variante A/B/C erzeugen"]
] as const;

function labelFor(map: Record<string, string>, value: string | null | undefined) {
  return value ? map[value] ?? value : "Nicht gesetzt";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE");
}

function renderTemplate(text: string, values: Record<string, string> = sampleLead) {
  const missing = new Set<string>();
  const rendered = text.replace(/{{([A-Za-z0-9_]+)}}/g, (match, key: string) => {
    const value = values[key];
    if (!value) {
      missing.add(match);
      return match;
    }
    return value;
  });
  return { rendered, missing: Array.from(missing) };
}

function qualityTone(score: number | null): "green" | "amber" | "red" | "neutral" {
  if (score == null) return "neutral";
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function statusTone(status: string): "green" | "amber" | "neutral" {
  if (status === "active") return "green";
  if (status === "draft") return "amber";
  return "neutral";
}

function TemplateEditor({
  mode,
  template,
  onSubmit,
  onAiApply,
  isPending
}: {
  mode: "create" | "edit";
  template: MessageTemplateItem | null;
  onSubmit: (formData: FormData) => void;
  onAiApply: (action: string, form: HTMLFormElement) => void;
  isPending: boolean;
}) {
  const [bodyText, setBodyText] = useState(template?.bodyText ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const preview = renderTemplate(bodyText);
  const subjectPreview = renderTemplate(subject);

  function insertVariable(variable: string) {
    setBodyText((current) => `${current}${current.endsWith(" ") || current.endsWith("\n") || current.length === 0 ? "" : " "}${variable}`);
  }

  return (
    <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-600">Name der Vorlage</span>
            <input name="name" defaultValue={template?.name ?? ""} required />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-600">Kanal</span>
            <select name="channel" defaultValue={template?.channel ?? "email"}>
              {messageChannels.map((channel) => <option key={channel} value={channel}>{channelLabels[channel]}</option>)}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-600">Kategorie</span>
            <select name="category" defaultValue={template?.category ?? "first_contact"}>
              {messageCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-600">Status</span>
            <select name="status" defaultValue={template?.status ?? "draft"}>
              {messageStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-600">Zielgruppe</span>
            <input name="targetAudience" defaultValue={template?.targetAudience ?? ""} placeholder="Geschäftsführer von Speditionen" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-600">Tonalität</span>
            <input name="tone" defaultValue={template?.tone ?? ""} placeholder="direkt, menschlich, nicht werblich" />
          </label>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-600">Betreffzeile für E-Mail</span>
          <input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Kurzer Gedanke zu {{Empfaenger_Firma}}" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-600">Textfeld</span>
          <textarea name="bodyText" rows={11} value={bodyText} onChange={(event) => setBodyText(event.target.value)} required />
        </label>
        <div>
          <p className="text-sm font-medium text-slate-600">Variablen-Auswahl</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {messageVariables.map((variable) => (
              <button key={variable} type="button" className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200" onClick={() => insertVariable(variable)}>
                {variable}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Bot size={16} />Mit KI verbessern</div>
          <div className="flex flex-wrap gap-2">
            {aiActions.map(([action, label]) => (
              <button key={action} type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={(event) => onAiApply(action, event.currentTarget.form!)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button disabled={isPending} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold">
          {mode === "create" ? "Vorlage erstellen" : "Änderungen speichern"}
        </button>
      </div>
      <aside className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold text-ink">Vorschau mit Beispieldaten</h3>
          {subject ? <p className="mt-3 text-sm font-medium text-slate-700">{subjectPreview.rendered}</p> : null}
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{preview.rendered || "Noch kein Text."}</pre>
          {[...subjectPreview.missing, ...preview.missing].length > 0 ? (
            <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">Fehlende Variablen: {Array.from(new Set([...subjectPreview.missing, ...preview.missing])).join(", ")}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold text-ink">Beispiel-Lead</h3>
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            {Object.entries(sampleLead).slice(0, 8).map(([key, value]) => <p key={key}><span className="font-medium">{key}:</span> {value}</p>)}
          </div>
        </div>
      </aside>
    </form>
  );
}

export function MessageTemplateManager({ templates }: { templates: MessageTemplateItem[] }) {
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [selected, setSelected] = useState<MessageTemplateItem | null>(null);
  const [aiCreateOpen, setAiCreateOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ renderedSubject: string; renderedBody: string; missingVariables: string[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedTemplates = useMemo(() => templates, [templates]);

  function closeEditor() {
    setEditorMode(null);
    setSelected(null);
    setMessage(null);
  }

  function submitTemplate(formData: FormData) {
    const endpoint = editorMode === "edit" && selected ? `/api/assets/messages/${selected.id}` : "/api/assets/messages";
    const method = editorMode === "edit" ? "PATCH" : "POST";
    startTransition(async () => {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData.entries())) });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Vorlage konnte nicht gespeichert werden.");
        return;
      }
      window.location.reload();
    });
  }

  function copyTemplate(template: MessageTemplateItem) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/messages/${template.id}/copy`, { method: "POST" });
      if (!response.ok) setMessage("Vorlage konnte nicht kopiert werden.");
      else window.location.reload();
    });
  }

  function deleteTemplate(template: MessageTemplateItem) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/messages/${template.id}`, { method: "DELETE" });
      if (!response.ok) setMessage("Vorlage konnte nicht gelöscht werden.");
      else window.location.reload();
    });
  }

  function testTemplate(template: MessageTemplateItem) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/messages/${template.id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead: sampleLead }) });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data?.error ?? "Test fehlgeschlagen.");
        return;
      }
      setSelected(template);
      setTestResult(data);
    });
  }

  function applyAi(action: string, form: HTMLFormElement) {
    const payload = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    startTransition(async () => {
      const response = await fetch("/api/assets/messages/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, action }) });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data?.error ?? "KI-Aktion fehlgeschlagen.");
        return;
      }
      if (data.bodyText) {
        const textarea = form.elements.namedItem("bodyText") as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.value = data.bodyText;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      if (data.subject) {
        const input = form.elements.namedItem("subject") as HTMLInputElement | null;
        if (input) {
          input.value = data.subject;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      if (data.variants) setMessage(`KI-Varianten: ${data.variants.map((variant: { label: string; bodyText: string }) => `${variant.label}: ${variant.bodyText}`).join(" | ")}`);
    });
  }

  function createWithAi(formData: FormData) {
    startTransition(async () => {
      const payload = Object.fromEntries(formData.entries());
      const response = await fetch("/api/assets/messages/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, action: "new_template" }) });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data?.error ?? "KI-Vorlage konnte nicht erzeugt werden.");
        return;
      }
      const createResponse = await fetch("/api/assets/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || "KI Nachrichtenvorlage",
          subject: data.subject || "",
          bodyText: data.bodyText || "",
          channel: payload.channel,
          category: "first_contact",
          status: "draft",
          targetAudience: payload.targetAudience,
          tone: payload.tone
        })
      });
      if (!createResponse.ok) setMessage("KI-Vorlage wurde erzeugt, konnte aber nicht gespeichert werden.");
      else window.location.reload();
    });
  }

  return (
    <div>
      <PageHeader
        title="Nachrichtenvorlagen"
        description="Professionelle Outreach-Templates für E-Mail, LinkedIn, WhatsApp und Telefonnotizen."
        backButton={<AdminBackButton href="/admin/assets" />}
        action={<div className="flex flex-wrap gap-2"><button className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => setAiCreateOpen(true)}><Bot size={16} />Neue Vorlage mit KI erstellen</button><button className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => { setSelected(null); setEditorMode("create"); }}><Plus size={16} />Neue Vorlage</button></div>}
      />
      {message ? <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{message}</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {sortedTemplates.map((template) => (
          <AdminCard key={template.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="break-words text-lg font-semibold text-ink">{template.name}</h2>
                {template.subject ? <p className="mt-1 text-sm font-medium text-slate-600">{template.subject}</p> : null}
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{template.bodyText}</p>
              </div>
              <StatusBadge tone={statusTone(template.status)}>{labelFor(statusLabels, template.status)}</StatusBadge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone="brand">{labelFor(channelLabels, template.channel)}</StatusBadge>
              <StatusBadge>{labelFor(categoryLabels, template.category)}</StatusBadge>
              <StatusBadge tone={qualityTone(template.qualityScore)}>Score {template.qualityScore ?? "offen"}</StatusBadge>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">Letzte Änderung: {formatDate(template.updatedAt)}</p>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setSelected(template); setEditorMode("edit"); }}><Pencil className="mr-1 inline" size={14} />Bearbeiten</button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => copyTemplate(template)}><Copy className="mr-1 inline" size={14} />Kopieren</button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => testTemplate(template)}><FlaskConical className="mr-1 inline" size={14} />Testen</button>
                <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => deleteTemplate(template)}><Trash2 className="mr-1 inline" size={14} />Löschen</button>
              </div>
            </div>
          </AdminCard>
        ))}
      </div>

      {editorMode ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto my-6 w-full max-w-6xl rounded-2xl bg-white p-6 shadow-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">{editorMode === "create" ? "Neue Nachrichtenvorlage" : "Nachrichtenvorlage bearbeiten"}</h2>
                <p className="mt-1 text-sm text-slate-500">Editor mit Variablen, Vorschau, KI-Verbesserung und Qualitätsbewertung.</p>
              </div>
              <button className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50" onClick={closeEditor}>Schließen</button>
            </div>
            <TemplateEditor mode={editorMode} template={selected} onSubmit={submitTemplate} onAiApply={applyAi} isPending={isPending} />
          </div>
        </div>
      ) : null}

      {aiCreateOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">Neue Vorlage mit KI erstellen</h2>
                <p className="mt-1 text-sm text-slate-500">Beschreibe Zielgruppe, Angebot, Kanal und CTA.</p>
              </div>
              <button className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50" onClick={() => setAiCreateOpen(false)}>Schließen</button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); createWithAi(new FormData(event.currentTarget)); }}>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Zielgruppe</span><input name="targetAudience" defaultValue="Geschäftsführer von Speditionen" /></label>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Angebot</span><input name="offer" defaultValue="Prozessanalyse für weniger manuelle Arbeit" /></label>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Kanal</span><select name="channel" defaultValue="linkedin">{messageChannels.map((channel) => <option key={channel} value={channel}>{channelLabels[channel]}</option>)}</select></label>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Ziel der Nachricht</span><input name="goal" defaultValue="Erstkontakt" /></label>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Tonalität</span><input name="tone" defaultValue="direkt, menschlich, nicht werblich" /></label>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">Länge</span><input name="length" defaultValue="kurz" /></label>
              <label className="block space-y-2 md:col-span-2"><span className="text-sm font-medium text-slate-600">Gewünschte CTA</span><input name="cta" defaultValue="Interesse an kurzem Austausch" /></label>
              <button disabled={isPending} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold md:col-span-2">KI-Vorlage erstellen</button>
            </form>
          </div>
        </div>
      ) : null}

      {testResult && selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">Test: {selected.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Alle Variablen wurden mit einem Beispiel-Lead ersetzt.</p>
              </div>
              <button className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50" onClick={() => setTestResult(null)}>Schließen</button>
            </div>
            {testResult.renderedSubject ? <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{testResult.renderedSubject}</p> : null}
            <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{testResult.renderedBody}</pre>
            {testResult.missingVariables.length > 0 ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Fehlende Variablen: {testResult.missingVariables.join(", ")}</p> : <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Keine fehlenden Variablen.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
