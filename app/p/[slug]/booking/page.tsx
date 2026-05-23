import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveTemplate, getBookingUrl, renderText } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";
import { ProspectActivityTracker } from "@/components/landing/prospect-activity-tracker";

export const dynamic = "force-dynamic";

type BookingPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug } = await params;
  const prospect = await prisma.prospect.findUnique({ where: { slug } });
  if (!prospect) notFound();

  const template = await getActiveTemplate(prospect);
  const bookingUrl = getBookingUrl(prospect);
  const headline = renderText(template.bookingHeadline, prospect) || `Termin mit Tasklytic vereinbaren`;
  const subheadline = renderText(template.bookingSubheadline, prospect) || `Wähle einen passenden Zeitpunkt auf der externen Buchungsseite.`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <ProspectActivityTracker slug={slug} page="booking" />
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href={`/p/${slug}`} className="text-sm font-medium text-slate-600">
            ← {renderText(template.bookingBackText, prospect) || "Zurück zur Landingpage"}
          </Link>
          {template.logoUrl ? <img src={template.logoUrl} alt="Logo" loading="eager" decoding="async" className="h-8 w-auto" /> : <span className="font-semibold">Tasklytic</span>}
        </div>
      </header>

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Buchung</p>
          <h1 className="mt-4 text-4xl font-semibold md:text-6xl">{headline}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-600">{subheadline}</p>

          {bookingUrl ? (
            <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-panel">
              <iframe src={bookingUrl} title="Externe Buchungsseite" loading="lazy" className="h-[760px] w-full" />
            </div>
          ) : (
            <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
              Für diesen Prospect ist noch keine externe Buchungsseite hinterlegt.
            </div>
          )}

          {bookingUrl ? (
            <div className="mt-6">
              <p className="text-sm text-slate-500">Falls der Kalender hier nicht lädt, öffne ihn direkt.</p>
              <a href={bookingUrl} data-track-event="cta_clicked" data-track-label="Termin extern öffnen" className="mt-3 inline-flex rounded-full px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: template.primaryColor }}>
                {renderText(template.bookingExternalButtonText, prospect) || "Termin extern öffnen"}
              </a>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-slate-500">{renderText(template.footerText, prospect) || "Tasklytic"}</footer>
    </main>
  );
}
