import { BookingCalendarManager } from "@/components/admin/booking-calendar-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  const calendars = await prisma.bookingCalendar.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  return (
    <BookingCalendarManager
      calendars={calendars.map((calendar) => ({
        ...calendar,
        createdAt: calendar.createdAt.toISOString(),
        updatedAt: calendar.updatedAt.toISOString(),
        lastTestedAt: calendar.lastTestedAt?.toISOString() ?? null
      }))}
    />
  );
}
