"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";

type ProspectOption = {
  id: string;
  companyName: string;
  city: string;
  slug: string | null;
  landingpageUrl: string | null;
};

type CampaignOption = {
  id: string;
  name: string;
  prospectIds: string[];
};

type TemplateOption = {
  id: string;
  name: string;
};

type FlowResult = {
  requested: number;
  completed: number;
  failed: number;
};

export function ImpactLandingpageFlow({
  campaigns,
  prospects,
  templates,
  videoTemplates
}: {
  campaigns: CampaignOption[];
  prospects: ProspectOption[];
  templates: TemplateOption[];
  videoTemplates: TemplateOption[];
}) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [videoTemplateId, setVideoTemplateId] = useState(videoTemplates[0]?.id ?? "");
  const [generateLandingpage, setGenerateLandingpage] = useState(true);
  const [generateVideo, setGenerateVideo] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<FlowResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleProspects = useMemo(() => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      return prospects;
    }
    const campaignProspects = new Set(campaign.prospectIds);
    return prospects.filter((prospect) => campaignProspects.has(prospect.id));
  }, [campaignId, campaigns, prospects]);

  function toggleProspect(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectVisible() {
    setSelected(visibleProspects.map((prospect) => prospect.id));
  }

  function startFlow() {
    if (!campaignId) {
      setMessage("Bitte zuerst eine Kampagne auswählen.");
      return;
    }

    startTransition(async () => {
      setMessage(null);
      setResult(null);
      const response = await fetch(`/api/campaigns/${campaignId}/run-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedProspectIds: selected,
          generateLandingpage,
          generateVideo,
          sendEmail,
          emailTemplateId: templateId || undefined,
          videoTemplateId: videoTemplateId || undefined
        })
      });
      const data = await response.json().catch(() => null) as (FlowResult & { error?: string }) | null;

      if (!response.ok) {
        setMessage(data?.error ?? "Flow konnte nicht gestartet werden.");
        return;
      }

      setResult(data);
      setMessage("Flow abgeschlossen.");
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personalisierte Landingpages erstellen"
        description="Starte Landingpage, optionales Video, KI-E-Mail und Tracking fuer ausgewaehlte Prospects."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Workflow</h2>
          <div className="mt-5 space-y-4">
            <Select label="Kampagne auswählen" value={campaignId} onChange={setCampaignId} options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} emptyLabel="Keine Kampagne vorhanden" />
            <Select label="Template auswählen" value={templateId} onChange={setTemplateId} options={templates.map((template) => ({ value: template.id, label: template.name }))} emptyLabel="Kein Template vorhanden" />
            <Select label="Video Template" value={videoTemplateId} onChange={setVideoTemplateId} options={videoTemplates.map((template) => ({ value: template.id, label: template.name }))} emptyLabel="Mock Standard" />

            <Toggle label="Landingpage erstellen" checked={generateLandingpage} onChange={setGenerateLandingpage} />
            <Toggle label="Video erstellen" checked={generateVideo} onChange={setGenerateVideo} />
            <Toggle label="E-Mail senden" checked={sendEmail} onChange={setSendEmail} />

            <button
              type="button"
              onClick={startFlow}
              disabled={isPending || selected.length === 0 || !campaignId}
              className="btn-primary w-full rounded-full px-4 py-3 text-sm font-semibold"
            >
              {isPending ? "Flow läuft..." : `Flow starten (${selected.length})`}
            </button>

            {message ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}
            {result ? (
              <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
                {result.completed} abgeschlossen, {result.failed} mit Fehlern, {result.requested} angefragt.
              </div>
            ) : null}
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">Prospects auswählen</h2>
            <div className="flex items-center gap-2">
              <StatusBadge>{visibleProspects.length} sichtbar</StatusBadge>
              <button type="button" onClick={selectVisible} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
                alle wählen
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visibleProspects.map((prospect) => (
              <button
                key={prospect.id}
                type="button"
                onClick={() => toggleProspect(prospect.id)}
                className={`rounded-2xl border p-4 text-left ${selected.includes(prospect.id) ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white"}`}
              >
                <span className="flex items-start gap-3">
                  <span className={`mt-1 h-4 w-4 rounded border ${selected.includes(prospect.id) ? "border-cyan-500 bg-cyan-500" : "border-slate-300"}`} />
                  <span>
                    <span className="block font-semibold text-ink">{prospect.companyName}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {prospect.city} · {prospect.landingpageUrl ?? (prospect.slug ? `/p/${prospect.slug}` : "Landingpage noch nicht vorbereitet")}
                    </span>
                  </span>
                </span>
              </button>
            ))}
            {visibleProspects.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Keine Prospects in dieser Kampagne.</p> : null}
          </div>
        </AdminCard>
      </div>

      <AdminCard>
        <h2 className="text-lg font-semibold text-ink">Schnellzugriff</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/landingpages/templates" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Zu Landingpage Vorlagen
          </Link>
          <Link href="/admin/impact" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Zurück zum Impact Studio
          </Link>
          <Link href="/admin/landingpages" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
            Landingpages öffnen
          </Link>
        </div>
      </AdminCard>
    </div>
  );
}

function Select({
  emptyLabel,
  label,
  onChange,
  options,
  value
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  emptyLabel: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.length === 0 ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 rounded border-slate-300" />
    </label>
  );
}
