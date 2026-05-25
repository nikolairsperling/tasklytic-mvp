import { notFound } from "next/navigation";
import React from "react";
import { VisualLandingpageTemplateEditor } from "@/components/admin/visual-landingpage-template-editor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function LandingpageTemplateBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const [template, prospects, bookingCalendars] = await Promise.all([
    prisma.landingpageTemplate.findUnique({ where: { id } }),
    prisma.prospect.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.bookingCalendar.findMany({
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      take: 25
    })
  ]);

  if (!template) notFound();

  return <VisualLandingpageTemplateEditor template={template} prospects={prospects} bookingCalendars={bookingCalendars.map(serializeBookingCalendar)} backHref="/admin/landingpages/templates" />;
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
