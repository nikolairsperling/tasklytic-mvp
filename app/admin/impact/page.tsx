import Link from "next/link";
import { AdminCard } from "@/components/admin/ui";
import { formatImpactProgress, impactProgress } from "@/lib/impact";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const cards = [
  {
    title: "Personalisierte Landingpages",
    description: "Generiere einzigartige Landingpages für jeden Lead mit dynamischen Inhalten und QR-Codes.",
    href: "/admin/impact/landingpages",
    border: "border-cyan-300",
    icon: "LP"
  },
  {
    title: "Personalisierte Videos",
    description: "Erstelle individuelle Video-Nachrichten für jeden Lead mit KI-Stimme und persönlicher Ansprache.",
    href: "/admin/impact/videos",
    border: "border-fuchsia-300",
    icon: "▶"
  },
  {
    title: "Personalisierte Briefe",
    description: "Erstelle personalisierte Briefvorlagen für ausgewählte Kontakte.",
    href: "/admin/assets/messages",
    border: "border-orange-300",
    icon: "B",
    badge: "Template V1"
  }
];

export default async function ImpactStudioPage() {
  const jobs = await prisma.impactJob.findMany({
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { name: true } } },
    take: 20
  });
  const activeJobs = jobs.filter((job) => ["pending", "running"].includes(job.status));
  const pastJobs = jobs.filter((job) => !["pending", "running"].includes(job.status));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-500">Outreach &gt; <span className="text-ink">Impact Studio</span></p>
        <input placeholder="Jobs, Kampagnen oder Inhalte suchen" className="max-w-sm rounded-full border border-slate-200 bg-white px-4 py-2 text-sm" />
      </div>

      <section className="text-center">
        <h1 className="text-3xl font-semibold text-ink md:text-4xl">Was möchtest du generieren?</h1>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className={`group rounded-3xl border-2 ${card.border} bg-white p-6 text-left shadow-panel transition hover:-translate-y-1 hover:shadow-xl`}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">{card.icon}</span>
                {card.badge ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{card.badge}</span> : null}
              </div>
              <h2 className="mt-6 text-xl font-semibold text-ink">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Link href="/admin/assets" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Aktive Inhalte verwalten</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <JobList title="Aktive Jobs" jobs={activeJobs} empty="Keine aktiven Jobs." />
        <JobList title="Vergangene Jobs" jobs={pastJobs} empty="Noch keine vergangenen Jobs." />
      </div>
    </div>
  );
}

type ImpactJobRow = Awaited<ReturnType<typeof prisma.impactJob.findMany>>[number] & { campaign?: { name: string } | null };

function JobList({ title, jobs, empty }: { title: string; jobs: ImpactJobRow[]; empty: string }) {
  return (
    <AdminCard>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-3">
        {jobs.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{empty}</p> : null}
        {jobs.map((job) => (
          <div key={job.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{job.name}</p>
                <p className="mt-1 text-xs text-slate-500">{job.type} · {job.campaign?.name ?? "Keine Kampagne"} · {job.creditsUsed} Credits</p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${impactProgress(job)}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{formatImpactProgress(job)}</span>
              <Link href={`/api/impact/jobs/${job.id}`} className="font-semibold text-slate-800">Ansehen</Link>
            </div>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "completed" ? "bg-emerald-100 text-emerald-700" : status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{status}</span>;
}
