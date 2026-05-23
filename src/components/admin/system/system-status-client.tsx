"use client";

import { AlertTriangle, CheckCircle2, Clipboard, RefreshCw, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";
import { parseSafeJson, safeFetch } from "@/lib/safe-fetch";

type ErrorLog = {
  id: string;
  requestId: string;
  createdAt: string;
  area: string;
  action: string;
  apiRoute?: string | null;
  method?: string | null;
  httpStatus?: number | null;
  errorCode: string;
  userMessage: string;
  technicalDetail?: string | null;
  responseBody?: string | null;
  durationMs?: number | null;
  affectedType?: string | null;
  affectedId?: string | null;
  source: string;
};

type SmokeResult = {
  name: string;
  area: string;
  action: string;
  status: "ok" | "warning" | "error";
  durationMs: number;
  message: string;
  requestId?: string;
};

export function SystemStatusClient() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState("");
  const [smokeResults, setSmokeResults] = useState<SmokeResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((entry) => [
      entry.area,
      entry.action,
      entry.apiRoute,
      entry.errorCode,
      entry.userMessage,
      entry.requestId,
      entry.affectedType,
      entry.affectedId
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [logs, query]);

  useEffect(() => {
    void loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const response = await safeFetch("/api/system/errors?limit=100", { area: "system", action: "load-error-log", timeoutMs: 10000 });
      const data = await parseSafeJson<{ items: ErrorLog[] }>(response);
      setLogs(data.items);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Fehler-ID: ${"requestId" in error ? error.requestId : "unbekannt"}` : "API nicht erreichbar.");
    } finally {
      setLoading(false);
    }
  }

  async function runSmokeTest() {
    setRunning(true);
    try {
      const response = await safeFetch("/api/system/smoke-test", { method: "POST", area: "system", action: "run-smoke-test", timeoutMs: 60000 });
      const data = await parseSafeJson<{ items: SmokeResult[] }>(response);
      setSmokeResults(data.items);
      setMessage("Systemtest abgeschlossen.");
      await loadLogs();
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Fehler-ID: ${"requestId" in error ? error.requestId : "unbekannt"}` : "API nicht erreichbar.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <PageHeader
        title="Systemstatus / Fehlerdiagnose"
        description="Zentrale Diagnose für API-Fehler, Ladeprobleme, externe Dienste und kontrollierte Funktionstests."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadLogs()} className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold">
              <RefreshCw className="h-4 w-4" /> Aktualisieren
            </button>
            <button type="button" onClick={() => void runSmokeTest()} disabled={running} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" /> {running ? "Teste..." : "Alle Funktionen testen"}
            </button>
          </div>
        }
      />

      {message ? <AdminCard className="mb-4 text-sm text-slate-700">{message}</AdminCard> : null}

      {smokeResults.length > 0 ? (
        <AdminCard className="mb-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Systemtest</h2>
            <StatusBadge tone={smokeResults.some((entry) => entry.status === "error") ? "red" : smokeResults.some((entry) => entry.status === "warning") ? "amber" : "green"}>
              {smokeResults.filter((entry) => entry.status === "ok").length} OK · {smokeResults.filter((entry) => entry.status === "warning").length} Warnung · {smokeResults.filter((entry) => entry.status === "error").length} Fehler
            </StatusBadge>
          </div>
          <div className="grid gap-2">
            {smokeResults.map((entry) => (
              <div key={`${entry.area}-${entry.action}`} className="grid gap-3 rounded-xl border border-slate-100 p-3 text-sm md:grid-cols-[220px_120px_1fr_90px]">
                <div className="font-semibold text-ink">{entry.name}</div>
                <div>{statusBadge(entry.status)}</div>
                <div className="min-w-0 break-words text-slate-600">{entry.message}</div>
                <div className="text-right text-slate-500">{entry.durationMs} ms</div>
              </div>
            ))}
          </div>
        </AdminCard>
      ) : null}

      <AdminCard>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Fehlerprotokoll</h2>
            <p className="text-sm text-slate-500">{loading ? "Lade..." : `${filteredLogs.length} Einträge sichtbar`}</p>
          </div>
          <label className="relative block w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suchen nach Bereich, Fehler-ID, Route..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm" />
          </label>
        </div>

        <div className="grid gap-3">
          {filteredLogs.map((entry) => (
            <details key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <summary className="cursor-pointer list-none">
                <div className="grid gap-3 text-sm lg:grid-cols-[150px_130px_150px_1fr_120px]">
                  <div className="text-slate-500">{formatDate(entry.createdAt)}</div>
                  <div className="font-semibold text-ink">{entry.area}</div>
                  <div>{entry.httpStatus ? <StatusBadge tone={entry.httpStatus >= 500 ? "red" : "amber"}>HTTP {entry.httpStatus}</StatusBadge> : <StatusBadge>{entry.source}</StatusBadge>}</div>
                  <div className="min-w-0">
                    <p className="break-words font-medium text-ink">{entry.userMessage}</p>
                    <p className="break-all text-xs text-slate-500">Fehler-ID: {entry.requestId}</p>
                  </div>
                  <div className="text-right text-slate-500">
                    <span>{entry.durationMs ?? "-"} ms</span>
                    <span className="mt-1 block text-xs font-semibold text-blue-700">Details anzeigen</span>
                  </div>
                </div>
              </summary>
              <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm">
                <Info label="Aktion" value={entry.action} />
                <Info label="API Route" value={entry.apiRoute ?? "-"} />
                <Info label="Fehlercode" value={entry.errorCode} />
                <Info label="Betroffen" value={[entry.affectedType, entry.affectedId].filter(Boolean).join(": ") || "-"} />
                <Info label="Technische Details" value={entry.technicalDetail || entry.responseBody || "-"} pre />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyError(entry)} className="btn-secondary inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold">
                    <Clipboard className="h-4 w-4" /> Fehler kopieren
                  </button>
                  <button type="button" onClick={() => void retryEntry(entry)} className="btn-secondary inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold">
                    <RefreshCw className="h-4 w-4" /> Erneut versuchen
                  </button>
                </div>
              </div>
            </details>
          ))}
          {!loading && filteredLogs.length === 0 ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">Keine Fehler im Protokoll.</p> : null}
        </div>
      </AdminCard>
    </div>
  );
}

