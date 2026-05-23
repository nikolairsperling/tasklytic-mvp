"use client";

import React, { useEffect, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader } from "@/components/admin/ui";

type Offer = {
  id: string;
  name: string;
  targetGroupId: string | null;
  businessName: string;
  serviceDescription: string;
  targetAudienceDescription: string;
  coreProblems: unknown;
  solutions: unknown;
  valueProposition: string;
  toneOfVoice: string;
  isDefault: boolean;
};

type TargetGroup = { id: string; name: string };

type OfferForm = {
  name: string;
  targetGroupId: string;
  businessName: string;
  serviceDescription: string;
  targetAudienceDescription: string;
  coreProblems: string;
  solutions: string;
  valueProposition: string;
  toneOfVoice: string;
  isDefault: boolean;
};

const emptyForm: OfferForm = {
  name: "",
  targetGroupId: "",
  businessName: "",
  serviceDescription: "",
  targetAudienceDescription: "",
  coreProblems: "",
  solutions: "",
  valueProposition: "",
  toneOfVoice: "klar, direkt, professionell",
  isDefault: false
};

export default function OffersSetupPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void load();
  }, []);

  async function load(preferredSelectedId = selectedId) {
    const [offersResponse, groupsResponse] = await Promise.all([
      fetch("/api/offers", { cache: "no-store" }),
      fetch("/api/target-groups", { cache: "no-store" })
    ]);
    const nextOffers = await offersResponse.json().catch(() => []);
    const nextGroups = await groupsResponse.json().catch(() => []);
    const normalizedOffers = Array.isArray(nextOffers) ? nextOffers : [];
    setOffers(normalizedOffers);
    setTargetGroups(Array.isArray(nextGroups) ? nextGroups : []);
    const preferredOffer = preferredSelectedId ? normalizedOffers.find((offer) => offer.id === preferredSelectedId) : null;
    if (preferredOffer) {
      selectOffer(preferredOffer);
    } else if (!preferredSelectedId && normalizedOffers[0]) {
      selectOffer(normalizedOffers[0]);
    }
  }

  function selectOffer(offer: Offer) {
    setSelectedId(offer.id);
    setForm({
      name: offer.name,
      targetGroupId: offer.targetGroupId ?? "",
      businessName: offer.businessName ?? "",
      serviceDescription: offer.serviceDescription ?? "",
      targetAudienceDescription: offer.targetAudienceDescription ?? "",
      coreProblems: listValue(offer.coreProblems),
      solutions: listValue(offer.solutions),
      valueProposition: offer.valueProposition ?? "",
      toneOfVoice: offer.toneOfVoice ?? "klar, direkt, professionell",
      isDefault: offer.isDefault
    });
  }

  function update<K extends keyof OfferForm>(key: K, value: OfferForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const response = await fetch(selectedId ? `/api/offers/${selectedId}` : "/api/offers", {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(body?.error ?? "Angebot konnte nicht gespeichert werden.");
        return;
      }
      setMessage("Angebot gespeichert.");
      setSelectedId(body.id);
      await load(body.id);
    });
  }

  function duplicateOffer(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/offers/${id}/duplicate`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(body?.error ?? "Angebot konnte nicht dupliziert werden.");
        return;
      }
      setMessage("Angebot dupliziert.");
      setSelectedId(body.id);
      await load(body.id);
    });
  }

  function setDefaultOffer(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/offers/${id}/set-default`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(body?.error ?? "Standard-Angebot konnte nicht gesetzt werden.");
        return;
      }
      setMessage("Standard-Angebot gesetzt.");
      await load(id);
    });
  }

  function deleteSelected() {
    if (!selectedId) return;
    startTransition(async () => {
      await fetch(`/api/offers/${selectedId}`, { method: "DELETE" });
      setSelectedId(null);
      setForm(emptyForm);
      await load(null);
    });
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <PageHeader title="Angebote" description="Mehrere Angebote für Zielgruppen, Kampagnen und Lead-Empfehlungen verwalten." backButton={<AdminBackButton href="/admin/setup" />} />
      {message ? <p className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      <div className="grid w-full min-w-0 max-w-full gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <AdminCard>
          <button type="button" onClick={() => { setSelectedId(null); setForm(emptyForm); setMessage(null); }} className="btn-primary mb-4 w-full rounded-xl px-4 py-2 text-sm font-semibold">
            Neues Angebot
          </button>
          <div className="space-y-2">
            {offers.map((offer) => (
              <button key={offer.id} type="button" onClick={() => selectOffer(offer)} className={`w-full min-w-0 max-w-full rounded-xl border px-3 py-3 text-left text-sm ${selectedId === offer.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
                <span className="block break-words font-semibold text-ink">{offer.name}</span>
                <span className="mt-1 block break-words text-xs text-slate-500">{offer.isDefault ? "Default" : targetGroups.find((group) => group.id === offer.targetGroupId)?.name ?? "Keine Zielgruppe"}</span>
              </button>
            ))}
          </div>
        </AdminCard>
        <AdminCard>
          <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <Field label="Angebotsname" value={form.name} onChange={(value) => update("name", value)} required />
            <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
              Zielgruppe
              <select value={form.targetGroupId} onChange={(event) => update("targetGroupId", event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3">
                <option value="">Keine feste Zielgruppe</option>
                {targetGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <Field label="Business Name" value={form.businessName} onChange={(value) => update("businessName", value)} />
            <Textarea label="Dienstleistung" value={form.serviceDescription} onChange={(value) => update("serviceDescription", value)} required />
            <Textarea label="Zielgruppe Beschreibung" value={form.targetAudienceDescription} onChange={(value) => update("targetAudienceDescription", value)} required />
            <Textarea label="Probleme" value={form.coreProblems} onChange={(value) => update("coreProblems", value)} required />
            <Textarea label="Lösungen" value={form.solutions} onChange={(value) => update("solutions", value)} required />
            <Textarea label="Nutzenversprechen" value={form.valueProposition} onChange={(value) => update("valueProposition", value)} required />
            <Field label="Tonalität" value={form.toneOfVoice} onChange={(value) => update("toneOfVoice", value)} />
            <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => update("isDefault", event.target.checked)} className="h-5 w-5 shrink-0" />
              <span className="min-w-0 break-words">Default-Angebot setzen</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={isPending} className="btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold sm:w-auto">Speichern</button>
              {selectedId ? <button type="button" onClick={() => duplicateOffer(selectedId)} className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-semibold sm:w-auto">Duplizieren</button> : null}
              {selectedId ? <button type="button" onClick={() => setDefaultOffer(selectedId)} className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-semibold sm:w-auto">Als Standard setzen</button> : null}
              {selectedId ? <button type="button" onClick={deleteSelected} className="w-full rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 sm:w-auto">Löschen</button> : null}
            </div>
          </form>
        </AdminCard>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
      {label}
      <input value={value} required={required} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3" />
    </label>
  );
}

function Textarea({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
      {label}
      <textarea value={value} required={required} onChange={(event) => onChange(event.target.value)} rows={4} className="rounded-xl border border-slate-200 px-3 py-2" />
    </label>
  );
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (typeof value === "string") return value;
  return "";
}
