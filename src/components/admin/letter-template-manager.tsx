"use client";

import { MoreVertical, Plus, Copy, Eye, Pencil, FileCheck2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";
import { recipientVariables, senderVariables, personalizationVariables, type LetterTemplateCheckIssue } from "@/lib/letter-templates";

type LetterTemplateItem = {
  id: string;
  name: string;
  description: string | null;
  googleDocUrl: string | null;
  previewText: string;
  imageAltTexts: string[];
  pageCount: number | null;
  isSystemTemplate: boolean;
  isInUse: boolean;
  isChecked: boolean;
  lastCheckStatus: string;
  lastCheckSummary: string | null;
  lastCheckIssues: LetterTemplateCheckIssue[] | unknown;
  detectedRecipientVariables: string[];
  detectedSenderVariables: string[];
  detectedPersonalizationVariables: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
};

type DialogMode = "create" | "view" | "edit" | null;
type ActionMenuAlignment = "center" | "left" | "right";

function issuesFor(template: LetterTemplateItem): LetterTemplateCheckIssue[] {
  return Array.isArray(template.lastCheckIssues) ? template.lastCheckIssues as LetterTemplateCheckIssue[] : [];
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("de-DE");
}

function VariableGroup({ title, variables }: { title: string; variables: readonly string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {variables.map((variable) => (
          <code key={variable} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">{variable}</code>
        ))}
      </div>
    </div>
  );
}

function TemplateForm({
  mode,
  template,
  onSubmit,
  isPending
}: {
  mode: "create" | "edit";
  template?: LetterTemplateItem;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Name</span>
        <input name="name" defaultValue={template?.name ?? ""} required />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Google Docs URL</span>
        <input name="googleDocUrl" type="url" defaultValue={template?.googleDocUrl ?? ""} placeholder="https://docs.google.com/document/d/..." />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Beschreibung</span>
        <textarea name="description" rows={2} defaultValue={template?.description ?? ""} />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Ausgelesener Google-Docs-Text</span>
        <textarea name="googleDocsText" rows={5} defaultValue={template?.previewText ?? ""} placeholder="{{Empfaenger_Anrede}} {{Empfaenger_Nachname}} ..." />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Bild-Alt-Texte</span>
        <input name="imageAltTexts" defaultValue={template?.imageAltTexts.join(", ") ?? "{{QRCode}}, {{VideoThumbnail}}"} />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Seitenzahl</span>
        <input name="pageCount" type="number" min={1} max={20} defaultValue={template?.pageCount ?? 1} />
      </label>
      <button disabled={isPending} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold">
        {mode === "create" ? "Vorlage erstellen" : "Änderungen speichern"}
      </button>
    </form>
  );
}

export function LetterTemplateManager({ templates }: { templates: LetterTemplateItem[] }) {
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<LetterTemplateItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionMenuAlignment, setActionMenuAlignment] = useState<ActionMenuAlignment>("center");
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedTemplates = useMemo(() => templates, [templates]);

  function closeDialog() {
    setDialogMode(null);
    setSelected(null);
    setMessage(null);
  }

  useEffect(() => {
    if (!openMenuId) return;

    function handlePointerDown(event: PointerEvent) {
      if (actionMenuRef.current?.contains(event.target as Node)) return;
      setOpenMenuId(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenuId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!openMenuId) return;

    function updateActionMenuAlignment() {
      const wrapper = actionMenuRef.current;
      const menu = wrapper?.querySelector<HTMLElement>(".action-menu");
      if (!wrapper || !menu) return;

      const viewportPadding = 16;
      const wrapperRect = wrapper.getBoundingClientRect();
      const menuWidth = Math.min(Math.max(menu.offsetWidth, 220), window.innerWidth * 0.92);
      const centeredLeft = wrapperRect.left + (wrapperRect.width / 2) - (menuWidth / 2);
      const centeredRight = centeredLeft + menuWidth;

      if (centeredLeft < viewportPadding) {
        setActionMenuAlignment("left");
        return;
      }

      if (centeredRight > window.innerWidth - viewportPadding) {
        setActionMenuAlignment("right");
        return;
      }

      setActionMenuAlignment("center");
    }

    updateActionMenuAlignment();
    window.addEventListener("resize", updateActionMenuAlignment);
    window.addEventListener("scroll", updateActionMenuAlignment, true);
    return () => {
      window.removeEventListener("resize", updateActionMenuAlignment);
      window.removeEventListener("scroll", updateActionMenuAlignment, true);
    };
  }, [openMenuId]);

  function openGoogleDocs(template: LetterTemplateItem | null) {
    if (!template?.googleDocUrl) {
      setMessage("Für diese Vorlage ist noch keine Google Docs URL hinterlegt.");
      return;
    }
    window.open(template.googleDocUrl, "_blank", "noopener,noreferrer");
    closeDialog();
  }

  function submitCreate(formData: FormData) {
    startTransition(async () => {
      const response = await fetch("/api/assets/letter-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Vorlage konnte nicht erstellt werden.");
        return;
      }
      window.location.reload();
    });
  }

  function submitEdit(formData: FormData) {
    if (!selected) return;
    startTransition(async () => {
      const response = await fetch(`/api/assets/letter-templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Vorlage konnte nicht gespeichert werden.");
        return;
      }
      window.location.reload();
    });
  }

  function copyTemplate(template: LetterTemplateItem) {
    setOpenMenuId(null);
    startTransition(async () => {
      const response = await fetch(`/api/assets/letter-templates/${template.id}/copy`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Vorlage konnte nicht kopiert werden.");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div>
      <PageHeader
        title="Briefvorlagen"
        description="Verwalte echte Google-Docs-Vorlagen für personalisierte Print-Kampagnen mit Text- und Bildvariablen."
        backButton={<AdminBackButton href="/admin/assets" />}
        action={<button className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => setDialogMode("create")}><Plus size={16} />Neue Vorlage</button>}
      />

      {message ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {sortedTemplates.map((template) => {
          const issues = issuesFor(template);
          return (
            <AdminCard key={template.id} className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold text-ink">{template.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{template.description || "Google-Docs-Briefvorlage für personalisierte Print-Kampagnen."}</p>
                </div>
                <div ref={openMenuId === template.id ? actionMenuRef : null} className="action-menu-wrapper shrink-0">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === template.id}
                    aria-label={`Aktionen für ${template.name}`}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                    onClick={() => {
                      setActionMenuAlignment("center");
                      setOpenMenuId((current) => current === template.id ? null : template.id);
                    }}
                  >
                    <MoreVertical size={17} />
                  </button>
                  {openMenuId === template.id ? (
                    <div role="menu" className={`action-menu action-menu-${actionMenuAlignment}`}>
                      <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); setSelected(template); setDialogMode("view"); }}><Eye size={15} />Ansehen</button>
                      <button type="button" role="menuitem" onClick={() => copyTemplate(template)}><Copy size={15} />Als eigene Vorlage kopieren</button>
                      <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); setSelected(template); setDialogMode("edit"); }}><Pencil size={15} />Bearbeiten</button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {template.isSystemTemplate ? <StatusBadge tone="brand">Mustervorlage</StatusBadge> : null}
                {template.isInUse ? <StatusBadge tone="amber">In Verwendung</StatusBadge> : null}
                {template.isChecked ? <StatusBadge tone="green">Geprüft</StatusBadge> : <StatusBadge tone="red">Prüfung offen</StatusBadge>}
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>Empfänger-Variablen</span>
                  <strong className="text-ink">{template.detectedRecipientVariables.length}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Bild-Alt-Texte</span>
                  <strong className="text-ink">{template.imageAltTexts.length}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Seiten</span>
                  <strong className="text-ink">{template.pageCount ?? "unbekannt"}</strong>
                </div>
              </div>

              {issues.length > 0 ? (
                <div className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-medium">{template.lastCheckSummary ?? "Prüfung mit Hinweisen"}</p>
                  <p className="mt-1">{issues[0]?.message}</p>
                </div>
              ) : (
                <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  <FileCheck2 size={16} />
                  <span>{template.lastCheckSummary ?? "Vorlage geprüft"}</span>
                </div>
              )}

              <p className="mt-4 text-xs text-slate-400">Aktualisiert am {formatDate(template.updatedAt)}</p>
            </AdminCard>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <AdminCard className="xl:col-span-2">
          <h2 className="text-lg font-semibold text-ink">Unterstützte Variablen</h2>
          <div className="mt-4 space-y-5">
            <VariableGroup title="Empfänger" variables={recipientVariables} />
            <VariableGroup title="Absender" variables={senderVariables} />
            <VariableGroup title="Personalisierung" variables={personalizationVariables} />
          </div>
        </AdminCard>
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Bild-Variablen</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">QR-Code und Video-Thumbnail werden nicht als Text ersetzt. In Google Docs muss jeweils ein Platzhalterbild liegen, dessen Alt-Text exakt die Variable enthält.</p>
          <div className="mt-4 space-y-2">
            <code className="block rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{"{{QRCode}}"}</code>
            <code className="block rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{"{{VideoThumbnail}}"}</code>
          </div>
        </AdminCard>
      </div>

      {dialogMode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">{dialogMode === "create" ? "Neue Briefvorlage" : dialogMode === "edit" ? "Bearbeitung in Google Docs" : selected?.name}</h2>
                {dialogMode === "edit" ? <p className="mt-1 text-sm text-slate-500">Änderungen werden automatisch in Google Docs gespeichert. Verwende nur vorhandene Variablen, setze Bild-Variablen per Alt-Text und halte die Vorlage bei maximal 1 Seite.</p> : null}
              </div>
              <button className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50" onClick={closeDialog}>Schließen</button>
            </div>

            {message ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}

            {dialogMode === "create" ? <TemplateForm mode="create" onSubmit={submitCreate} isPending={isPending} /> : null}

            {dialogMode === "edit" && selected ? (
              <div className="space-y-5">
                <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  <p className="font-semibold text-ink">Hinweise vor der Bearbeitung</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Änderungen werden automatisch gespeichert.</li>
                    <li>Nur vorhandene Variablen verwenden.</li>
                    <li>Bild-Variablen per Alt-Text setzen.</li>
                    <li>Maximal 1 Seite.</li>
                  </ul>
                </div>
                <button className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => openGoogleDocs(selected)}>Vorlage in Google Docs bearbeiten</button>
                <div className="border-t border-slate-200 pt-5">
                  <TemplateForm mode="edit" template={selected} onSubmit={submitEdit} isPending={isPending} />
                </div>
              </div>
            ) : null}

            {dialogMode === "view" && selected ? (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {selected.isSystemTemplate ? <StatusBadge tone="brand">Mustervorlage</StatusBadge> : null}
                  {selected.isInUse ? <StatusBadge tone="amber">In Verwendung</StatusBadge> : null}
                  {selected.isChecked ? <StatusBadge tone="green">Geprüft</StatusBadge> : <StatusBadge tone="red">Prüfung offen</StatusBadge>}
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selected.previewText || "Kein ausgelesener Text vorhanden."}</pre>
                <div>
                  <h3 className="font-semibold text-ink">Prüfung vor Versand</h3>
                  {issuesFor(selected).length === 0 ? <p className="mt-2 text-sm text-emerald-700">Keine Fehler erkannt.</p> : (
                    <ul className="mt-2 space-y-2">
                      {issuesFor(selected).map((issue, index) => <li key={`${issue.field}-${index}`} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{issue.message}</li>)}
                    </ul>
                  )}
                </div>
                {selected.googleDocUrl ? <button className="btn-secondary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => openGoogleDocs(selected)}>In Google Docs ansehen</button> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