function statusBadge(status: SmokeResult["status"]) {
  if (status === "ok") return <StatusBadge tone="green"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> OK</StatusBadge>;
  if (status === "warning") return <StatusBadge tone="amber"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> Warnung</StatusBadge>;
  return <StatusBadge tone="red"><XCircle className="mr-1 h-3.5 w-3.5" /> Fehler</StatusBadge>;
}

function Info({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  return (
    <div className="grid gap-1 md:grid-cols-[160px_1fr]">
      <span className="font-semibold text-slate-600">{label}</span>
      {pre ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">{value}</pre> : <span className="break-words text-slate-700">{value}</span>}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

async function copyError(entry: ErrorLog) {
  const text = [
    `Fehler-ID: ${entry.requestId}`,
    `Zeitpunkt: ${entry.createdAt}`,
    `Bereich: ${entry.area}`,
    `Aktion: ${entry.action}`,
    `Route: ${entry.apiRoute ?? "-"}`,
    `HTTP: ${entry.httpStatus ?? "-"}`,
    `Code: ${entry.errorCode}`,
    `Meldung: ${entry.userMessage}`,
    `Details: ${entry.technicalDetail || entry.responseBody || "-"}`
  ].join("\n");
  await navigator.clipboard.writeText(text).catch(() => undefined);
}

async function retryEntry(entry: ErrorLog) {
  if (!entry.apiRoute || entry.method && !["GET", "HEAD"].includes(entry.method)) return;
  await safeFetch(entry.apiRoute, { method: entry.method ?? "GET", area: entry.area, action: `retry-${entry.action}`, timeoutMs: 15000 }).catch(() => undefined);
}
