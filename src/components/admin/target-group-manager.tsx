"use client";

import React, { useState, useTransition } from "react";

type TargetGroupItem = {
  id: string;
  name: string;
  description: string | null;
  industryKeywords: unknown;
  painKeywords: unknown;
  icpRules: unknown;
  emailTone: string;
  landingpageStyle: string;
  videoStyle: string;
};

export function TargetGroupManager({ initialTargetGroups }: { initialTargetGroups: TargetGroupItem[] }) {
  const [targetGroups, setTargetGroups] = useState(initialTargetGroups);
  const [editing, setEditing] = useState<TargetGroupItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        setMessage(null);
        await action();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Aktion fehlgeschlagen");
      }
    });
  }

  async function save(formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const endpoint = editing ? `/api/target-groups/${editing.id}` : "/api/target-groups";
    const response = await fetch(endpoint, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => null) as TargetGroupItem | { error?: string } | null;
    if (!response.ok || !body || isErrorBody(body)) throw new Error(isErrorBody(body) ? body.error ?? "Speichern fehlgeschlagen" : "Speichern fehlgeschlagen");
    setTargetGroups((current) => editing ? current.map((item) => item.id === body.id ? body : item) : [body, ...current]);
    setEditing(null);
    setMessage("Zielgruppe gespeichert");
  }

  async function remove(id: string) {
    const response = await fetch(`/api/target-groups/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Löschen fehlgeschlagen");
    setTargetGroups((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold text-ink">{editing ? "Zielgruppe bearbeiten" : "Zielgruppe erstellen"}</h2>
        {message ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
        <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); run(() => save(new FormData(event.currentTarget))); }}>
          <Field name="name" label="Name" required defaultValue={editing?.name} />
          <Area name="description" label="Beschreibung" defaultValue={editing?.description ?? ""} />
          <Area name="industryKeywords" label="Branchen Keywords" defaultValue={formatValue(editing?.industryKeywords)} />
          <Area name="painKeywords" label="Pain Keywords" defaultValue={formatValue(editing?.painKeywords)} />
          <Area name="icpRules" label="ICP Regeln" defaultValue={formatRules(editing?.icpRules)} />
          <Field name="emailTone" label="Stil der Ansprache" defaultValue={editing?.emailTone ?? "direkt"} />
          <Field name="landingpageStyle" label="Landingpage Style" defaultValue={editing?.landingpageStyle ?? "professionell"} />
          <Field name="videoStyle" label="Video Style" defaultValue={editing?.videoStyle ?? "kurz und persönlich"} />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isPending} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">Speichern</button>
            {editing ? <button type="button" onClick={() => setEditing(null)} className="btn-secondary rounded-xl px-4 py-2 text-sm font-semibold">Abbrechen</button> : null}
          </div>
        </form>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold text-ink">Zielgruppen</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {targetGroups.map((item) => (
            <div key={item.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.description ?? "Keine Beschreibung"}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatValue(item.industryKeywords)}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(item)} className="btn-secondary rounded-xl px-3 py-2 text-sm">Bearbeiten</button>
                  <button type="button" onClick={() => run(() => remove(item.id))} className="btn-danger rounded-xl px-3 py-2 text-sm">Löschen</button>
                </div>
              </div>
            </div>
          ))}
          {targetGroups.length === 0 ? <p className="py-8 text-sm text-slate-500">Noch keine Zielgruppen.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Field({ name, label, defaultValue = "", required = false }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">{label}</span><input name={name} required={required} defaultValue={defaultValue} /></label>;
}

function Area({ name, label, defaultValue = "" }: { name: string; label: string; defaultValue?: string }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-600">{label}</span><textarea name={name} rows={3} defaultValue={defaultValue} /></label>;
}

function isErrorBody(value: TargetGroupItem | { error?: string } | null): value is { error?: string } {
  return Boolean(value && "error" in value);
}

function formatValue(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : "";
}

function formatRules(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}
