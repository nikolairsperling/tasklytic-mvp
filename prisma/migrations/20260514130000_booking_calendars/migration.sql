CREATE TABLE "BookingCalendar" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "displayName" TEXT NOT NULL,
    "bookingUrl" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "clickTracking" BOOLEAN NOT NULL DEFAULT false,
    "conversionTracking" BOOLEAN NOT NULL DEFAULT false,
    "lastTestStatus" TEXT NOT NULL DEFAULT 'untested',
    "lastTestStatusCode" INTEGER,
    "lastTestMessage" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingCalendar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingCalendar_provider_idx" ON "BookingCalendar"("provider");
CREATE INDEX "BookingCalendar_isActive_idx" ON "BookingCalendar"("isActive");
CREATE INDEX "BookingCalendar_isDefault_idx" ON "BookingCalendar"("isDefault");
CREATE INDEX "BookingCalendar_updatedAt_idx" ON "BookingCalendar"("updatedAt");
