import { NextResponse } from "next/server";
import { testBookingUrl } from "@/lib/booking-calendars";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id } = await params;
  const calendar = await prisma.bookingCalendar.findUnique({ where: { id } });
  if (!calendar) return NextResponse.json({ error: "Kalender nicht gefunden." }, { status: 404 });

  const result = await testBookingUrl(calendar.bookingUrl);
  const updated = await prisma.bookingCalendar.update({
    where: { id },
    data: {
      lastTestStatus: result.status,
      lastTestStatusCode: result.statusCode,
      lastTestMessage: result.message,
      lastTestedAt: new Date()
    }
  });

  return NextResponse.json({ calendar: updated, test: result });
}
