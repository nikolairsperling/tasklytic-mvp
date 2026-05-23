import { NextResponse } from "next/server";
import { normalizeBookingProvider, normalizeBookingUrl } from "@/lib/booking-calendars";
import { prisma } from "@/lib/prisma";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === "on";
}

function calendarData(body: Record<string, unknown>) {
  return {
    provider: normalizeBookingProvider(body.provider),
    displayName: stringValue(body.displayName),
    bookingUrl: normalizeBookingUrl(body.bookingUrl),
    description: stringValue(body.description) || null,
    isActive: booleanValue(body.isActive),
    isDefault: booleanValue(body.isDefault),
    clickTracking: booleanValue(body.clickTracking),
    conversionTracking: booleanValue(body.conversionTracking)
  };
}

export async function GET() {
  return NextResponse.json(await prisma.bookingCalendar.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }));
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const data = calendarData(body);
  if (!data.displayName) return NextResponse.json({ error: "Anzeigename ist erforderlich." }, { status: 400 });
  if (!data.bookingUrl) return NextResponse.json({ error: "Buchungslink ist erforderlich." }, { status: 400 });

  const calendar = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.bookingCalendar.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    const existingDefault = await tx.bookingCalendar.count({ where: { isDefault: true } });
    return tx.bookingCalendar.create({ data: { ...data, isDefault: data.isDefault || existingDefault === 0 } });
  });

  return NextResponse.json(calendar, { status: 201 });
}
