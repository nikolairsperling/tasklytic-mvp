"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";

type PreviewResponse = {
  filename: string;
  detectedColumns: string[];
  previewRows: Array<Record<string, string>>;
  rows: Array<Record<string, string>>;
  suggestedMapping: Record<string, string>;
  importPreview?: ImportPreview;
};

type ImportPreview = {
  validRows: number;
  invalidRows: number;
  newLeads: number;
  duplicates: number;
  leadsToEnrich: number;
  faultyRows: number;
  skippedRows: number;
  sampleRows: Array<Record<string, unknown>>;
  warnings: Array<{ row: number; field: string; message: string }>;
  errors: Array<{ row: number; field: string; message: string }>;
};

type LeadListOption = { id: string; name: string };
type ImportIssue = { row: number; field: string; message: string };
export type ImportSummary = {
  success?: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  skippedDuplicates?: number;
  failed?: number;
  warnings?: ImportIssue[];
  errors?: ImportIssue[];
  fatalErrors?: ImportIssue[];
  error?: string;
  batchId?: string;
};

const targetFields = ["", "companyName", "legalName", "city", "postalCode", "street", "phone", "email", "decisionMakerEmail", "companyEmail", "websiteUrl", "decisionMakerName", "employeeCount", "employeeRange"];
const companyFallbackColumns = ["Firma", "firma", "Unternehmen", "unternehmen", "Name", "name", "Company", "company"];
const duplicateModes = [
  { value: "skip", label: "Duplikate überspringen" },
  { value: "enrich", label: "Bestehende Leads ergänzen" },
  { value: "overwrite", label: "Bestehende Leads überschreiben" },
  { value: "create", label: "Als neue Leads trotzdem importieren" }
] as const;
type DuplicateMode = (typeof duplicateModes)[number]["value"];

