"use client";

import React, { useEffect, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader } from "@/components/admin/ui";

type OfferForm = {
  businessName: string;
  serviceDescription: string;
  targetAudienceDescription: string;
  coreProblems: string;
  solutions: string;
  valueProposition: string;
  toneOfVoice: string;
};

type OfferApiResponse = Partial<Omit<OfferForm, "coreProblems" | "solutions">> & {
  id?: string;
  name?: string;
  isDefault?: boolean;
  coreProblems?: unknown;
  solutions?: unknown;
  error?: string;
};

const emptyOfferForm: OfferForm = {
  businessName: "",
  serviceDescription: "",
  targetAudienceDescription: "",
  coreProblems: "",
  solutions: "",
  valueProposition: "",
  toneOfVoice: "klar, direkt, professionell"
};

export function OfferSettingsPanel() {
  const [form, setForm] = useState<OfferForm>(emptyOfferForm);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadOffer(showError = true) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/offers", { method: "GET", cache: "no-store" });
      const data = (await response.json().catch(() => [])) as OfferApiResponse[] | { error?: string };

      if (!response.ok) {
        if (showError) {
          setMessage({ type: "error", text: "error" in data ? data.error ?? "Angebot konnte nicht geladen werden." : "Angebot konnte nicht geladen werden." });
        }
        return;
      }

      const offers = Array.isArray(data) ? data : [];
      const offer = offers.find((item) => item.isDefault) ?? offers[0] ?? null;
      setSelectedOfferId(offer?.id ?? null);
      setForm(normalizeOffer(offer));
    } catch (error) {
      if (showError) {
        setMessage({ type: "error", text: getClientErrorMessage(error, "Angebot konnte nicht geladen werden.") });
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOffer();
  }, []);

  function update<K extends keyof OfferForm>(key: K, value: OfferForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(selectedOfferId ? `/api/offers/${selectedOfferId}` : "/api/offers", {
          method: selectedOfferId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, isDefault: true })
        });
        const data = (await response.json().catch(() => null)) as OfferApiResponse | null;

        if (!response.ok) {
          setMessage({ type: "error", text: data?.error ?? "Angebot konnte nicht gespeichert werden." });
          return;
        }

        setMessage({ type: "success", text: "Angebot gespeichert" });
        await loadOffer(false);
      } catch (error) {
        setMessage({ type: "error", text: getClientErrorMessage(error, "Angebot konnte nicht gespeichert werden.") });
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Angebot definieren"
        description="Dieses Profil steuert Research, ICP-Bewertung, Pain Detection, E-Mails, Landingpages und Videos."
        backButton={<AdminBackButton href="/admin/setup" />}
      />
      {message ? (
        <p className={`mb-4 rounded-2xl px-4 py-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      <AdminCard>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field label="Name deines Unternehmens" name="businessName" value={form.businessName} onChange={(value) => update("businessName", value)} />
          <Textarea label="Was bietest du an?" name="serviceDescription" value={form.serviceDescription} onChange={(value) => update("serviceDescription", value)} required />
          <Textarea label="Für wen ist dein Angebot?" name="targetAudienceDescription" value={form.targetAudienceDescription} onChange={(value) => update("targetAudienceDescription", value)} required />
          <Textarea label="Welche Probleme löst du?" name="coreProblems" value={form.coreProblems} onChange={(value) => update("coreProblems", value)} required />
          <Textarea label="Wie löst du diese Probleme?" name="solutions" value={form.solutions} onChange={(value) => update("solutions", value)} required />
          <Textarea label="Was unterscheidet dich?" name="valueProposition" value={form.valueProposition} onChange={(value) => update("valueProposition", value)} required />
          <Field label="Tonality" name="toneOfVoice" value={form.toneOfVoice} onChange={(value) => update("toneOfVoice", value)} />
          <div>
            <button type="submit" disabled={isPending || isLoading} className="btn-primary min-h-11 rounded-xl px-5 py-2 text-sm font-semibold">
              {isPending ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </form>
      </AdminCard>
    </div>
  );
}

function Field({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink outline-none focus:border-blue-500"
      />
    </label>
  );
}

function Textarea({ label, name, value, onChange, required }: { label: string; name: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        rows={4}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-blue-500"
      />
    </label>
  );
}

function normalizeOffer(data: OfferApiResponse | null): OfferForm {
  return {
    businessName: data?.businessName ?? "",
    serviceDescription: data?.serviceDescription ?? "",
    targetAudienceDescription: data?.targetAudienceDescription ?? "",
    coreProblems: offerFormValue(data?.coreProblems),
    solutions: offerFormValue(data?.solutions),
    valueProposition: data?.valueProposition ?? "",
    toneOfVoice: data?.toneOfVoice ?? "klar, direkt, professionell"
  };
}

function offerFormValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (typeof value === "string") return value;
  return "";
}

function getClientErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
