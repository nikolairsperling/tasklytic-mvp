import { NextResponse } from "next/server";
import { normalizeBookingProvider, normalizeBookingUrl } from "@/lib/booking-calendars";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === "on";
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const current = await prisma.bookingCalendar.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Kalender nicht gefunden." }, { status: 404 });
  const body = await request.json() as Record<string, unknown>;
  const isDefault = "isDefault" in body ? booleanValue(body.isDefault) : current.isDefault;

  const updated = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.bookingCalendar.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return tx.bookingCalendar.update({
      where: { id },
      data: {
        provider: "provider" in body ? normalizeBookingProvider(body.provider) : current.provider,
        displayName: "displayName" in body ? stringValue(body.displayName) || current.displayName : current.displayName,
        bookingUrl: "bookingUrl" in body ? normalizeBookingUrl(body.bookingUrl) || current.bookingUrl : current.bookingUrl,
        description: "description" in body ? stringValue(body.description) || null : current.description,
        isActive: "isActive" in body ? booleanValue(body.isActive) : current.isActive,
        isDefault,
        clickTracking: "clickTracking" in body ? booleanValue(body.clickTracking) : current.clickTracking,
        conversionTracking: "conversionTracking" in body ? booleanValue(body.conversionTracking) : current.conversionTracking
      }
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  await prisma.bookingCalendar.delete({ where: { id } });
  const defaultExists = await prisma.bookingCalendar.count({ where: { isDefault: true } });
  if (defaultExists === 0) {
    const next = await prisma.bookingCalendar.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
    if (next) await prisma.bookingCalendar.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return new Response(null, { status: 204 });
}
