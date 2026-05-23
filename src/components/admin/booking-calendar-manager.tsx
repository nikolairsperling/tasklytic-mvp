"use client";

import type { BookingCalendar } from "@prisma/client";
import { CalendarCheck, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";
import { bookingProviderLabels, bookingProviders, bookingVariables } from "@/lib/booking-calendars";

type CalendarItem = Omit<BookingCalendar, "createdAt" | "updatedAt" | "lastTestedAt"> & {
  createdAt: string;
  updatedAt: string;
  lastTestedAt: string | null;
};

type EditorMode = "create" | "edit" | null;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("de-DE") : "Noch nicht getestet";
}

function testTone(status: string): "green" | "red" | "amber" | "neutral" {
  if (status === "reachable") return "green";
  if (status === "failed") return "red";
  if (status === "untested") return "neutral";
  return "amber";
}

function providerLabel(provider: string) {
  return bookingProviderLabels[provider as keyof typeof bookingProviderLabels] ?? provider;
}

function CalendarForm({
  mode,
  calendar,
  onSubmit,
  isPending
}: {
  mode: "create" | "edit";
  calendar: CalendarItem | null;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-600">Anbieter</span>
          <select name="provider" defaultValue={calendar?.provider ?? "cal_com"}>
            {bookingProviders.map((provider) => <option key={provider} value={provider}>{bookingProviderLabels[provider]}</option>)}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-600">Anzeigename</span>
          <input name="displayName" defaultValue={calendar?.displayName ?? ""} placeholder="Spedition Erstkontakt" required />
        </label>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Buchungslink</span>
        <input name="bookingUrl" type="url" defaultValue={calendar?.bookingUrl ?? ""} placeholder="https://cal.com/dein-team/erstgespraech" required />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-600">Beschreibung</span>
        <textarea name="description" rows={3} defaultValue={calendar?.description ?? ""} placeholder="Für Erstgespräche mit neuen Leads aus Print- oder LinkedIn-Kampagnen." />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={calendar?.isActive ?? true} />
          Aktiv
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
          <input type="checkbox" name="isDefault" defaultChecked={calendar?.isDefault ?? false} />
          Als Standardkalender setzen
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
          <input type="checkbox" name="clickTracking" defaultChecked={calendar?.clickTracking ?? false} />
          Klicktracking vorbereiten
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
          <input type="checkbox" name="conversionTracking" defaultChecked={calendar?.conversionTracking ?? false} />
          Conversiontracking vorbereiten
        </label>
      </div>
      <button disabled={isPending} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold">
        {mode === "create" ? "Kalender speichern" : "Änderungen speichern"}
      </button>
    </form>
  );
}