export function LeadImportWizard() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [serverPreview, setServerPreview] = useState<ImportPreview | null>(null);
  const [leadListId, setLeadListId] = useState("");
  const [leadLists, setLeadLists] = useState<LeadListOption[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const localPreview = useMemo(() => preview ? buildImportPreview(preview.rows, mapping) : null, [preview, mapping]);
  const currentPreview = serverPreview ?? localPreview;

  useEffect(() => {
    if (!preview) {
      setServerPreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch("/api/prospects/import/file/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows, mapping, duplicateMode }),
        signal: controller.signal
      }).catch(() => null);
      const data = await response?.json().catch(() => null) as ImportPreview | null;
      if (response?.ok && data) setServerPreview(data);
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [preview, mapping, duplicateMode]);

  function upload(file: File | null) {
    if (!file) return;
    startTransition(async () => {
      setMessage(null);
      setResult(null);
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/prospects/import/file", { method: "POST", body: formData });
      const data = await response.json().catch(() => null) as PreviewResponse & { error?: string } | null;
      if (!response.ok || !data) {
        setMessage(data?.error ?? "Vorschau fehlgeschlagen.");
        return;
      }
      setPreview(data);
      setMapping(data.suggestedMapping ?? {});
      setServerPreview(data.importPreview ?? null);
      const listsResponse = await fetch("/api/lead-lists", { cache: "no-store" }).catch(() => null);
      const listsData = await listsResponse?.json().catch(() => null) as { data?: LeadListOption[] } | null;
      setLeadLists(listsData?.data?.map((list) => ({ id: list.id, name: list.name })) ?? []);
    });
  }

  function confirmImport() {
    if (!preview) return;
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/prospects/import/file/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: preview.filename, rows: preview.rows, mapping, duplicateMode, leadListId })
      });
      console.log("IMPORT CONFIRM RESPONSE", response);
      const data = await response.json().catch(() => null) as ImportSummary | null;
      console.log("IMPORT SUMMARY", data);
      if (!data || isImportFailure(response, data)) {
        const errorMessage = data?.error ?? "Import fehlgeschlagen.";
        setMessage(errorMessage);
        setToast(errorMessage);
        return;
      }
      setResult(data);
      setMessage(null);
      setToast(formatImportSuccessMessage(data));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Lead Import" description="CSV- und XLSX-Dateien hochladen, Mapping prüfen und Prospects kontrolliert importieren." backButton={<AdminBackButton href="/admin/dashboard" />} />

      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">1. Datei hochladen</h2>
            <p className="mt-1 text-sm text-slate-500">Unterstützt CSV und XLSX. Es wird nichts serverseitig gespeichert, bevor du den Import bestätigst.</p>
          </div>
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => upload(event.target.files?.[0] ?? null)} disabled={isPending} />
        </div>
      </AdminCard>

      {preview ? (
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">2. Mapping prüfen</h2>
              <p className="mt-1 text-sm text-slate-500">{preview.filename} · {preview.rows.length} Zeilen erkannt</p>
            </div>
            <StatusBadge>{preview.detectedColumns.length} Spalten</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {preview.detectedColumns.map((column) => (
              <label key={column} className="block space-y-2 rounded-2xl border border-slate-200 p-3">
                <span className="text-sm font-medium text-slate-600">{column}</span>
                <select value={mapping[column] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [column]: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {targetFields.map((field) => <option key={field || "skip"} value={field}>{field || "nicht importieren"}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <fieldset className="rounded-2xl border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium text-slate-600">Duplikate gefunden: {currentPreview?.duplicates ?? preview.importPreview?.duplicates ?? 0}</legend>
              <div className="mt-2 grid gap-2 text-sm text-slate-700">
                {duplicateModes.map((mode) => (
                  <label key={mode.value} className="flex min-h-9 items-center gap-2 rounded-xl px-2 transition hover:bg-slate-50">
                    <input type="radio" name="duplicateMode" value={mode.value} checked={duplicateMode === mode.value} onChange={() => setDuplicateMode(mode.value)} />
                    {mode.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block space-y-2 rounded-2xl border border-slate-200 p-3">
              <span className="text-sm font-medium text-slate-600">Leadliste</span>
              <select value={leadListId} onChange={(event) => setLeadListId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Keine Leadliste</option>
                {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
            </label>
          </div>
        </AdminCard>
      ) : null}

      {preview ? (
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">3. Vorschau</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="text-xs uppercase text-blue-700">neue Leads</p>
              <p className="mt-2 text-2xl font-semibold text-blue-900">{currentPreview?.newLeads ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs uppercase text-amber-700">Duplikate</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{currentPreview?.duplicates ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-4">
              <p className="text-xs uppercase text-indigo-700">zu ergänzen</p>
              <p className="mt-2 text-2xl font-semibold text-indigo-900">{currentPreview?.leadsToEnrich ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-green-50 p-4">
              <p className="text-xs uppercase text-green-700">gültige Zeilen</p>
              <p className="mt-2 text-2xl font-semibold text-green-900">{currentPreview?.validRows ?? preview.importPreview?.validRows ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="text-xs uppercase text-red-700">fehlerhafte Zeilen</p>
              <p className="mt-2 text-2xl font-semibold text-red-900">{currentPreview?.faultyRows ?? currentPreview?.invalidRows ?? preview.importPreview?.invalidRows ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">übersprungen</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{currentPreview?.skippedRows ?? 0}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {preview.previewRows.slice(0, 5).map((row, index) => (
              <article key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Zeile {index + 1}</p>
                <div className="mt-3 grid gap-2">
                  {preview.detectedColumns.slice(0, 6).map((column) => (
                    <div key={column} className="min-w-0">
                      <p className="text-xs text-slate-400">{column}</p>
                      <p className="break-words text-sm font-medium text-slate-700">{row[column] || "leer"}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{preview.detectedColumns.map((column) => <th key={column} className="p-3">{column}</th>)}</tr>
              </thead>
              <tbody>
                {preview.previewRows.slice(0, 5).map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    {preview.detectedColumns.map((column) => <td key={column} className="p-3">{row[column]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {((currentPreview?.warnings.length ?? 0) > 0 || (currentPreview?.errors.length ?? 0) > 0) ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Hinweise und Fehler</p>
              {(currentPreview?.warnings.length ?? 0) > 0 ? (
                <ul className="space-y-1 text-sm text-amber-800">
                  {currentPreview?.warnings.slice(0, 20).map((warning) => <li key={`warning-${warning.row}-${warning.field}-${warning.message}`} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">Zeile {warning.row}: {formatImportIssue(warning, "warning")}</li>)}
                </ul>
              ) : null}
              {(currentPreview?.errors.length ?? 0) > 0 ? (
                <ul className="space-y-1 text-sm text-red-700">
                  {currentPreview?.errors.slice(0, 20).map((error) => <li key={`error-${error.row}-${error.field}-${error.message}`} className="rounded-xl border border-red-100 bg-red-50 px-3 py-2">Zeile {error.row}: {formatImportIssue(error, "error")}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
          <button type="button" onClick={confirmImport} disabled={isPending || (currentPreview?.validRows ?? 0) === 0} className="btn-primary mt-5 rounded-full px-4 py-3 text-sm font-semibold">
            Import bestätigen
          </button>
        </AdminCard>
      ) : null}

      {result ? (
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">4. Ergebnis</h2>
          <p className="mt-1 text-sm font-medium text-green-700">Import abgeschlossen</p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              ["created", "Erstellt"],
              ["updated", "Aktualisiert"],
              ["skippedDuplicates", "Duplikate übersprungen"],
              ["failed", "Fehlgeschlagen"],
              ["warnings", "Hinweise"]
            ].map(([key, label]) => {
              const tone = key === "warnings" ? "bg-amber-50 text-amber-800" : key === "failed" ? "bg-red-50 text-red-800" : "bg-slate-50 text-slate-500";
              return (
                <div key={key} className={`rounded-2xl p-4 ${tone}`}>
                  <p className="text-xs uppercase">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{key === "warnings" && Array.isArray(result.warnings) ? String(result.warnings.length) : String(result[key] ?? 0)}</p>
                </div>
              );
            })}
          </div>
          {Array.isArray(result.warnings) && result.warnings.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              {(result.warnings as Array<{ row: number; field: string; message: string }>).slice(0, 20).map((warning) => <p key={`${warning.row}-${warning.field}-${warning.message}`}>Zeile {warning.row}: {formatImportIssue(warning, "warning")}</p>)}
            </div>
          ) : null}
          {Array.isArray(result.errors) && result.errors.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {(result.errors as Array<{ row: number; field: string; message: string }>).slice(0, 20).map((error) => <p key={`${error.row}-${error.field}-${error.message}`}>Zeile {error.row}: {formatImportIssue(error, "error")}</p>)}
            </div>
          ) : null}
          {result.batchId ? <p className="mt-4 text-sm text-slate-500">Batch-ID: {String(result.batchId)}</p> : null}
        </AdminCard>
      ) : null}

      {message ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{message}</p> : null}
      {toast ? (
        <div className="fixed right-4 top-4 z-50 w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <p>{toast}</p>
            <button type="button" onClick={() => setToast(null)} className="rounded-full px-2 py-1 text-sm font-semibold text-slate-500">Schließen</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildImportPreview(rows: Array<Record<string, string>>, mapping: Record<string, string>): ImportPreview {
  const errors: Array<{ row: number; field: string; message: string }> = [];
  const sampleRows: Array<Record<string, unknown>> = [];
  let validRows = 0;

  rows.forEach((row, index) => {
    const mapped = mapRow(row, mapping);
    if (!String(mapped.companyName ?? "").trim()) {
      errors.push({ row: index + 2, field: "companyName", message: "Firma fehlt." });
      return;
    }
    validRows += 1;
    if (sampleRows.length < 5) sampleRows.push(mapped);
  });

  return { validRows, invalidRows: errors.length, newLeads: validRows, duplicates: 0, leadsToEnrich: 0, faultyRows: errors.length, skippedRows: 0, sampleRows, warnings: [], errors };
}

function mapRow(row: Record<string, string>, mapping: Record<string, string>) {
  const mapped: Record<string, unknown> = {};
  for (const [source, target] of Object.entries(mapping)) {
    if (!target) continue;
    const value = String(row[source] ?? "").trim();
    if (!value) continue;
    const normalizedTarget = target === "email" ? "companyEmail" : target === "website" ? "websiteUrl" : target;
    mapped[normalizedTarget] = value;
  }
  if (!mapped.companyName) {
    mapped.companyName = mapped.legalName || companyFallbackColumns.map((column) => row[column]).find((value) => String(value ?? "").trim());
  }
  return mapped;
}

function formatImportIssue(issue: { field?: string; message: string }, type: "warning" | "error") {
  if (type === "warning" && issue.field === "decisionMakerEmail") return "E-Mail ungültig, Lead wurde trotzdem importiert.";
  if (type === "warning" && issue.field === "websiteUrl") return "Website ungültig, Feld wurde leer gelassen.";
  return issue.message;
}

export function isImportFailure(response: Pick<Response, "ok" | "status">, summary: ImportSummary) {
  const created = Number(summary.created ?? 0);
  const updated = Number(summary.updated ?? 0);
  const skippedDuplicates = Number(summary.skippedDuplicates ?? 0);
  const fatalErrors = Array.isArray(summary.fatalErrors) ? summary.fatalErrors : Array.isArray(summary.errors) ? summary.errors : [];
  const hasSuccessfulOutcome = created > 0 || updated > 0 || skippedDuplicates > 0;

  if (response.status >= 400 || !response.ok) return true;
  if (summary.success === false) return true;
  return fatalErrors.length > 0 && !hasSuccessfulOutcome;
}

export function formatImportSuccessMessage(summary: ImportSummary) {
  return [
    "Import abgeschlossen.",
    `${Number(summary.created ?? 0)} neue Leads erstellt.`,
    `${Number(summary.skippedDuplicates ?? 0)} Duplikate übersprungen.`,
    `${Number(summary.updated ?? 0)} aktualisiert.`,
    `Hinweise: ${Array.isArray(summary.warnings) ? summary.warnings.length : 0}`
  ].join(" ");
}
