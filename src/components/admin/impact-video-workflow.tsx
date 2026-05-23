"use client";

import type { Campaign, CampaignEnrollment, Prospect, VideoGenerationJob, VideoTemplate } from "@prisma/client";
import { useMemo, useState, useTransition } from "react";

const maxVideoBatchProspects = 20;

type CampaignWithProspects = Campaign & { enrollments: Array<CampaignEnrollment & { prospect: Prospect }> };
type JobWithRelations = VideoGenerationJob & {
  prospect?: { companyName: string } | null;
  campaign?: { name: string } | null;
  videoTemplate?: { name: string } | null;
};

export function ImpactVideoWorkflow({
  campaigns,
  jobs,
  prospects,
  templates
}: {
  campaigns: CampaignWithProspects[];
  jobs: JobWithRelations[];
  prospects: Prospect[];
  templates: VideoTemplate[];
}) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [tone, setTone] = useState("freundlich");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleProspects = useMemo(() => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    return campaign ? campaign.enrollments.map((item) => item.prospect) : prospects;
  }, [campaignId, campaigns, prospects]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, maxVideoBatchProspects));
  }

  function createJobs() {
    startTransition(async () => {
      setMessage(null);
      const ids = selected.slice(0, maxVideoBatchProspects);
      for (const prospectId of ids) {
        const response = await fetch("/api/videos/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospectId, campaignId: campaignId || undefined, videoTemplateId: templateId || undefined, tone })
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null) as { error?: string } | null;
          setMessage(data?.error ?? "Mindestens ein Video-Job konnte nicht erstellt werden.");
          return;
        }
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Outreach &gt; Impact Studio &gt; <span className="text-ink">Personalisierte Videos</span></p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Personalisierte Videos vorbereiten</h1>
        <p className="mt-2 text-sm text-slate-500">V1 nutzt den Mock-Provider. HeyGen, Tavus und Synthesia sind als Provider vorbereitet, aber noch nicht verbunden.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl bg-white p-6 shadow-panel">
          <h2 className="text-lg font-semibold text-ink">Workflow</h2>
          <div className="mt-5 space-y-4">
            <Select label="Kampagne" value={campaignId} onChange={setCampaignId} options={[{ value: "", label: "Alle Prospects" }, ...campaigns.map((item) => ({ value: item.id, label: item.name }))]} />
            <Select label="Video Template" value={templateId} onChange={setTemplateId} options={[{ value: "", label: "Mock Standard" }, ...templates.map((item) => ({ value: item.id, label: `${item.name} (${item.provider})` }))]} />
            <Select label="Tonalität" value={tone} onChange={setTone} options={["freundlich", "direkt", "beratend", "kurz"].map((item) => ({ value: item, label: item }))} />
            <button type="button" onClick={createJobs} disabled={isPending || selected.length === 0} className="btn-primary w-full rounded-full px-4 py-3 text-sm font-semibold">
              Video-Jobs erstellen ({selected.length}/{maxVideoBatchProspects})
            </button>
            {message ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">Prospects auswählen</h2>
            <button type="button" onClick={() => setSelected(visibleProspects.slice(0, maxVideoBatchProspects).map((item) => item.id))} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">erste 20 wählen</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visibleProspects.map((prospect) => (
              <button key={prospect.id} type="button" onClick={() => toggle(prospect.id)} className={`rounded-2xl border p-4 text-left ${selected.includes(prospect.id) ? "border-fuchsia-400 bg-fuchsia-50" : "border-slate-200 bg-white"}`}>
                <p className="font-semibold text-ink">{prospect.companyName}</p>
                <p className="mt-1 text-xs text-slate-500">{prospect.city} · Video: {prospect.personalVideoStatus}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-lg font-semibold text-ink">Video Job-Historie</h2>
        <div className="mt-4 space-y-3 md:hidden">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="min-w-0 flex-1 truncate font-semibold text-ink">{job.prospect?.companyName ?? job.prospectId}</h3>
                <Status status={job.status} />
              </div>
              <div className="mt-3 grid gap-1 text-sm text-slate-500">
                <span>Template: {job.videoTemplate?.name ?? "Mock Standard"}</span>
                <span>Kampagne: {job.campaign?.name ?? "-"}</span>
                <span>Provider: {job.provider}</span>
              </div>
              {job.videoUrl ? <a className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-cyan-700" href={job.videoUrl}>öffnen</a> : null}
            </article>
          ))}
          {jobs.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Noch keine Video-Jobs.</p> : null}
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-2">Prospect</th><th>Template</th><th>Kampagne</th><th>Status</th><th>Provider</th><th>Video</th></tr></thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-100">
                  <td className="py-3 font-medium text-ink">{job.prospect?.companyName ?? job.prospectId}</td>
                  <td>{job.videoTemplate?.name ?? "Mock Standard"}</td>
                  <td>{job.campaign?.name ?? "-"}</td>
                  <td><Status status={job.status} /></td>
                  <td>{job.provider}</td>
                  <td>{job.videoUrl ? <a className="font-semibold text-cyan-700" href={job.videoUrl}>öffnen</a> : "-"}</td>
                </tr>
              ))}
              {jobs.length === 0 ? <tr><td className="py-6 text-slate-500" colSpan={6}>Noch keine Video-Jobs.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Select({ label, onChange, options, value }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    </label>
  );
}

function Status({ status }: { status: string }) {
  const color = status === "ready" ? "bg-emerald-100 text-emerald-700" : status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{status}</span>;
}
