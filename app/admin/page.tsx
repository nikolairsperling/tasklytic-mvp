import Link from "next/link";
import { Children, type ReactNode } from "react";
import { InstallPromptCard, PushStatusCard } from "@/components/admin/pwa-client";
import { AdminCard, DataTable, PageHeader, StatCard, StatusBadge } from "@/components/admin/ui";
import { getDashboardMetrics } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { getUserOffer, missingOfferMessage } from "@/lib/user-offer";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const offer = await getUserOffer();
  if (!offer) {
    return (
      <div>
        <PageHeader title="Übersicht" description="Das Dashboard ist gesperrt, bis der Offer-Kontext gesetzt ist." />
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">{missingOfferMessage}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Definiere zuerst Dienstleistung, Zielgruppe, Probleme und Lösung. Danach nutzen Research, ICP, E-Mails, Landingpages und Videos diesen Kontext.
          </p>
          <Link href="/admin/setup/offers" className="btn-primary mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold">
            Angebot definieren
          </Link>
        </AdminCard>
      </div>
    );
  }

  const now = new Date();
  const [metrics, campaigns, recentLogs, hotLeads, dueFollowUps, newReplies] = await Promise.all([
    getDashboardMetrics(),
    prisma.campaign.findMany({ include: { enrollments: true, sendLogs: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.emailSendLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { campaign: { select: { name: true } }, prospect: { select: { companyName: true } }, step: { select: { position: true } } } }),
    prisma.prospect.findMany({
      where: { isHotLead: true },
      orderBy: [{ totalScore: "desc" }, { updatedAt: "desc" }],
      take: 5,
      select: { id: true, companyName: true, totalScore: true, engagementLevel: true, phone: true, companyPhone: true, followUpAt: true, updatedAt: true }
    }),
    prisma.prospect.findMany({
      where: { followUpStatus: "open", followUpAt: { not: null, lte: now } },
      orderBy: { followUpAt: "asc" },
      take: 5,
      select: { id: true, companyName: true, decisionMakerName: true, followUpAt: true, followUpReason: true, phone: true, companyPhone: true }
    }),
    prisma.inboundEmail.findMany({
      where: { status: "unread" },
      orderBy: { receivedAt: "desc" },
      take: 5,
      include: { matchedProspect: { select: { id: true, companyName: true } } }
    })
  ]);
  const quickActions = [["Leads importieren", "/admin/import"], ["Lead Workflow", "/admin/workflows/lead-to-outreach"], ["Neuer Prospect", "/admin/prospects"], ["Neue Kampagne", "/admin/campaigns"], ["Fällige Mails senden", "/admin/campaigns"], ["Mail prüfen", "/admin/settings/email"]];
  return (
    <div>
      <PageHeader title="Übersicht" description="Zentrale Hauptansicht für Outreach, Kampagnen, Inbox und Pipeline." />
      <div className="mb-6 grid gap-4 md:hidden">
        <InstallPromptCard />
        <PushStatusCard />
        <MobileSection title="Heiße Leads" empty="Keine heißen Leads gefunden.">
          {hotLeads.map((lead) => (
            <article key={lead.id} className="rounded-2xl border border-white/10 bg-white p-4 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-ink">{lead.companyName}</h3>
                  <p className="mt-1 text-sm text-slate-500">{lead.engagementLevel || "Hot Lead"} · {formatDashboardDate(lead.updatedAt)}</p>
                </div>
                <StatusBadge tone="brand">{lead.totalScore}</StatusBadge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Link href={`/admin/prospects/${lead.id}`} className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold">Öffnen</Link>
                <a href={`tel:${lead.phone ?? lead.companyPhone ?? ""}`} className={`btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${lead.phone || lead.companyPhone ? "" : "pointer-events-none opacity-40"}`}>Anrufen</a>
                <Link href={`/admin/follow-ups?prospectId=${lead.id}`} className="btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold">Follow-up</Link>
              </div>
            </article>
          ))}
        </MobileSection>
        <MobileSection title="Heute fällig" empty="Heute sind keine Follow-ups fällig.">
          {dueFollowUps.map((lead) => (
            <article key={lead.id} className="rounded-2xl border border-white/10 bg-white p-4 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-ink">{lead.companyName}</h3>
                  <p className="mt-1 text-sm text-slate-500">{lead.decisionMakerName ?? "Ansprechpartner offen"}</p>
                </div>
                <time className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{formatDashboardTime(lead.followUpAt)}</time>
              </div>
              <p className="mt-3 text-sm text-slate-600">{lead.followUpReason ?? "Follow-up durchführen"}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Link href={`/admin/prospects/${lead.id}`} className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold">Öffnen</Link>
                <a href={`tel:${lead.phone ?? lead.companyPhone ?? ""}`} className={`btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${lead.phone || lead.companyPhone ? "" : "pointer-events-none opacity-40"}`}>Anrufen</a>
                <Link href="/admin/inbox" className="btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold">KI Text</Link>
              </div>
            </article>
          ))}
        </MobileSection>
        <MobileSection title="Neue Antworten" empty="Keine ungelesenen Antworten.">
          {newReplies.map((email) => (
            <Link key={email.id} href="/admin/inbox" className="block rounded-2xl border border-white/10 bg-white p-4 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-ink">{email.matchedProspect?.companyName ?? email.fromName ?? email.fromEmail}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{email.subject}</p>
                </div>
                <time className="shrink-0 text-xs text-slate-400">{formatDashboardDate(email.receivedAt)}</time>
              </div>
            </Link>
          ))}
        </MobileSection>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Kontakte gesamt" value={metrics.prospects} tone="brand" href="/admin/prospects" />
        <StatCard label="Kampagnenfähig" value={metrics.campaignReady} tone="green" href="/admin/prospects?dashboardFilter=campaignReady" />
        <StatCard label="Aktive Kampagnen" value={metrics.activeCampaigns} href="/admin/campaigns?status=active" />
        <StatCard label="Geplant" value={metrics.plannedCampaigns} href="/admin/campaigns?dashboardFilter=planned" />
        <StatCard label="Gesendet" value={metrics.sent} tone="green" href="/admin/campaigns?hasSent=1&tab=sendelog" />
        <StatCard label="Öffnungen" value={metrics.opens} href="/admin/analytics?event=open&dateRange=all" />
        <StatCard label="Klicks" value={metrics.clicks} href="/admin/analytics?event=click&dateRange=all" />
        <StatCard label="Antworten" value={metrics.replies} tone="brand" href="/admin/inbox?filter=replies" />
        <StatCard label="Termine" value={metrics.booked} tone="green" href="/admin/prospects?dashboardFilter=booked" />
        <StatCard label="Kein Interesse" value={metrics.notInterested} tone="red" href="/admin/prospects?dashboardFilter=notInterested" />
        <StatCard label="Pipeline-Wert" value={`${metrics.pipelineValue.toLocaleString("de-DE")} EUR`} href="/admin/prospects?dashboardFilter=booked" />
        <StatCard label="ROI" value={metrics.roi === null ? "n/a" : `${metrics.roi.toFixed(1)}%`} href="/admin/campaigns?tab=analytics" />
        <StatCard label="Importierte Leads" value={metrics.importedLeads} href="/admin/prospects?dashboardFilter=imported" />
        <StatCard label="Angereichert" value={metrics.enrichedLeads} href="/admin/prospects?dashboardFilter=enriched" />
        <StatCard label="Gültige Leads" value={metrics.validLeads} tone="green" href="/admin/prospects?dashboardFilter=valid" />
        <StatCard label="Aussortiert" value={metrics.invalidCompanies} tone="red" href="/admin/prospects?dashboardFilter=invalid" />
        <StatCard label="Landingpages" value={metrics.generatedLandingpages} href="/admin/landingpages?generated=true" />
        <StatCard label="Generierte E-Mails" value={metrics.generatedEmails} href="/admin/campaigns?dashboardFilter=generatedEmails&tab=steps" />
        <StatCard label="ClickUp gesamt" value={metrics.clickUpSyncedTotal} href="/admin/prospects" />
        <StatCard label="ClickUp heute" value={metrics.clickUpSyncedToday} tone="green" href="/admin/prospects" />
        <StatCard label="ClickUp Updates" value={metrics.clickUpUpdates} href="/admin/prospects" />
        <StatCard label="Sync Fehler" value={metrics.clickUpOpenErrors} tone={metrics.clickUpOpenErrors > 0 ? "red" : "green"} href="/admin/prospects" />
      </div>
      <AdminCard className="mt-6">
        <h2 className="text-lg font-semibold text-ink">Quick Actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(([label, href]) => <Link key={label} href={href} className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">{label}</Link>)}
        </div>
      </AdminCard>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Kampagnen Performance</h2>
          <div className="mt-4 space-y-3 md:hidden">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 flex-1 truncate font-semibold text-ink">{campaign.name}</h3>
                  <StatusBadge tone="brand">{campaign.status}</StatusBadge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Enrollments" value={campaign.enrollments.length} />
                  <Metric label="Sent" value={campaign.sendLogs.filter((l) => l.status === "sent").length} />
                  <Metric label="Opened" value={campaign.sendLogs.filter((l) => l.openCount > 0).length} />
                  <Metric label="Clicked" value={campaign.sendLogs.filter((l) => l.clickCount > 0).length} />
                </div>
              </article>
            ))}
          </div>
          <div className="hidden md:block">
            <DataTable><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.16em] text-slate-400"><tr><th className="p-3">Kampagne</th><th>Status</th><th>Enrollments</th><th>Sent</th><th>Opened</th><th>Clicked</th></tr></thead><tbody className="divide-y divide-white/10">{campaigns.map((campaign) => <tr key={campaign.id}><td className="p-3 font-medium text-ink">{campaign.name}</td><td><StatusBadge tone="brand">{campaign.status}</StatusBadge></td><td>{campaign.enrollments.length}</td><td>{campaign.sendLogs.filter((l) => l.status === "sent").length}</td><td>{campaign.sendLogs.filter((l) => l.openCount > 0).length}</td><td>{campaign.sendLogs.filter((l) => l.clickCount > 0).length}</td></tr>)}</tbody></table></DataTable>
          </div>
        </AdminCard>
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Letzte Aktivitäten</h2>
          <div className="mt-4 space-y-3">{recentLogs.length === 0 ? <p className="text-sm text-slate-500">Noch keine Aktivitäten.</p> : recentLogs.map((log) => <div key={log.id} className="rounded-xl border border-white/10 p-3"><p className="text-sm font-medium text-ink">{log.prospect.companyName}</p><p className="text-xs text-slate-500">{log.campaign.name} · Step {log.step.position + 1} · {log.status}</p></div>)}</div>
        </AdminCard>
      </div>
    </div>
  );
}

function MobileSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2>
      <div className="grid gap-3">{items.length > 0 ? items : <p className="rounded-2xl border border-white/10 bg-white p-4 text-sm text-slate-500 shadow-panel">{empty}</p>}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function formatDashboardDate(value: Date | string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDashboardTime(value: Date | string | null) {
  if (!value) return "Heute";
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
