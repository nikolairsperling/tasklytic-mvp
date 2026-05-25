import { notFound } from "next/navigation";
import React from "react";
import { Activity, CalendarCheck, CheckCircle2, ExternalLink, Eye, FileText, Mail, MousePointerClick, Play, ShieldCheck, Video } from "lucide-react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";
import { buildCompanyDescription, buildPainHypothesis, buildStructuredLeadInsights, getLeadDataQuality, normalizeLeadContactCandidates, stateFromGermanPostalCode } from "@/lib/lead-data-quality";
import { prisma } from "@/lib/prisma";
import { prospectEventLabel } from "@/lib/prospect-events";

export const dynamic = "force-dynamic";

type ProspectDetailPageProps = {
  params: Promise<{ id: string }>;
};

const engagementTone = {
  cold: "neutral",
  warm: "amber",
  hot: "red"
} as const;

export default async function ProspectDetailPage({ params }: ProspectDetailPageProps) {
  const { id } = await params;
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 100
      },
      enrichmentRuns: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!prospect) {
    notFound();
  }

  const landingpageHref = prospect.slug ? `/p/${prospect.slug}` : null;
  const derivedState = prospect.state ?? stateFromGermanPostalCode(prospect.postalCode);
  const companyDescription = buildCompanyDescription({ ...prospect, state: derivedState });
  const painHypothesis = buildPainHypothesis(prospect);
  const quality = getLeadDataQuality(prospect);
  const insights = buildStructuredLeadInsights(prospect);
  const contactCandidates = normalizeLeadContactCandidates(prospect.contactCandidates, prospect.decisionMakerName);

  return (
    <div className="lead-detail-page space-y-6">
      <PageHeader
        title={prospect.companyName}
        description="Prospect Übersicht, Score und komplette Activity Journey."
        backButton={<AdminBackButton href="/admin/prospects" />}
        action={
          landingpageHref ? (
            <a href={landingpageHref} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              Landingpage öffnen
            </a>
          ) : null
        }
      />

      <div className="lead-detail-layout">
        <div className="space-y-6">
          <AdminCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Prospect Übersicht</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{prospect.companyName}</h2>
                <p className="mt-2 text-sm text-slate-500">{[prospect.street, prospect.postalCode, prospect.city, prospect.country].filter(Boolean).join(", ")}</p>
              </div>
              <StatusBadge tone={engagementTone[prospect.engagementLevel as keyof typeof engagementTone] ?? "neutral"}>
                {prospect.engagementLevel}
              </StatusBadge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Info label="Status" value={prospect.status} />
              <Info label="Kontakt" value={prospect.decisionMakerName ?? "k. A."} />
              <Info label="E-Mail" value={prospect.decisionMakerEmail ?? prospect.companyEmail ?? "k. A."} />
              <Info label="Telefon" value={prospect.phone ?? "k. A."} />
              <Info label="Website" value={prospect.websiteUrl ?? "k. A."} websiteUrl={prospect.websiteUrl} />
              <Info label="Bundesland" value={derivedState ?? "k. A."} />
              <Info label="Website-Prüfung" value={formatWebsiteVerification(prospect)} />
              <Info label="Website-Kandidat" value={prospect.websiteCandidate ?? "k. A."} websiteUrl={prospect.websiteCandidate} />
              <Info label="E-Mail-Prüfung" value={formatEmailVerification(prospect)} />
              <Info label="E-Mail-Kandidat" value={prospect.emailCandidate ?? "k. A."} />
              <Info label="Branche" value={prospect.businessFields.join(", ") || "k. A."} />
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-semibold text-ink">Datenqualität</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Quality label="Ansprechpartner" value={quality.contact} icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} />
              <Quality label="Pain-Hypothese" value={quality.pain} icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />} />
              <Quality label="Datenquelle" value={quality.sources} icon={<FileText className="h-4 w-4" aria-hidden="true" />} />
              <Quality label="Landingpage" value={quality.landingpage} icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />} />
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-semibold text-ink">Firmenprofil & Hypothese</h2>
            <div className="mt-4 grid gap-3">
              <Info label="Was macht die Firma?" value={companyDescription} />
              <Info label="Schmerzpunkt-Hypothese" value={painHypothesis} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Insight title="Relevante Signale" items={insights.relevantSignals} />
              <Insight title="Warum Tasklytic passt" items={insights.tasklyticFit} />
              <Insight title="Verwendete Quellen" items={insights.sources} />
              <Insight title="Unsicherheit / Annahmen" items={[insights.uncertainty]} />
            </div>
            <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Technische Quellen / Rohdaten</summary>
              <pre className="max-h-80 overflow-auto border-t border-slate-200 p-4 text-xs text-slate-600">{JSON.stringify(prospect.researchSources ?? {}, null, 2)}</pre>
            </details>
          </AdminCard>

          {contactCandidates.length > 0 ? (
            <AdminCard>
              <h2 className="text-lg font-semibold text-ink">Kontaktkandidaten prüfen</h2>
              <div className="mt-4 grid gap-3">
                {contactCandidates.map((candidate, index) => (
                  <div key={`${candidate.fullName}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-ink">{candidate.fullName}</p>
                    <p className="mt-1 text-sm text-slate-600">{[candidate.role, candidate.email, candidate.phone].filter(Boolean).join(" · ") || "Keine weiteren Kontaktdaten"}</p>
                  </div>
                ))}
              </div>
            </AdminCard>
          ) : null}

          <AdminCard>
            <h2 className="text-lg font-semibold text-ink">Scores</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Score label="ICP/Fit Score" value={prospect.fitScore} helper={`Kategorie ${prospect.icpCategory}`} />
              <Score label="Engagement Score" value={prospect.engagementScore} helper={`Level ${prospect.engagementLevel}`} />
              <Score label="Pain Score" value={prospect.painScore} />
              <Score label="Kontaktqualität" value={prospect.contactQualityScore} />
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-semibold text-ink">Persönliche Assets</h2>
            <div className="mt-4 grid gap-3">
              <Info label="Landingpage" value={landingpageHref ?? "Nicht erstellt"} />
              <Info label="Persönliches Video" value={prospect.personalVideoUrl ?? prospect.videoUrl ?? "Nicht hinterlegt"} />
              <Info label="Thumbnail" value={prospect.personalVideoThumbnailUrl ?? "Nicht hinterlegt"} />
              <Info label="Buchungsseite" value={prospect.bookingUrl ?? prospect.calendarUrl ?? "Nicht hinterlegt"} />
            </div>
          </AdminCard>
        </div>

        <AdminCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Activity Feed</h2>
              <p className="mt-1 text-sm text-slate-500">Neueste Events zuerst.</p>
            </div>
            <StatusBadge tone={prospect.events.length > 0 ? "brand" : "neutral"}>{prospect.events.length} Events</StatusBadge>
          </div>

          <div className="mt-6 space-y-4">
            {prospect.events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                Noch keine Activity Events vorhanden.
              </div>
            ) : (
              prospect.events.map((event) => (
                <div key={event.id} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                    <EventIcon type={event.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink">{prospectEventLabel(event.type)}</p>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        +{event.scoreDelta}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{new Date(event.createdAt).toLocaleString("de-DE")}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function Info({ label, value, websiteUrl }: { label: string; value: string; websiteUrl?: string | null }) {
  const websiteHref = label === "Website" ? normalizeExternalWebsiteHref(websiteUrl) : null;
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      {label === "Website" && websiteUrl ? (
        websiteHref ? (
          <a
            href={websiteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99]"
          >
            <span className="min-w-0 break-all">{websiteUrl}</span>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Website öffnen</span>
          </a>
        ) : (
          <p className="mt-1 break-words text-sm font-medium text-red-700">Website ungültig</p>
        )
      ) : (
        <p className="mt-1 break-words text-sm font-medium text-ink">{value}</p>
      )}
    </div>
  );
}

function formatWebsiteVerification(prospect: {
  websiteVerified: boolean;
  websiteCandidate: string | null;
  websiteConfidence: number | null;
  companyMatchSource: string | null;
}) {
  const label = prospect.websiteVerified ? "Website geprüft" : prospect.websiteCandidate ? "Neue Website vorgeschlagen" : "Nicht bestätigt";
  return [label, typeof prospect.websiteConfidence === "number" ? `Confidence ${prospect.websiteConfidence}` : null, prospect.companyMatchSource].filter(Boolean).join(" · ");
}

function formatEmailVerification(prospect: {
  emailVerified: boolean;
  emailCandidate: string | null;
  emailConfidence: number | null;
}) {
  const label = prospect.emailVerified ? "E-Mail bestätigt" : prospect.emailCandidate ? "E-Mail aus Impressum gefunden" : "E-Mail unbestätigt";
  return [label, typeof prospect.emailConfidence === "number" ? `Confidence ${prospect.emailConfidence}` : null].filter(Boolean).join(" · ");
}

function normalizeExternalWebsiteHref(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function Score({ label, value, helper }: { label: string; value: number; helper?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function Quality({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const tone = value === "sicher" || value === "vorhanden" || value === "bereit" ? "bg-emerald-50 text-emerald-800" : value === "fehlt" || value === "unvollständig" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800";
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-4 ${tone}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/80">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-[0.16em] opacity-70">{label}</p>
        <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
      </div>
    </div>
  );
}

function Insight({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  const className = "h-4 w-4";
  if (type === "page_view") return <Eye className={className} aria-hidden="true" />;
  if (type === "video_started") return <Play className={className} aria-hidden="true" />;
  if (type === "video_watched") return <Video className={className} aria-hidden="true" />;
  if (type === "cta_clicked" || type === "email_clicked") return <MousePointerClick className={className} aria-hidden="true" />;
  if (type === "booking_opened" || type === "booking_completed") return <CalendarCheck className={className} aria-hidden="true" />;
  if (type === "email_opened" || type === "email_replied") return <Mail className={className} aria-hidden="true" />;
  return <Activity className={className} aria-hidden="true" />;
}
