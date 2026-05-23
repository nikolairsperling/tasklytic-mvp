import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLegalEntry, getLegalSettings, type LegalKind } from "@/lib/legal-settings";

export const dynamic = "force-dynamic";

type LegalPageProps = {
  params: Promise<{ kind: string }>;
};

const allowedKinds = ["impressum", "datenschutz", "cookies"] as const;

export default async function LegalPage({ params }: LegalPageProps) {
  const { kind } = await params;
  if (!allowedKinds.includes(kind as LegalKind)) notFound();

  const settings = await getLegalSettings();
  const entry = getLegalEntry(settings, kind as LegalKind);
  if (entry.mode === "external" && entry.url) redirect(entry.url);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-panel sm:p-8">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">Zur Startseite</Link>
        <h1 className="mt-5 text-3xl font-semibold">{entry.title}</h1>
        {entry.content.trim() ? (
          <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">{entry.content}</div>
        ) : (
          <p className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">Noch kein Inhalt hinterlegt.</p>
        )}
      </article>
    </main>
  );
}
