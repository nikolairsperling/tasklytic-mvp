import Link from "next/link";
import { notFound } from "next/navigation";
import { CTAButton } from "@/components/landing/CTAButton";
import { FlowPageSections } from "@/components/landing/FlowPageSections";
import { LandingPageLayout } from "@/components/landing/LandingPageLayout";
import { Logo } from "@/components/landing/Logo";
import { resolveBookingEmbed } from "@/lib/booking-embed";
import { bookingCalendarButtonStyle, bookingCalendarIframeStyle, bookingCalendarPlaceholderTokens, bookingCalendarShellStyle } from "@/lib/booking-calendar-style";
import { getActiveTemplate, getGlobalLandingpageDesign, normalizeAddressForm, renderLandingpageSections, renderText, type LandingpageSectionSettings } from "@/lib/landingpage-templates";
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

  const [template, defaultCalendar] = await Promise.all([
    getActiveTemplate(prospect),
    prisma.bookingCalendar.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    })
  ]);
  const design = getGlobalLandingpageDesign(template);
  const addressForm = normalizeAddressForm(template.addressForm);
  const render = (value: string | null | undefined) => renderText(value, prospect, { addressForm });
  const sections = renderLandingpageSections(template, prospect);
  const bookingSection = sections.find((section) => section.type === "booking");
  const settings = bookingSection?.settings ?? {};
  const booking = resolveBookingEmbed(settings, prospect, defaultCalendar);
  const headline = settings.headline || render(template.bookingHeadline) || "Termin mit Tasklytic vereinbaren";
  const subheadline = settings.subheadline || render(template.bookingSubheadline) || "Wähle einen passenden Zeitpunkt auf der Buchungsseite.";
  const thankYouHref = resolveThankYouHref(settings.bookingThankYouUrl || settings.ctaUrl, slug);

  return (
    <LandingPageLayout design={design}>
      <ProspectActivityTracker slug={slug} page="booking" />
      {settings.bookingShowBackButton === false ? null : (
        <header className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <Link href={`/p/${slug}`} className="text-sm font-medium text-slate-600">
              ← {render(template.bookingBackText) || "Zurück zur Landingpage"}
            </Link>
            <Logo src={template.headerLogoUrl || template.logoUrl} alt={template.headerLogoAlt || "Tasklytic"} text={template.headerTextFallback || "Tasklytic"} width={template.headerLogoWidth} height={template.headerLogoHeight} />
          </div>
        </header>
      )}

      <section id="booking" className="px-6 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Buchung</p>
          <h1 className="mx-auto mt-4 max-w-4xl break-words text-3xl font-extrabold leading-tight md:text-5xl">{headline}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-600">{subheadline}</p>

          {booking.active && booking.embedUrl ? (
            <div className="mx-auto overflow-hidden border bg-white shadow-panel" style={bookingCalendarShellStyle(settings)}>
              <iframe
                src={booking.embedUrl}
                title={booking.displayName}
                loading="lazy"
                className="w-full bg-white"
                style={bookingCalendarIframeStyle(settings)}
                allow="clipboard-write; fullscreen; payment"
              />
            </div>
          ) : (
            <BookingCalendarFallback settings={settings} />
          )}

          {booking.externalUrl ? (
            <div className="mt-6">
              <p className="text-sm text-slate-500">Falls der Kalender hier nicht lädt, bitte direkt öffnen.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                <CTAButton href={booking.externalUrl} text={render(template.bookingExternalButtonText) || "Termin extern öffnen"} />
                <CTAButton href={thankYouHref} text={settings.bookingButtonText || settings.ctaText || booking.buttonText} variant="secondary" />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <FlowPageSections sections={sections} page="booking" design={design} excludeTypes={["booking"]} />

      <footer className="px-6 py-8 text-center text-sm text-slate-500">{render(template.footerText) || "Tasklytic"}</footer>
    </LandingPageLayout>
  );
}

function BookingCalendarFallback({ settings }: { settings: LandingpageSectionSettings }) {
  const tokens = bookingCalendarPlaceholderTokens(settings);
  return (
    <div className="mx-auto grid min-h-[420px] place-items-center border bg-white p-8 shadow-panel" style={bookingCalendarShellStyle(settings)}>
      <div className="w-full max-w-2xl rounded-3xl border bg-slate-50 p-6 text-left" style={{ borderColor: tokens.borderColor }}>
        <p className="text-sm font-semibold text-slate-800">Kein Buchungskalender hinterlegt.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">Bitte nutze den externen Link, sobald ein Kalender eingerichtet wurde.</p>
        <div className="mt-6 grid grid-cols-7 gap-2">{Array.from({ length: 28 }).map((_, index) => <div key={index} className="aspect-square rounded-xl bg-white shadow-sm" style={index === 10 ? { backgroundColor: tokens.activeDayColor, borderRadius: tokens.inputRadius } : { borderRadius: tokens.inputRadius }} />)}</div>
        <button type="button" disabled className="mt-6 rounded-full px-5 py-3 text-sm font-bold opacity-70" style={bookingCalendarButtonStyle(settings)}>Kalender einrichten</button>
      </div>
    </div>
  );
}

function resolveThankYouHref(value: string | null | undefined, slug: string) {
  if (value && !value.includes("{{")) return value;
  return `/p/${slug}/thank-you`;
}
