-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "bookingUrl" TEXT;

-- AlterTable
ALTER TABLE "LandingpageTemplate" ADD COLUMN "bookingMode" TEXT NOT NULL DEFAULT 'embedded_page',
ADD COLUMN "bookingHeadline" TEXT,
ADD COLUMN "bookingSubheadline" TEXT,
ADD COLUMN "bookingBackText" TEXT NOT NULL DEFAULT 'Zurück zur Landingpage',
ADD COLUMN "bookingExternalButtonText" TEXT NOT NULL DEFAULT 'Termin extern öffnen';
