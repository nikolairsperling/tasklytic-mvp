"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AnalyticsFilters, AnalyticsOverview } from "@/lib/analytics";

type FilterOption = { id: string; name: string };

type AnalyticsDashboardProps = {
  overview: AnalyticsOverview;
  filters: Required<AnalyticsFilters>;
  options: {
    campaigns: FilterOption[];
    targetGroups: FilterOption[];
    offers: FilterOption[];
    leadLists: FilterOption[];
  };
};

const colors = ["#2563eb", "#0891b2", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b", "#0f172a"];

const kpiConfig: Array<{ key: keyof AnalyticsOverview["kpis"]; label: string; helper: string; percent?: keyof AnalyticsOverview["kpis"] }> = [
  { key: "totalLeads", label: "Leads gesamt", helper: "Alle Leads im aktuellen Filter" },
  { key: "enriched", label: "Angereichert", helper: "Research abgeschlossen", percent: "enrichmentRate" },
  { key: "landingpagesCreated", label: "Landingpages erstellt", helper: "Leads mit URL oder Slug", percent: "landingpageRate" },
  { key: "emailsSent", label: "E-Mails versendet", helper: "Erfolgreich versendete Mails" },
  { key: "openRate", label: "Öffnungsrate", helper: "Geöffnet / versendet" },
  { key: "clickRate", label: "Klickrate", helper: "Geklickt / versendet" },
  { key: "replyRate", label: "Antwortquote", helper: "Antworten / versendet" },
  { key: "bookingOpenedRate", label: "Buchungsseiten geöffnet", helper: "Buchungsseiten-Events / Leads" },
  { key: "hotLeadRate", label: "Hot Leads", helper: "Hot Leads / Leads" },
  { key: "appointmentConversionRate", label: "Conversion zu Termin", helper: "Termine / Leads" }
];

export function AnalyticsDashboard({ overview, filters, options }: AnalyticsDashboardProps) {
  const hasAnyData = overview.kpis.totalLeads > 0 || overview.kpis.emailsSent > 0;

  return (
    <div className="space-y-6">
      <form action="/admin/analytics" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Select name="dateRange" label="Zeitraum" value={filters.dateRange} options={[
            { id: "7d", name: "7 Tage" },
            { id: "30d", name: "30 Tage" },
            { id: "90d", name: "90 Tage" },
            { id: "all", name: "Gesamt" }
          ]} />
          <Select name="campaignId" label="Kampagne" value={filters.campaignId} options={options.campaigns} empty="Alle Kampagnen" />
          <Select name="targetGroupId" label="Zielgruppe" value={filters.targetGroupId} options={options.targetGroups} empty="Alle Zielgruppen" />
          <Select name="offerId" label="Angebot" value={filters.offerId} options={options.offers} empty="Alle Angebote" />
          <Select name="leadListId" label="Leadliste" value={filters.leadListId} options={options.leadLists} empty="Alle Leadlisten" />
          <Select name="event" label="Ereignis" value={filters.event} options={[
            { id: "open", name: "Öffnungen" },
            { id: "click", name: "Klicks" }
          ]} empty="Alle Ereignisse" />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">Filter anwenden</button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiConfig.map((entry) => {
          const value = overview.kpis[entry.key] as number;
          const percent = entry.percent ? overview.kpis[entry.percent] as number : undefined;
          return (
            <div key={entry.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{entry.label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{formatKpiValue(value, entry.key.toLowerCase().includes("rate"))}</p>
              {percent !== undefined ? <p className="mt-1 text-xs font-semibold text-blue-700">{formatPercent(percent)}</p> : null}
              <p className="mt-2 text-xs leading-5 text-slate-500">{entry.helper}</p>
            </div>
          );
        })}
      </div>

      {!hasAnyData ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Keine Analytics-Daten für diesen Filter.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Lead Funnel" empty={overview.funnel.every((entry) => entry.value === 0)}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={overview.funnel} layout="vertical" margin={{ left: 24, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value, name, item) => [`${value} (${formatPercent(item.payload.rate ?? 0)})`, "Leads"]} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Kampagnen Performance" empty={overview.campaignPerformance.length === 0}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={overview.campaignPerformance}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={72} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" name="Gesendet" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="opened" name="Geöffnet" fill="#0891b2" radius={[6, 6, 0, 0]} />
              <Bar dataKey="clicked" name="Geklickt" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Bar dataKey="replied" name="Geantwortet" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Aktivitäten über Zeit" empty={overview.activityTimeline.length === 0}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={overview.activityTimeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="emailsSent" name="E-Mails" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="opened" name="Geöffnet" stroke="#0891b2" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="clicked" name="Geklickt" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="replied" name="Antworten" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="bookingOpened" name="Buchung geöffnet" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid gap-6 md:grid-cols-2">
          <PieCard title="Hot/Warm/Cold" data={overview.engagementDistribution} />
          <PieCard title="ICP High/Medium/Low" data={overview.icpDistribution} />
        </div>
      </div>
    </div>
  );
}

function Select({ name, label, value, options, empty }: { name: string; label: string; value: string; options: FilterOption[]; empty?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink">
        {empty ? <option value="">{empty}</option> : null}
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {empty ? <div className="grid h-64 max-h-[280px] place-items-center text-sm text-slate-500 md:h-80 md:max-h-none">Keine Daten vorhanden.</div> : <div className="mt-4">{children}</div>}
    </section>
  );
}

function PieCard({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  const empty = data.every((entry) => entry.value === 0);
  return (
    <ChartCard title={title} empty={empty}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
            {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function formatKpiValue(value: number, percent: boolean) {
  return percent ? formatPercent(value) : value.toLocaleString("de-DE");
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")} %`;
}
