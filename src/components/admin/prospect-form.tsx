"use client";

import type { Prospect, ProspectEnrichmentRun } from "@prisma/client";
import type { FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import { prospectStatuses, type ProspectStatus } from "@/lib/prospect-status";
import { calculateSavings } from "@/lib/savings";
import { VideoAssetPicker } from "@/components/admin/video-asset-picker";

type ProspectFormProps = {
  prospect?: Prospect | null;
  latestEnrichmentRun?: ProspectEnrichmentRun | null;
};

type FormMessage = {
  type: "success" | "error";
  text: string;
} | null;

const statusOptions = prospectStatuses;

export function ProspectForm({ prospect, latestEnrichmentRun }: ProspectFormProps) {
  const [message, setMessage] = useState<FormMessage>(null);
  const [enrichmentRun, setEnrichmentRun] = useState(latestEnrichmentRun);
  const [isPending, startTransition] = useTransition();
  const [csvUploading, setCsvUploading] = useState(false);

  const defaults = useMemo(
    () => ({
      companyName: prospect?.companyName ?? "",
      landingpageTemplateId: prospect?.landingpageTemplateId ?? "",
      legalName: prospect?.legalName ?? "",
      websiteUrl: prospect?.websiteUrl ?? "",
      city: prospect?.city ?? "",
      postalCode: prospect?.postalCode ?? "",
      street: prospect?.street ?? "",
      phone: prospect?.phone ?? "",
      companyEmail: prospect?.companyEmail ?? "",
      state: prospect?.state ?? "",
      country: prospect?.country ?? "DE",
      companyStatus: prospect?.companyStatus ?? "unclear",
      employeeRange: prospect?.employeeRange ?? "",
      employeeCount: prospect?.employeeCount?.toString() ?? "",
      vehicleCount: prospect?.vehicleCount?.toString() ?? "",
      trailerCount: prospect?.trailerCount?.toString() ?? "",
      locationsCount: prospect?.locationsCount?.toString() ?? "",
      businessFields: prospect?.businessFields.join(", ") ?? "",
      isFamilyOwned: prospect?.isFamilyOwned ? "true" : "false",
      decisionMakerName: prospect?.decisionMakerName ?? "",
      decisionMakerRole: prospect?.decisionMakerRole ?? "",
      decisionMakerEmail: prospect?.decisionMakerEmail ?? "",
      firstName: prospect?.firstName ?? "",
      lastName: prospect?.lastName ?? "",
      linkedinUrl: prospect?.linkedinUrl ?? "",
      openDispatcherJob: prospect?.openDispatcherJob ? "true" : "false",
      jobUrl: prospect?.jobUrl ?? "",
      jobSignalText: prospect?.jobSignalText ?? "",
      fleetSignalText: prospect?.fleetSignalText ?? "",
      locationSignalText: prospect?.locationSignalText ?? "",
      contactStructureSignalText: prospect?.contactStructureSignalText ?? "",
      websiteMaturitySignal: prospect?.websiteMaturitySignal ?? "",
      videoUrl: prospect?.videoUrl ?? "",
      calendarUrl: prospect?.calendarUrl ?? "",
      bookingUrl: prospect?.bookingUrl ?? "",
      customPainPoint: prospect?.customPainPoint ?? "",
      customHeroHeadline: prospect?.customHeroHeadline ?? "",
      customHeroSubline: prospect?.customHeroSubline ?? "",
      customHeroBodyText: prospect?.customHeroBodyText ?? "",
      customHeroCtaText: prospect?.customHeroCtaText ?? "",
      customHeroCtaUrl: prospect?.customHeroCtaUrl ?? "",
      personalVideoUrl: prospect?.personalVideoUrl ?? "",
      personalVideoThumbnailUrl: prospect?.personalVideoThumbnailUrl ?? "",
      personalVideoScript: prospect?.personalVideoScript ?? "",
      personalVideoStatus: prospect?.personalVideoStatus ?? "none",
      personalVideoProvider: prospect?.personalVideoProvider ?? "",
      personalVideoJobId: prospect?.personalVideoJobId ?? "",
      personalVideoError: prospect?.personalVideoError ?? "",
      explainerVideoUrl: prospect?.explainerVideoUrl ?? "",
      individualCtaText: prospect?.individualCtaText ?? "",
      status: (prospect?.status as ProspectStatus | undefined) ?? "draft"
    }),
    [prospect]
  );
  const [personalVideoUrl, setPersonalVideoUrl] = useState(defaults.personalVideoUrl);
  const [personalVideoStatus, setPersonalVideoStatus] = useState(defaults.personalVideoStatus);

  async function submit(formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const endpoint = prospect ? `/api/prospects/${prospect.id}` : "/api/prospects";
    const method = prospect ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Speichern fehlgeschlagen");
    }

    window.location.href = "/admin/prospects";
  }

  async function runScoring() {
    if (!prospect) {
      setMessage({ type: "error", text: "Scoring ist erst nach dem ersten Speichern verfügbar." });
      return;
    }

    const response = await fetch(`/api/prospects/${prospect.id}/score`, { method: "POST" });
    if (!response.ok) {
      throw new Error("Scoring konnte nicht berechnet werden.");
    }

    window.location.reload();
  }

  async function generateLandingpage() {
    if (!prospect) {
      setMessage({ type: "error", text: "Landingpage ist erst nach dem ersten Speichern verfügbar." });
      return;
    }

    const response = await fetch(`/api/prospects/${prospect.id}/landingpage`, { method: "POST" });
    if (!response.ok) {
      throw new Error("Landingpage konnte nicht vorbereitet werden.");
    }

    window.location.reload();
  }

  async function runEnrichment() {
    if (!prospect) {
      setMessage({ type: "error", text: "Datenanreicherung ist erst nach dem ersten Speichern verfügbar." });
      return;
    }
    const response = await fetch(`/api/prospects/${prospect.id}/enrich`, { method: "POST" });
    const data = await response.json().catch(() => null) as { run?: ProspectEnrichmentRun; error?: string; message?: string } | null;
    if (!response.ok) {
      throw new Error(data?.error ?? "Anreicherung fehlgeschlagen.");
    }
    setEnrichmentRun(data?.run ?? null);
    setMessage({ type: "success", text: data?.message ?? "Datenanreicherung abgeschlossen. Vorschläge prüfen und übernehmen." });
  }

  async function applyEnrichmentSuggestion(key: string, value: unknown) {
    if (!prospect) return;
    const payload = { ...defaults, [key]: Array.isArray(value) ? value.join(", ") : value };
    const response = await fetch(`/api/prospects/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Vorschlag konnte nicht übernommen werden.");
    window.location.reload();
  }

  async function applyAllEnrichmentSuggestions() {
    if (!prospect) return;
    const suggestions = getSuggestions(enrichmentRun);
    const payload = { ...defaults };
    for (const [key, value] of Object.entries(suggestions)) {
      if (value !== undefined && value !== null && value !== "") {
        (payload as Record<string, unknown>)[key] = Array.isArray(value) ? value.join(", ") : value;
      }
    }
    const response = await fetch(`/api/prospects/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Vorschläge konnten nicht übernommen werden.");
    window.location.reload();
  }

  async function generateVideoScript() {
    if (!prospect) {
      setMessage({ type: "error", text: "Videos sind erst nach dem ersten Speichern verfügbar." });
      return;
    }
    const scriptResponse = await fetch("/api/ai/generate-video-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId: prospect.id, tone: "freundlich", maxSeconds: 60 })
    });
    const scriptData = await scriptResponse.json().catch(() => null) as { scriptText?: string; error?: string } | null;
    if (!scriptResponse.ok || !scriptData?.scriptText) throw new Error(scriptData?.error ?? "Video-Skript konnte nicht erzeugt werden.");
    const response = await fetch(`/api/prospects/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...defaults, personalVideoScript: scriptData.scriptText, personalVideoStatus: "script_ready" })
    });
    if (!response.ok) throw new Error("Video-Skript konnte nicht gespeichert werden.");
    window.location.reload();
  }

  async function generateMockVideo() {
    if (!prospect) {
      setMessage({ type: "error", text: "Videos sind erst nach dem ersten Speichern verfügbar." });
      return;
    }
    const response = await fetch("/api/videos/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId: prospect.id, tone: "freundlich" })
    });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(data?.error ?? "Mock-Video konnte nicht erstellt werden.");
    window.location.reload();
  }

  async function handleAction(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        setMessage(null);
        await action();
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Unbekannter Fehler"
        });
      }
    });
  }

  async function handleCsvImport(file: File | null) {
    if (!file) {
      return;
    }

    setCsvUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/prospects/import/csv", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "CSV-Import fehlgeschlagen");
      }

      window.location.href = "/admin/prospects";
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "CSV-Import fehlgeschlagen"
      });
    } finally {
      setCsvUploading(false);
    }
  }

  const calculatorPreview = calculateSavings({
    dispatchers: 2,
    manualHoursPerWeek: 30,
    hourlyRate: 55
  });

  return (
    <div className="space-y-6 rounded-3xl bg-white p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            {prospect ? "Prospect bearbeiten" : "Neuen Prospect anlegen"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Prospect-Daten, Scoring und Landingpage-Vorbereitung.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleAction(runScoring)}
            className="btn-secondary rounded-full px-4 py-2 text-sm font-medium"
            disabled={isPending}
          >
            Scoring berechnen
          </button>
          <button
            type="button"
            onClick={() => handleAction(generateLandingpage)}
            className="btn-primary rounded-full px-4 py-2 text-sm font-medium"
            disabled={isPending}
          >
            Landingpage generieren
          </button>
          <button
            type="button"
            onClick={() => handleAction(runEnrichment)}
            className="btn-secondary rounded-full px-4 py-2 text-sm font-medium"
            disabled={isPending}
          >
            Daten automatisch anreichern
          </button>
          <a
            href="/api/prospects/export"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate"
          >
            CSV exportieren
          </a>
          <a
            href="/admin/campaigns"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate"
          >
            Kampagnen
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <label className="block text-sm font-medium text-slate">
          CSV importieren
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void handleCsvImport(event.target.files?.[0] ?? null)}
            className="max-w-sm"
            disabled={csvUploading}
          />
          <span className="text-xs text-slate-500">
            Felder müssen den Prospect-Spalten entsprechen.
          </span>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {prospect ? (
        <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Datenanreicherung</h3>
              <p className="mt-1 text-xs text-slate-500">
                Letzter Lauf: {enrichmentRun ? `${enrichmentRun.status}, ${enrichmentRun.pagesScanned} Seiten, Confidence ${enrichmentRun.confidence}` : "noch kein Lauf"}
              </p>
            </div>
            <button type="button" onClick={() => handleAction(applyAllEnrichmentSuggestions)} className="btn-primary rounded-xl px-3 py-2 text-xs font-medium">
              alle sicheren Vorschläge übernehmen
            </button>
          </div>
          <EnrichmentSuggestions
            run={enrichmentRun}
            prospect={prospect}
            onApply={(key, value) => handleAction(() => applyEnrichmentSuggestion(key, value))}
          />
        </div>
      ) : null}

      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);

          startTransition(async () => {
            try {
              await submit(formData);
            } catch (error) {
              setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Speichern fehlgeschlagen"
              });
            }
          });
        }}
        className="grid gap-4 md:grid-cols-2"
      >
        <Field label="Firmenname" name="companyName" defaultValue={defaults.companyName} required />
        <Field label="Rechtlicher Name" name="legalName" defaultValue={defaults.legalName} />
        <Field label="Website" name="websiteUrl" defaultValue={defaults.websiteUrl} type="url" />
        <Field label="Stadt" name="city" defaultValue={defaults.city} required />
        <Field label="PLZ" name="postalCode" defaultValue={defaults.postalCode} />
        <Field label="Straße" name="street" defaultValue={defaults.street} />
        <Field label="Telefon" name="phone" defaultValue={defaults.phone} />
        <Field label="Firmen-E-Mail" name="companyEmail" defaultValue={defaults.companyEmail} type="email" />
        <Field label="Bundesland" name="state" defaultValue={defaults.state} />
        <Field label="Land" name="country" defaultValue={defaults.country} />
        <SelectField
          label="Firmenstatus"
          name="companyStatus"
          defaultValue={defaults.companyStatus}
          options={[
            { value: "active", label: "active" },
            { value: "unclear", label: "unclear" },
            { value: "inactive", label: "inactive" },
            { value: "unreachable", label: "unreachable" }
          ]}
        />
        <Field label="Mitarbeiter-Range" name="employeeRange" defaultValue={defaults.employeeRange} />
        <Field label="Mitarbeiterzahl" name="employeeCount" defaultValue={defaults.employeeCount} type="number" />
        <Field label="Fahrzeuge" name="vehicleCount" defaultValue={defaults.vehicleCount} type="number" />
        <Field label="Trailer" name="trailerCount" defaultValue={defaults.trailerCount} type="number" />
        <Field label="Standorte" name="locationsCount" defaultValue={defaults.locationsCount} type="number" />
        <Field label="Business Fields" name="businessFields" defaultValue={defaults.businessFields} />
        <SelectField
          label="Familiengeführt"
          name="isFamilyOwned"
          defaultValue={defaults.isFamilyOwned}
          options={[
            { value: "false", label: "Nein / unbekannt" },
            { value: "true", label: "Ja" }
          ]}
        />
        <Field label="Entscheider Name" name="decisionMakerName" defaultValue={defaults.decisionMakerName} />
        <Field label="Entscheider Rolle" name="decisionMakerRole" defaultValue={defaults.decisionMakerRole} />
        <Field label="Entscheider E-Mail" name="decisionMakerEmail" defaultValue={defaults.decisionMakerEmail} type="email" />
        <Field label="Vorname" name="firstName" defaultValue={defaults.firstName} />
        <Field label="Nachname" name="lastName" defaultValue={defaults.lastName} />
        <Field label="LinkedIn URL" name="linkedinUrl" defaultValue={defaults.linkedinUrl} type="url" />
        <SelectField
          label="Offene Dispatcher-Stelle"
          name="openDispatcherJob"
          defaultValue={defaults.openDispatcherJob}
          options={[
            { value: "false", label: "Nein" },
            { value: "true", label: "Ja" }
          ]}
        />
        <Field label="Job URL" name="jobUrl" defaultValue={defaults.jobUrl} type="url" />
        <TextareaField label="Job Signal" name="jobSignalText" defaultValue={defaults.jobSignalText} />
        <TextareaField label="Fleet Signal" name="fleetSignalText" defaultValue={defaults.fleetSignalText} />
        <TextareaField label="Location Signal" name="locationSignalText" defaultValue={defaults.locationSignalText} />
        <TextareaField
          label="Contact Structure Signal"
          name="contactStructureSignalText"
          defaultValue={defaults.contactStructureSignalText}
        />
        <TextareaField
          label="Website Maturity Signal"
          name="websiteMaturitySignal"
          defaultValue={defaults.websiteMaturitySignal}
        />
        <div className="md:col-span-2 rounded-2xl border border-slate-300 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-ink">Landingpage Personalisierung</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Kalenderlink" name="calendarUrl" defaultValue={defaults.calendarUrl} type="url" />
            <Field label="Externe Buchungsseite URL" name="bookingUrl" defaultValue={defaults.bookingUrl} type="url" />
            <Field label="Erklärvideo URL Override" name="explainerVideoUrl" defaultValue={defaults.explainerVideoUrl} type="url" />
            <Field label="Video URL Legacy" name="videoUrl" defaultValue={defaults.videoUrl} type="url" />
            <Field label="Individueller CTA Text" name="individualCtaText" defaultValue={defaults.individualCtaText} />
            <Field label="Custom CTA Text" name="customHeroCtaText" defaultValue={defaults.customHeroCtaText} />
            <Field label="Custom CTA Link" name="customHeroCtaUrl" defaultValue={defaults.customHeroCtaUrl} type="url" />
            <TextareaField label="Pain Point" name="customPainPoint" defaultValue={defaults.customPainPoint} />
            <TextareaField label="Custom Hero Headline" name="customHeroHeadline" defaultValue={defaults.customHeroHeadline} />
            <TextareaField label="Custom Hero Subline" name="customHeroSubline" defaultValue={defaults.customHeroSubline} />
            <TextareaField label="Custom Hero Text" name="customHeroBodyText" defaultValue={defaults.customHeroBodyText} />
          </div>
        </div>
        <div className="md:col-span-2 rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Persönliches Video</h3>
              <p className="mt-1 text-xs text-slate-500">Status: {defaults.personalVideoStatus} · Provider: {defaults.personalVideoProvider || "mock"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleAction(generateVideoScript)} className="rounded-full border border-fuchsia-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Video-Skript mit KI erstellen</button>
              <button type="button" onClick={() => handleAction(generateMockVideo)} className="rounded-full bg-fuchsia-600 px-3 py-2 text-xs font-semibold text-white">Mock-Video erstellen</button>
              {personalVideoUrl ? <a href={personalVideoUrl} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Video öffnen</a> : null}
              {personalVideoUrl ? <button type="button" onClick={() => { setPersonalVideoUrl(""); setPersonalVideoStatus("none"); }} className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600">Video entfernen</button> : null}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <VideoAssetPicker label="Personalisiertes Video hochladen oder auswählen" onSelect={(asset) => { setPersonalVideoUrl(asset.url); setPersonalVideoStatus("ready"); }} onRemove={() => { setPersonalVideoUrl(""); setPersonalVideoStatus("none"); }} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate">Video URL</span>
              <input name="personalVideoUrl" type="url" value={personalVideoUrl} onChange={(event) => setPersonalVideoUrl(event.target.value)} />
            </label>
            <Field label="Thumbnail URL" name="personalVideoThumbnailUrl" defaultValue={defaults.personalVideoThumbnailUrl} type="url" />
            <input type="hidden" name="personalVideoStatus" value={personalVideoStatus} />
            <input type="hidden" name="personalVideoProvider" value={defaults.personalVideoProvider} />
            <input type="hidden" name="personalVideoJobId" value={defaults.personalVideoJobId} />
            <input type="hidden" name="personalVideoError" value={defaults.personalVideoError} />
            <TextareaField label="Script Preview" name="personalVideoScript" defaultValue={defaults.personalVideoScript} />
            {defaults.personalVideoError ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{defaults.personalVideoError}</p> : null}
            {personalVideoUrl ? (
              <a href={personalVideoUrl} className="md:col-span-2 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-950 text-white">▶</span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Persönliches Video ist bereit</span>
                  <span className="block break-all text-xs text-slate-500">{personalVideoUrl}</span>
                </span>
              </a>
            ) : null}
          </div>
        </div>
        <SelectField
          label="Status"
          name="status"
          defaultValue={defaults.status}
          options={statusOptions.map((status) => ({ value: status, label: status }))}
        />

        <div className="md:col-span-2 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
          <div>
            <p className="text-sm font-medium text-slate">Rechner-Standardwerte</p>
            <p className="text-xs text-slate-500">
              2 Disponenten, 30 h/Woche, 55 EUR/h ergeben {calculatorPreview.yearlySavings.toLocaleString("de-DE")} EUR Potenzial.
            </p>
          </div>
          <button
            type="submit"
            className="btn-primary rounded-full px-5 py-3 text-sm font-medium"
            disabled={isPending}
          >
            {prospect ? "Änderungen speichern" : "Prospect anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text"
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} required={required} />
    </label>
  );
}

function TextareaField({
  label,
  name,
  defaultValue
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-2 md:col-span-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <textarea name={name} defaultValue={defaultValue} rows={3} />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <select name={name} defaultValue={defaultValue}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EnrichmentSuggestions({
  run,
  prospect,
  onApply
}: {
  run?: ProspectEnrichmentRun | null;
  prospect: Prospect;
  onApply: (key: string, value: unknown) => void;
}) {
  const suggestions = getSuggestions(run);
  const sources = getSources(run);
  const entries = Object.entries(suggestions).filter(([, value]) => value !== null && value !== undefined && value !== "");

  if (!run) {
    return <p className="mt-3 text-sm text-slate-500">Noch keine Vorschläge vorhanden.</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      {run.rawSummary ? <p className="text-sm text-amber-700">{run.rawSummary}</p> : null}
      <div className="space-y-2">
        {entries.length === 0 ? <p className="text-sm text-slate-500">Keine sicheren Vorschläge für leere Felder.</p> : null}
        {entries.map(([key, value]) => (
          <div key={key} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{key}</p>
              <p className="mt-1 text-sm text-slate-600">Aktuell: {formatValue(prospect[key as keyof Prospect]) || "leer"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Vorschlag</p>
              <p className="mt-1 text-sm font-medium text-ink">{formatValue(value)}</p>
            </div>
            <button type="button" onClick={() => onApply(key, value)} className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold">
              übernehmen
            </button>
          </div>
        ))}
      </div>
      {sources.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-ink">Quellen</p>
          <div className="mt-2 space-y-2">
            {sources.map((source, index) => (
              <div key={`${source.url}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <p className="font-medium text-ink">{source.url}</p>
                <p className="mt-1">{source.reason}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getSuggestions(run?: ProspectEnrichmentRun | null): Record<string, unknown> {
  return run?.suggestionsJson && typeof run.suggestionsJson === "object" && !Array.isArray(run.suggestionsJson)
    ? run.suggestionsJson as Record<string, unknown>
    : {};
}

function getSources(run?: ProspectEnrichmentRun | null): Array<{ url: string; reason: string }> {
  return Array.isArray(run?.sourcesJson) ? run.sourcesJson as Array<{ url: string; reason: string }> : [];
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (value === null || value === undefined) return "";
  return String(value);
}
