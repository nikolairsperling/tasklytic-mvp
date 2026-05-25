import { VisualLandingpageTemplateEditor } from "@/components/admin/visual-landingpage-template-editor";
import { defaultLandingpageTemplate } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LandingpageBuilderPage() {
  const [template, prospects, bookingCalendars] = await Promise.all([
    getBuilderTemplate(),
    prisma.prospect.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.bookingCalendar.findMany({
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      take: 25
    })
  ]);

  return <VisualLandingpageTemplateEditor template={template} prospects={prospects} bookingCalendars={bookingCalendars.map(serializeBookingCalendar)} backHref="/admin/landingpages/templates" />;
}

async function getBuilderTemplate() {
  const existing = await prisma.landingpageTemplate.findFirst({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
  });
  if (existing) return existing;
  return prisma.landingpageTemplate.create({ data: defaultLandingpageTemplate() });
}

function serializeBookingCalendar(calendar: Awaited<ReturnType<typeof prisma.bookingCalendar.findMany>>[number]) {
  return {
    id: calendar.id,
    provider: calendar.provider,
    displayName: calendar.displayName,
    bookingUrl: calendar.bookingUrl,
    description: calendar.description,
    isActive: calendar.isActive,
    isDefault: calendar.isDefault
  };
}
