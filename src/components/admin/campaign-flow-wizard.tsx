"use client";

import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type CampaignFlowLead = {
  id: string;
  name: string;
  companyName: string;
  email: string | null;
  landingpageUrl: string | null;
  slug: string | null;
  landingpageReviewStatus?: string | null;
};

export type CampaignFlowTargetGroup = {
  id: string;
  name: string;
};

export type CampaignFlowOffer = {
  id: string;
  name: string;
  targetGroupId: string | null;
  isDefault?: boolean;
};

export type CampaignFlowTemplate = {
  id: string;
  name: string;
  subject: string;
  bodyText: string;
};

export type CampaignFlowLeadList = {
  id: string;
  name: string;
  count?: number;
};

type CampaignFlowWizardProps = {
  open: boolean;
  leads: CampaignFlowLead[];
  targetGroups: CampaignFlowTargetGroup[];
  offers: CampaignFlowOffer[];
  templates: CampaignFlowTemplate[];
  leadLists?: CampaignFlowLeadList[];
  onClose: () => void;
  onSuccess?: (result: { campaignId: string; added: number; skipped: number; failed: number }) => void;
};

const steps = ["Leads prüfen", "Zielgruppe", "Angebot", "Vorlage", "Vorschau", "Erstellen"];

export function CampaignFlowWizard({ open, leads, targetGroups, offers, templates, leadLists = [], onClose, onSuccess }: CampaignFlowWizardProps) {
  const [step, setStep] = useState(0);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [templateId, setTemplateId] = useState("simple");
  const [previewLeadId, setPreviewLeadId] = useState(leads[0]?.id ?? "");
  const [leadSource, setLeadSource] = useState<"selected" | "list">("selected");
  const [leadListId, setLeadListId] = useState("");
  const [name, setName] = useState(() => `Kampagne ${new Date().toLocaleDateString("de-DE")}`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ campaignId: string; added: number; skipped: number; failed: number } | null>(null);

  const invalidLeads = useMemo(() => leads.filter((lead) => !isValidCampaignLead(lead)), [leads]);
  const missingEmail = useMemo(() => leads.filter((lead) => !lead.email), [leads]);
  const missingLandingpage = useMemo(() => leads.filter((lead) => !hasLandingpage(lead)), [leads]);
  const filteredOffers = useMemo(() => {
    if (!targetGroupId) return offers;
    const matching = offers.filter((offer) => offer.targetGroupId === targetGroupId);
    const unassigned = offers.filter((offer) => !offer.targetGroupId);
    return [...matching, ...unassigned, ...offers.filter((offer) => offer.targetGroupId && offer.targetGroupId !== targetGroupId)];
  }, [offers, targetGroupId]);
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? null;
  const previewLead = leads.find((lead) => lead.id === previewLeadId) ?? leads[0] ?? null;
  const preview = buildPreview(previewLead, selectedTemplate);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setStep(0);
      setTargetGroupId("");
      setOfferId("");
      setTemplateId("simple");
      setPreviewLeadId(leads[0]?.id ?? "");
      setLeadSource("selected");
      setLeadListId("");
      setName(`Kampagne ${new Date().toLocaleDateString("de-DE")}`);
      setIsSubmitting(false);
      setError(null);
      setResult(null);
    }
    wasOpen.current = open;
  }, [leads, open]);

  if (!open) return null;

  const canContinue = step === 0
    ? leadSource === "selected" || Boolean(leadListId)
    : step === 1
    ? Boolean(targetGroupId)
    : step === 2
      ? Boolean(offerId)
      : step === 5
        ? Boolean(name.trim() && targetGroupId && offerId)
        : true;

  async function createCampaign() {
    if (!targetGroupId) throw new Error("Bitte Zielgruppe auswählen");
    if (!offerId) throw new Error("Bitte Angebot auswählen");
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/campaigns/create-from-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectIds: leads.map((lead) => lead.id),
          leadListId: leadSource === "list" ? leadListId : undefined,
          targetGroupId,
          offerId,
          templateId: templateId === "simple" ? undefined : templateId,
          name: name.trim()
        })
      });
      const body = (await response.json().catch(() => null)) as { campaignId?: string; added?: number; skipped?: number; failed?: number; error?: string } | null;
      if (!response.ok || !body?.campaignId) {
        throw new Error(body?.error ?? "Kampagne konnte nicht erstellt werden.");
      }
      const next = {
        campaignId: body.campaignId,
        added: body.added ?? 0,
        skipped: body.skipped ?? 0,
        failed: body.failed ?? 0
      };
      setResult(next);
      onSuccess?.(next);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Kampagne konnte nicht erstellt werden.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="campaign-flow-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">One-Click-Kampagne</p>
            <h2 id="campaign-flow-title" className="mt-1 text-lg font-semibold text-ink">{steps[step]}</h2>
            <p className="mt-1 text-sm text-slate-500">{leadSource === "list" ? "Leadliste als Empfängerquelle" : `${leads.length} Leads ausgewählt`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-5 py-3">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-semibold ${step === index ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}
          {result ? (
            <SuccessState result={result} onReset={() => { setResult(null); setStep(0); onClose(); }} />
          ) : (
            <>
              {step === 0 ? (
                <div className="space-y-4">
                  {leadLists.length > 0 ? (
                    <Field label="Empfängerquelle">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                          <input type="radio" checked={leadSource === "selected"} onChange={() => setLeadSource("selected")} />
                          Einzelne Leads ({leads.length})
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                          <input type="radio" checked={leadSource === "list"} onChange={() => setLeadSource("list")} />
                          Leadliste
                        </label>
                      </div>
                      {leadSource === "list" ? (
                        <select value={leadListId} onChange={(event) => setLeadListId(event.target.value)} className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                          <option value="">Leadliste auswählen</option>
                          {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.count ?? 0})</option>)}
                        </select>
                      ) : null}
                    </Field>
                  ) : null}
                  {leadSource === "selected" ? <LeadCheck leads={leads} invalidLeads={invalidLeads} missingEmail={missingEmail} missingLandingpage={missingLandingpage} /> : null}
                </div>
              ) : null}
              {step === 1 ? (
                <Field label="Zielgruppe">
                  <select value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Bitte Zielgruppe auswählen</option>
                    {targetGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </Field>
              ) : null}
              {step === 2 ? (
                <Field label="Angebot">
                  <select value={offerId} onChange={(event) => setOfferId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Bitte Angebot auswählen</option>
                    {filteredOffers.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.name}{offer.targetGroupId === targetGroupId ? " · Zielgruppe" : offer.isDefault ? " · Standard" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">Passende Angebote stehen oben. Du kannst jedes Angebot manuell auswählen.</p>
                </Field>
              ) : null}
              {step === 3 ? (
                <Field label="Kampagnenvorlage">
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                      <input type="radio" checked={templateId === "simple"} onChange={() => setTemplateId("simple")} />
                      Neue einfache 2-Step-Kampagne
                    </label>
                    {templates.map((template) => (
                      <label key={template.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                        <input type="radio" checked={templateId === template.id} onChange={() => setTemplateId(template.id)} />
                        <span>
                          <span className="block font-semibold text-ink">{template.name}</span>
                          <span className="block truncate text-xs text-slate-500">{template.subject}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>
              ) : null}
              {step === 4 ? (
                <div className="space-y-4">
                  <Field label="Beispiel-Lead">
                    <select value={previewLead?.id ?? ""} onChange={(event) => setPreviewLeadId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                      {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.companyName}</option>)}
                    </select>
                  </Field>
                  <PreviewCard title="E-Mail Step 1" subject={preview.step1.subject} body={preview.step1.body} />
                  <PreviewCard title="E-Mail Step 2" subject={preview.step2.subject} body={preview.step2.body} />
                  {previewLead?.landingpageUrl || previewLead?.slug ? (
                    <a className="inline-flex text-sm font-semibold text-blue-700" href={previewLead.landingpageUrl ?? `/p/${previewLead.slug}`}>Landingpage öffnen</a>
                  ) : null}
                </div>
              ) : null}
              {step === 5 ? (
                <div className="space-y-4">
                  <Field label="Kampagnenname">
                    <input value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                  </Field>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p><strong>{leadSource === "list" ? (leadLists.find((list) => list.id === leadListId)?.count ?? 0) : leads.length}</strong> Leads ausgewählt.</p>
                    <p className="mt-1">E-Mails werden nicht automatisch gesendet.</p>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </main>

        {!result ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || isSubmitting} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Zurück
            </button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={() => setStep((current) => current + 1)} disabled={!canContinue} className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
                Weiter
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" onClick={() => void createCampaign()} disabled={!canContinue || isSubmitting} className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
                <Check className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? "Erstellt..." : "Kampagne erstellen"}
              </button>
            )}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function LeadCheck({ leads, invalidLeads, missingEmail, missingLandingpage }: { leads: CampaignFlowLead[]; invalidLeads: CampaignFlowLead[]; missingEmail: CampaignFlowLead[]; missingLandingpage: CampaignFlowLead[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Ausgewählt" value={leads.length} />
        <Metric label="Fehlende E-Mail" value={missingEmail.length} />
        <Metric label="Fehlende Landingpage" value={missingLandingpage.length} />
      </div>
      <IssueList title="Ungültige Leads" leads={invalidLeads} />
      <IssueList title="Fehlende E-Mail" leads={missingEmail} />
      <IssueList title="Fehlende Landingpage" leads={missingLandingpage} />
    </div>
  );
}

function SuccessState({ result, onReset }: { result: { campaignId: string; added: number; skipped: number; failed: number }; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Kampagne erstellt. {result.added} Leads hinzugefügt. {result.skipped} übersprungen.
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`/admin/campaigns?campaignId=${result.campaignId}`} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">Zur Kampagne</Link>
        <button type="button" onClick={onReset} className="btn-secondary rounded-xl px-4 py-2 text-sm font-semibold">Weitere Leads auswählen</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{value}</p></div>;
}

function IssueList({ title, leads }: { title: string; leads: CampaignFlowLead[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {leads.length === 0 ? <p className="mt-2 text-sm text-slate-500">Keine Einträge</p> : (
        <div className="mt-3 max-h-36 space-y-2 overflow-y-auto">
          {leads.map((lead) => <p key={lead.id} className="truncate text-sm text-slate-600">{lead.companyName} · {lead.email ?? "keine E-Mail"} · {hasLandingpage(lead) ? "Landingpage vorhanden" : "keine Landingpage"}</p>)}
        </div>
      )}
    </div>
  );
}

function PreviewCard({ title, subject, body }: { title: string; subject: string; body: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p><h3 className="mt-2 text-sm font-semibold text-ink">{subject}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{body}</p></div>;
}

function buildPreview(lead: CampaignFlowLead | null, template: CampaignFlowTemplate | null) {
  const companyName = lead?.companyName ?? "{{companyName}}";
  const landingpageUrl = lead?.landingpageUrl ?? (lead?.slug ? `/p/${lead.slug}` : "{{landingpageUrl}}");
  const step1 = template
    ? { subject: renderTemplate(template.subject, companyName, landingpageUrl), body: renderTemplate(template.bodyText, companyName, landingpageUrl) }
    : { subject: `Kurzer Impuls für ${companyName}`, body: `Hallo,\n\nich habe eine kurze Seite für ${companyName} vorbereitet:\n${landingpageUrl}` };
  return {
    step1,
    step2: {
      subject: `Nochmal kurz zu ${companyName}`,
      body: `Hallo,\n\nich wollte meine kurze Nachricht nochmal nach oben holen. Passt ein kurzer Austausch zu ${companyName}?`
    }
  };
}

function renderTemplate(value: string, companyName: string, landingpageUrl: string) {
  return value
    .replace(/{{\s*companyName\s*}}/g, companyName)
    .replace(/{{\s*landingpageUrl\s*}}/g, landingpageUrl);
}

function hasLandingpage(lead: CampaignFlowLead) {
  return Boolean(lead.landingpageUrl || lead.slug);
}

function isValidCampaignLead(lead: CampaignFlowLead) {
  return Boolean(lead.email && hasLandingpage(lead));
}