export function BookingCalendarManager({ calendars }: { calendars: CalendarItem[] }) {
  const [items, setItems] = useState(calendars);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(calendars.find((calendar) => calendar.isDefault) ?? calendars[0] ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedItems = useMemo(() => items, [items]);
  const previewCalendar = selected ?? sortedItems[0] ?? null;

  function closeEditor() {
    setEditorMode(null);
    setMessage(null);
  }

  function submit(formData: FormData) {
    const endpoint = editorMode === "edit" && selected ? `/api/assets/booking-calendars/${selected.id}` : "/api/assets/booking-calendars";
    const method = editorMode === "edit" ? "PATCH" : "POST";
    startTransition(async () => {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });
      const data = await response.json().catch(() => null) as CalendarItem | { error?: string } | null;
      if (!response.ok || !data || "error" in data) {
        setMessage(data && "error" in data ? data.error ?? "Kalender konnte nicht gespeichert werden." : "Kalender konnte nicht gespeichert werden.");
        return;
      }
      const saved = data as CalendarItem;
      setItems((current) => {
        const withoutSaved = current.filter((item) => item.id !== saved.id);
        const normalized = saved.isDefault ? withoutSaved.map((item) => ({ ...item, isDefault: false })) : withoutSaved;
        return [saved, ...normalized].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      });
      setSelected(saved);
      setEditorMode(null);
      setMessage("Buchungskalender gespeichert.");
    });
  }

  function deleteCalendar(calendar: CalendarItem) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/booking-calendars/${calendar.id}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage("Kalender konnte nicht gelöscht werden.");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== calendar.id));
      if (selected?.id === calendar.id) setSelected(null);
    });
  }

  function testCalendar(calendar: CalendarItem) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/booking-calendars/${calendar.id}/test`, { method: "POST" });
      const data = await response.json().catch(() => null) as { calendar?: CalendarItem; test?: { message?: string }; error?: string } | null;
      if (!response.ok || !data?.calendar) {
        setMessage(data?.error ?? "Kalender-Link konnte nicht getestet werden.");
        return;
      }
      setItems((current) => current.map((item) => item.id === data.calendar!.id ? data.calendar! : item));
      setSelected(data.calendar);
      setMessage(data.test?.message ?? "Test abgeschlossen.");
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] overflow-x-hidden">
      <PageHeader
        title="Buchungskalender"
        description="Zentrale Buchungslinks für Outreach-Kampagnen, Landingpages, Nachrichtenvorlagen und Briefe."
        backButton={<AdminBackButton href="/admin/assets" />}
        action={<button className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => { setSelected(null); setEditorMode("create"); }}><Plus size={16} />Neuen Kalender hinterlegen</button>}
      />

      {message ? <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="space-y-4">
          {sortedItems.length === 0 ? (
            <AdminCard>
              <div className="text-center">
                <CalendarCheck className="mx-auto h-10 w-10 text-slate-400" />
                <h2 className="mt-3 text-lg font-semibold text-ink">Noch kein Buchungskalender hinterlegt</h2>
                <p className="mt-2 text-sm text-slate-500">Lege Calendly, TidyCal, Cal.com oder einen eigenen Link an, damit die Variable {"{{Terminlink}}"} in Kampagnen nutzbar ist.</p>
                <button className="btn-primary mt-5 min-h-11 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => setEditorMode("create")}>Kalender anlegen</button>
              </div>
            </AdminCard>
          ) : null}

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            {sortedItems.map((calendar) => (
              <AdminCard key={calendar.id} className={selected?.id === calendar.id ? "ring-2 ring-blue-500" : ""}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-semibold text-ink">{calendar.displayName}</h2>
                    <p className="mt-1 text-sm text-slate-500">{providerLabel(calendar.provider)}</p>
                    {calendar.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{calendar.description}</p> : null}
                  </div>
                  <StatusBadge tone={calendar.isActive ? "green" : "neutral"}>{calendar.isActive ? "Aktiv" : "Inaktiv"}</StatusBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {calendar.isDefault ? <StatusBadge tone="brand">Standardkalender</StatusBadge> : null}
                  <StatusBadge tone={testTone(calendar.lastTestStatus)}>{calendar.lastTestStatus === "reachable" ? "Link erreichbar" : calendar.lastTestStatus === "failed" ? "Test fehlgeschlagen" : "Nicht getestet"}</StatusBadge>
                  {calendar.clickTracking ? <StatusBadge tone="amber">Klicktracking vorbereitet</StatusBadge> : null}
                  {calendar.conversionTracking ? <StatusBadge tone="amber">Conversiontracking vorbereitet</StatusBadge> : null}
                </div>
                <p className="mt-4 break-all rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{calendar.bookingUrl}</p>
                <p className="mt-3 text-xs text-slate-400">Letzter Test: {formatDate(calendar.lastTestedAt)}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => setSelected(calendar)}>Vorschau</button>
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => testCalendar(calendar)}>Link testen</button>
                  <a className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" href={calendar.bookingUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline" size={14} />Öffnen</a>
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setSelected(calendar); setEditorMode("edit"); }}><Pencil className="mr-1 inline" size={14} />Bearbeiten</button>
                  <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => deleteCalendar(calendar)}><Trash2 className="mr-1 inline" size={14} />Löschen</button>
                </div>
              </AdminCard>
            ))}
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <AdminCard>
            <h2 className="text-lg font-semibold text-ink">Embedded Vorschau</h2>
            {previewCalendar ? (
              <>
                <p className="mt-1 text-sm text-slate-500">{previewCalendar.displayName}</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <iframe src={previewCalendar.bookingUrl} title={`Vorschau ${previewCalendar.displayName}`} loading="lazy" className="h-[520px] w-full" />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Wähle oder erstelle einen Kalender, um die eingebettete Vorschau zu sehen.</p>
            )}
          </AdminCard>
          <AdminCard>
            <h2 className="text-lg font-semibold text-ink">Variablen</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Der Standardkalender wird für diese Variablen verwendet und kann in Nachrichtenvorlagen, Landingpages, Briefvorlagen und E-Mail-Sequenzen eingesetzt werden.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {bookingVariables.map((variable) => <code key={variable} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">{variable}</code>)}
            </div>
          </AdminCard>
          <AdminCard>
            <h2 className="text-lg font-semibold text-ink">Tracking</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Klicktracking: vorbereitet pro Kalender.</p>
              <p>Conversiontracking: vorbereitet für Termin gebucht ja/nein.</p>
              <p>Zuordnung zu Kampagne und Lead erfolgt über bestehende Prospect-Events.</p>
            </div>
          </AdminCard>
        </aside>
      </div>

      {editorMode ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">{editorMode === "create" ? "Buchungskalender hinterlegen" : "Buchungskalender bearbeiten"}</h2>
                <p className="mt-1 text-sm text-slate-500">Speichere zentrale Buchungslinks für wiederverwendbare Kampagnenvariablen.</p>
              </div>
              <button className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50" onClick={closeEditor}>Schließen</button>
            </div>
            <CalendarForm mode={editorMode} calendar={editorMode === "edit" ? selected : null} onSubmit={submit} isPending={isPending} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
