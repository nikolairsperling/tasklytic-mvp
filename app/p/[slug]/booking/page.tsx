import Link from "next/link";
import { notFound } from "next/navigation";
import { CTAButton } from "@/components/landing/CTAButton";
import { LandingPageLayout } from "@/components/landing/LandingPageLayout";
import { Logo } from "@/components/landing/Logo";
import { getActiveTemplate, getBookingUrl, getGlobalLandingpageDesign, normalizeAddressForm, renderText } from "@/lib/landingpage-templates";
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
  const design = getGlobalLandingpageDesign(template);
  const bookingUrl = getBookingUrl(prospect);
  const addressForm = normalizeAddressForm(template.addressForm);
  const render = (value: string | null | undefined) => renderText(value, prospect, { addressForm });
  const headline = render(template.bookingHeadline) || `Termin mit Tasklytic vereinbaren`;
  const subheadline = render(template.bookingSubheadline) || `Wähle einen passenden Zeitpunkt auf der externen Buchungsseite.`;

  return (
    <LandingPageLayout design={design}>
      <ProspectActivityTracker slug={slug} page="booking" />
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href={`/p/${slug}`} className="text-sm font-medium text-slate-600">
            ← {render(template.bookingBackText) || "Zurück zur Landingpage"}
          </Link>
          <Logo src={template.headerLogoUrl || template.logoUrl} alt={template.headerLogoAlt || "Tasklytic"} text={template.headerTextFallback || "Tasklytic"} width={template.headerLogoWidth} height={template.headerLogoHeight} />
        </div>
      </header>

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Buchung</p>
          <h1 className="mx-auto mt-4 max-w-4xl break-words text-3xl font-extrabold leading-tight md:text-5xl">{headline}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-600">{subheadline}</p>

          {bookingUrl ? (
            <div className="mt-8 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-panel">
              <iframe src={bookingUrl} title="Externe Buchungsseite" loading="lazy" className="h-[760px] w-full" />
            </div>
          ) : (
            <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
              Für diesen Prospect ist noch keine externe Buchungsseite hinterlegt.
            </div>
          )}

          {bookingUrl ? (
            <div className="mt-6">
              <p className="text-sm text-slate-500">Falls der Kalender hier nicht lädt, bitte direkt öffnen.</p>
              <div className="mt-3 flex justify-center">
                <CTAButton href={bookingUrl} text={render(template.bookingExternalButtonText) || "Termin extern öffnen"} />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-slate-500">{render(template.footerText) || "Tasklytic"}</footer>
    </LandingPageLayout>
  );
}
