import type { Metadata } from "next";

type MockVideoPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: MockVideoPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Mock Video ${slug} | Tasklytic`,
    robots: { index: false, follow: false, nocache: true }
  };
}

export default async function MockVideoPage({ params }: MockVideoPageProps) {
  const { slug } = await params;
  const label = decodeURIComponent(slug).replace(/-/g, " ");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="aspect-video bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.30),transparent_32%),linear-gradient(135deg,#0f172a,#111827_45%,#164e63)] p-6 sm:p-10">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Mock Video
              </span>
              <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">Ready</span>
            </div>
            <div>
              <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-cyan-400 text-3xl font-black text-slate-950 shadow-xl sm:h-24 sm:w-24">
                Play
              </div>
              <h1 className="max-w-2xl text-3xl font-semibold capitalize leading-tight sm:text-5xl">
                Mock-Video für {label}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-cyan-50/80 sm:text-base">
                Platzhalter fuer ein personalisiertes Outreach-Video. Diese URL ist absichtlich browserfaehig und ersetzt die alte API-Mock-URL.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 bg-slate-950 px-5 py-4 text-sm text-slate-400">
          <span>Tasklytic Video Placeholder</span>
          <span className="font-mono text-xs">/mock-videos/{slug}</span>
        </div>
      </section>
    </main>
  );
}
