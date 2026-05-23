"use client";

import type { LandingpageTemplate } from "@prisma/client";
import { Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useState, useTransition, type ReactNode } from "react";

type TemplateSummary = Omit<Pick<LandingpageTemplate, "id" | "name" | "heroHeadline" | "updatedAt" | "isDefault" | "bookingMode">, "updatedAt"> & {
  updatedAt: Date | string;
};

export function LandingpageTemplateManager({ templates }: { templates: TemplateSummary[] }) {
  const [items, setItems] = useState(templates);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateSummary | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<TemplateSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createTemplate() {
    startTransition(async () => {
      const response = await fetch("/api/landingpage-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Neue Landingpage Vorlage" })
      });
      const template = await response.json().catch(() => null) as TemplateSummary | { error?: string } | null;
      if (!response.ok || !isTemplateSummary(template)) {
        setMessage(readError(template) ?? "Vorlage konnte nicht erstellt werden.");
        return;
      }
      window.location.href = `/admin/landingpages/templates/${template.id}/builder`;
    });
  }

  function duplicateTemplate(template: TemplateSummary) {
    startTransition(async () => {
      const response = await fetch(`/api/landingpage-templates/${template.id}/duplicate`, { method: "POST" });
      const copy = await response.json().catch(() => null) as TemplateSummary | { error?: string } | null;
      if (!response.ok || !isTemplateSummary(copy)) {
        setMessage(readError(copy) ?? "Vorlage konnte nicht dupliziert werden.");
        return;
      }
      setItems((current) => [copy, ...current]);
      setMessage("Vorlage dupliziert.");
    });
  }

  function deleteConfirmed() {
    if (!deleteTemplate) return;
    startTransition(async () => {
      const response = await fetch(`/api/landingpage-templates/${deleteTemplate.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setMessage(data?.error ?? "Vorlage konnte nicht gelöscht werden.");
        return;
      }
      setItems((current) => current.filter((template) => template.id !== deleteTemplate.id));
      setDeleteTemplate(null);
      setMessage("Vorlage gelöscht.");
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink md:text-3xl">Landing Page Vorlagen</h1>
          <p className="mt-1 text-sm text-slate-500">Verwalte deine Vorlagen für personalisierte Landing Pages.</p>
        </div>
        <button type="button" onClick={createTemplate} disabled={isPending} className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Neue Vorlage
        </button>
      </div>
      {message ? <p role="status" className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {items.map((template) => (
          <article key={template.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
            <div className="relative h-36 bg-slate-950 p-4 text-white">
              <div className="absolute inset-x-4 top-4 h-3 rounded-full bg-white/20" />
              <div className="mt-8 h-8 w-3/4 rounded-lg bg-white/90" />
              <div className="mt-3 h-3 w-1/2 rounded-full bg-white/40" />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-ink">{template.name || "Landingpage Vorlage"}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{template.heroHeadline || "Version für personalisierte Landingpages"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{template.isDefault ? "Standard" : "Vorlage"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Tag>Tracking</Tag>
                <Tag>Cookie</Tag>
                <Tag>{template.bookingMode === "external_link" ? "Externe Buchung" : "Direktbuchung"}</Tag>
              </div>
              <p className="mt-4 text-xs text-slate-400">Zuletzt bearbeitet: {formatDate(template.updatedAt)}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPreviewTemplate(template)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  <Eye className="mr-1 inline h-4 w-4" aria-hidden="true" /> Vorschau
                </button>
                <Link href={`/admin/landingpages/templates/${template.id}/builder`} className="rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-700">
                  <Pencil className="mr-1 inline h-4 w-4" aria-hidden="true" /> Bearbeiten
                </Link>
                <button type="button" onClick={() => duplicateTemplate(template)} disabled={isPending} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  <Copy className="mr-1 inline h-4 w-4" aria-hidden="true" /> Duplizieren
                </button>
                <button type="button" onClick={() => setDeleteTemplate(template)} disabled={isPending} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">
                  <Trash2 className="mr-1 inline h-4 w-4" aria-hidden="true" /> Löschen
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {previewTemplate ? <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} /> : null}
      {deleteTemplate ? (
        <ConfirmModal
          title="Diese Vorlage wirklich löschen?"
          disabled={isPending}
          onCancel={() => setDeleteTemplate(null)}
          onConfirm={deleteConfirmed}
        />
      ) : null}
    </div>
  );
}

function PreviewModal({ template, onClose }: { template: TemplateSummary; onClose: () => void }) {
  const href = `/admin/landingpages/templates/${template.id}/preview`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="template-preview-title" className="text-xl font-semibold text-ink">Vorschau mit Beispiel-Lead</h2>
        <p className="mt-3 text-sm text-slate-600">So sieht deine Landingpage später für einen Endkunden aus.</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">Die Vorschau zeigt deine Vorlage mit anonymisierten Beispieldaten. So siehst du sofort, wie deine Landingpage später für einen Endkunden aussehen wird.</p>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Es werden keine Credits verbraucht, kein Lead in deiner Datenbank angelegt und kein Tracking ausgelöst.</p>
        <p className="mt-4 break-all rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">https://tasklytic.dealsky.app/max-mustermann</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Schließen</button>
          <Link href={href} target="_blank" className="btn-primary rounded-xl px-4 py-2.5 text-center text-sm font-semibold">Vorschau in neuem Tab öffnen</Link>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, disabled, onCancel, onConfirm }: { title: string; disabled?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="delete-template-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="delete-template-title" className="text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Nur die Vorlage wird gelöscht. Bereits generierte Landingpages werden nicht gelöscht.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Abbrechen</button>
          <button type="button" onClick={onConfirm} disabled={disabled} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Löschen</button>
        </div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{children}</span>;
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function isTemplateSummary(value: TemplateSummary | { error?: string } | null): value is TemplateSummary {
  return Boolean(value && "id" in value && typeof value.id === "string");
}

function readError(value: TemplateSummary | { error?: string } | null) {
  return value && "error" in value ? value.error : undefined;
}
