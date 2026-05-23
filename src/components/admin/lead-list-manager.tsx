"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

export type LeadListManagerItem = {
  id: string;
  name: string;
  description: string | null;
  targetGroupId: string | null;
  targetGroup: { id: string; name: string } | null;
  members: Array<{
    id: string;
    prospect: { id: string; companyName: string; decisionMakerName: string | null; decisionMakerEmail: string | null; companyEmail: string | null; status: string };
  }>;
};

export function LeadListManager({ initialLists, targetGroups }: { initialLists: LeadListManagerItem[]; targetGroups: Array<{ id: string; name: string }> }) {
  const [lists, setLists] = useState(initialLists);
  const [editing, setEditing] = useState<LeadListManagerItem | null>(null);
  const [form, setForm] = useState({ name: "", description: "", targetGroupId: "" });
  const [message, setMessage] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setForm({ name: "", description: "", targetGroupId: "" });
  }

  function startEdit(list: LeadListManagerItem) {
    setEditing(list);
    setForm({ name: list.name, description: list.description ?? "", targetGroupId: list.targetGroupId ?? "" });
  }

  async function save() {
    setMessage(null);
    const response = await fetch(editing ? `/api/lead-lists/${editing.id}` : "/api/lead-lists", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const body = await response.json().catch(() => null) as { id?: string; error?: string } | null;
    if (!response.ok || !body?.id) {
      setMessage(body?.error ?? "Leadliste konnte nicht gespeichert werden.");
      return;
    }
    window.location.reload();
  }

  async function remove(id: string) {
    setMessage(null);
    const response = await fetch(`/api/lead-lists/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(body?.error ?? "Leadliste konnte nicht gelöscht werden.");
      return;
    }
    setLists((current) => current.filter((list) => list.id !== id));
    if (editing?.id === id) startCreate();
    window.location.reload();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-2xl bg-white p-5 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">{editing ? "Leadliste bearbeiten" : "Leadliste erstellen"}</h2>
          {editing ? <button type="button" onClick={startCreate} className="text-sm font-semibold text-blue-700">Neu</button> : null}
        </div>
        {message ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
        <div className="mt-4 space-y-3">
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Beschreibung" className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.targetGroupId} onChange={(event) => setForm((current) => ({ ...current, targetGroupId: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="">Keine Zielgruppe</option>
            {targetGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <button type="button" onClick={() => void save()} disabled={!form.name.trim()} className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Speichern</button>
        </div>
      </section>

      <section className="space-y-3">
        {lists.map((list) => (
          <article key={list.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-ink">{list.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{list.description || "Keine Beschreibung"}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">{list.targetGroup?.name ?? "Keine Zielgruppe"} · {list.members.length} Leads</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(list)} aria-label="Bearbeiten" className="btn-secondary grid h-10 w-10 place-items-center rounded-xl"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => void remove(list.id)} aria-label="Löschen" className="grid h-10 w-10 place-items-center rounded-xl border border-red-100 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {list.members.slice(0, 8).map((member) => (
                <Link key={member.id} href={`/admin/prospects?prospectId=${member.prospect.id}`} className="grid gap-1 px-3 py-2 text-sm hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_220px_100px]">
                  <span className="truncate font-medium text-slate-700">{member.prospect.companyName}</span>
                  <span className="truncate text-slate-500">{member.prospect.decisionMakerEmail ?? member.prospect.companyEmail ?? "Keine E-Mail"}</span>
                  <span className="text-slate-400">{member.prospect.status}</span>
                </Link>
              ))}
              {list.members.length === 0 ? <p className="px-3 py-4 text-sm text-slate-500">Keine Leads zugewiesen.</p> : null}
              {list.members.length > 8 ? <p className="px-3 py-2 text-xs text-slate-400">{list.members.length - 8} weitere Leads</p> : null}
            </div>
          </article>
        ))}
        {lists.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Noch keine Leadlisten.</div> : null}
      </section>
    </div>
  );
}
